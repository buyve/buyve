import { Connection, Commitment } from '@solana/web3.js';

/**
 * Connection Pool System
 * - Create and reuse only 5-10 connections
 * - Load distribution using round-robin approach
 * - Resolve rate limit issues
 */

interface PoolConfig {
  maxSize: number;
  rpcUrl: string;
  commitment: Commitment;
}

class ConnectionPool {
  private pool: Connection[] = [];
  private currentIndex = 0;
  private config: PoolConfig;
  private isInitialized = false;

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      maxSize: config?.maxSize || 10,
      rpcUrl: config?.rpcUrl || process.env.NEXT_PUBLIC_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/***REMOVED_ALCHEMY_KEY***',
      commitment: config?.commitment || 'confirmed',
    };
  }

  /**
   * Initialize pool (execute once at server startup)
   */
  private initialize() {
    if (this.isInitialized) return;

    for (let i = 0; i < this.config.maxSize; i++) {
      const connection = new Connection(this.config.rpcUrl, {
        commitment: this.config.commitment,
        confirmTransactionInitialTimeout: 90000,
        disableRetryOnRateLimit: true,
        httpHeaders: {
          'User-Agent': 'SolanaSwapChat/1.0',
          'Connection': 'keep-alive', // Reuse connection with HTTP Keep-Alive
        },
        // Maintain connection with fetch options
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            headers: {
              ...options?.headers,
              'Connection': 'keep-alive',
            },
            keepalive: true,
          });
        },
      });

      this.pool.push(connection);
    }

    this.isInitialized = true;
  }

  /**
   * Return Connection using round-robin approach
   */
  getConnection(): Connection {
    if (!this.isInitialized) {
      this.initialize();
    }

    const connection = this.pool[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.config.maxSize;

    return connection;
  }

  /**
   * Check pool status
   */
  getStatus() {
    return {
      poolSize: this.pool.length,
      maxSize: this.config.maxSize,
      currentIndex: this.currentIndex,
      isInitialized: this.isInitialized,
      rpcUrl: this.config.rpcUrl,
    };
  }

  /**
   * Reset pool (use when issues occur)
   */
  reset() {
    this.pool = [];
    this.currentIndex = 0;
    this.isInitialized = false;
  }
}

// Singleton instance (shared across server)
export const connectionPool = new ConnectionPool();

export default connectionPool;
