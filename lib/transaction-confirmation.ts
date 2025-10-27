import { Connection, TransactionSignature, Commitment } from '@solana/web3.js';

interface ConfirmationMetrics {
  method: 'websocket' | 'polling';
  attempts: number;
  timeMs: number;
  success: boolean;
  error?: string;
}

class TransactionConfirmationMetrics {
  private metrics: ConfirmationMetrics[] = [];
  
  record(metric: ConfirmationMetrics) {
    this.metrics.push(metric);
    
    // Keep only last 100 records
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }
  
  getStats() {
    if (this.metrics.length === 0) return null;
    
    const websocketMetrics = this.metrics.filter(m => m.method === 'websocket');
    const pollingMetrics = this.metrics.filter(m => m.method === 'polling');
    
    return {
      total: this.metrics.length,
      websocket: {
        count: websocketMetrics.length,
        successRate: websocketMetrics.filter(m => m.success).length / websocketMetrics.length || 0,
        avgTime: websocketMetrics.reduce((sum, m) => sum + m.timeMs, 0) / websocketMetrics.length || 0,
        avgAttempts: websocketMetrics.reduce((sum, m) => sum + m.attempts, 0) / websocketMetrics.length || 0,
      },
      polling: {
        count: pollingMetrics.length,
        successRate: pollingMetrics.filter(m => m.success).length / pollingMetrics.length || 0,
        avgTime: pollingMetrics.reduce((sum, m) => sum + m.timeMs, 0) / pollingMetrics.length || 0,
        avgAttempts: pollingMetrics.reduce((sum, m) => sum + m.attempts, 0) / pollingMetrics.length || 0,
      }
    };
  }
}

export const confirmationMetrics = new TransactionConfirmationMetrics();

/**
 * Smart polling with exponential backoff
 */
async function pollTransaction(
  connection: Connection,
  signature: TransactionSignature,
  timeout: number = 30000,
  commitment: Commitment = 'confirmed'
): Promise<boolean> {
  const startTime = Date.now();
  let attempts = 0;

  // Progressive delays: fast initially, then slower
  const delays = [500, 500, 1000, 1000, 2000, 2000, 3000, 3000, 5000];

  while (Date.now() - startTime < timeout) {
    attempts++;
    const delay = delays[Math.min(attempts - 1, delays.length - 1)];

    try {
      const status = await connection.getSignatureStatus(signature);

      if (status?.value?.confirmationStatus === commitment ||
          status?.value?.confirmationStatus === 'finalized') {
        if (status.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }

        confirmationMetrics.record({
          method: 'polling',
          attempts,
          timeMs: Date.now() - startTime,
          success: true
        });

        return true;
      }
    } catch (error) {
      // Continue polling on network errors
      if (Date.now() - startTime > timeout - 1000) {
        confirmationMetrics.record({
          method: 'polling',
          attempts,
          timeMs: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }

    // Wait with progressive delay
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  confirmationMetrics.record({
    method: 'polling',
    attempts,
    timeMs: Date.now() - startTime,
    success: false,
    error: 'Timeout'
  });

  return false;
}

/**
 * WebSocket-based transaction confirmation
 */
async function confirmViaWebSocket(
  connection: Connection,
  signature: TransactionSignature,
  timeout: number = 30000,
  commitment: Commitment = 'confirmed'
): Promise<boolean> {
  const startTime = Date.now();

  return new Promise<boolean>((resolve, reject) => {
    let subscriptionId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (subscriptionId !== null) {
        connection.removeSignatureListener(subscriptionId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };

    try {
      subscriptionId = connection.onSignature(
        signature,
        (result) => {
          const elapsed = Date.now() - startTime;
          cleanup();

          if (result.err) {
            confirmationMetrics.record({
              method: 'websocket',
              attempts: 1,
              timeMs: elapsed,
              success: false,
              error: JSON.stringify(result.err)
            });
            reject(new Error(`Transaction failed: ${JSON.stringify(result.err)}`));
          } else {
            confirmationMetrics.record({
              method: 'websocket',
              attempts: 1,
              timeMs: elapsed,
              success: true
            });
            resolve(true);
          }
        },
        commitment
      );

      // Set timeout
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        cleanup();
        confirmationMetrics.record({
          method: 'websocket',
          attempts: 1,
          timeMs: elapsed,
          success: false,
          error: 'WebSocket timeout'
        });
        reject(new Error('WebSocket confirmation timeout'));
      }, timeout);

    } catch (error) {
      const elapsed = Date.now() - startTime;
      cleanup();
      confirmationMetrics.record({
        method: 'websocket',
        attempts: 1,
        timeMs: elapsed,
        success: false,
        error: error instanceof Error ? error.message : 'WebSocket error'
      });
      reject(error);
    }
  });
}

/**
 * Hybrid transaction confirmation using WebSocket with polling fallback
 * Uses Alchemy RPC for improved reliability
 */
export async function confirmTransactionHybrid(
  connection: Connection,
  signature: TransactionSignature,
  options: {
    timeout?: number;
    commitment?: Commitment;
    useWebSocket?: boolean;
  } = {}
): Promise<boolean> {
  const {
    timeout = 30000,
    commitment = 'confirmed',
    useWebSocket = true
  } = options;

  // If WebSocket is disabled, use polling only
  if (!useWebSocket) {
    return pollTransaction(connection, signature, timeout, commitment);
  }

  try {
    // Race between WebSocket and polling
    const result = await Promise.race([
      confirmViaWebSocket(connection, signature, timeout * 0.8, commitment),
      pollTransaction(connection, signature, timeout, commitment)
    ]);

    return result;
  } catch (error) {
    // If both fail, try one more time with polling
    const result = await pollTransaction(connection, signature, timeout / 2, commitment);
    return result;
  }
}

/**
 * Create optimized Alchemy connection with WebSocket support
 */
export function createAlchemyConnection(rpcUrl: string): Connection {
  // Extract Alchemy key from URL
  const urlParts = rpcUrl.split('/');
  const apiKey = urlParts[urlParts.length - 1];
  
  // Construct WebSocket URL for Alchemy
  const wsUrl = `wss://solana-mainnet.g.alchemy.com/v2/${apiKey}`;
  
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    wsEndpoint: wsUrl,
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false, // Let Alchemy handle rate limits
  });
}

/**
 * Get confirmation statistics
 */
export function getConfirmationStats() {
  return confirmationMetrics.getStats();
}

/**
 * Print detailed confirmation statistics to console
 */
export function printConfirmationStats() {
  const stats = confirmationMetrics.getStats();

  if (!stats) {
    console.log(`\n📊 [STATS] No confirmation data available yet\n`);
    return;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 [STATS] Confirmation Performance Statistics`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📈 Total Confirmations: ${stats.total}`);

  if (stats.websocket.count > 0) {
    console.log(`\n🎧 WebSocket Method:`);
    console.log(`   ├─ Count: ${stats.websocket.count}`);
    console.log(`   ├─ Success Rate: ${(stats.websocket.successRate * 100).toFixed(1)}%`);
    console.log(`   ├─ Average Time: ${Math.round(stats.websocket.avgTime)}ms`);
    console.log(`   └─ Average Attempts: ${stats.websocket.avgAttempts.toFixed(1)}`);
  }

  if (stats.polling.count > 0) {
    console.log(`\n🔄 Polling Method:`);
    console.log(`   ├─ Count: ${stats.polling.count}`);
    console.log(`   ├─ Success Rate: ${(stats.polling.successRate * 100).toFixed(1)}%`);
    console.log(`   ├─ Average Time: ${Math.round(stats.polling.avgTime)}ms`);
    console.log(`   └─ Average Attempts: ${stats.polling.avgAttempts.toFixed(1)}`);
  }

  if (stats.websocket.count > 0 && stats.polling.count > 0) {
    const speedup = ((stats.polling.avgTime - stats.websocket.avgTime) / stats.polling.avgTime * 100);
    console.log(`\n⚡ Performance:`);
    if (speedup > 0) {
      console.log(`   └─ WebSocket is ${speedup.toFixed(1)}% faster than Polling`);
    } else {
      console.log(`   └─ Polling is ${(-speedup).toFixed(1)}% faster than WebSocket`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}