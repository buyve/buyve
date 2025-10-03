import { Connection, Commitment } from '@solana/web3.js';

/**
 * 🎯 Connection Pool 시스템
 * - 5-10개의 Connection만 생성하여 재사용
 * - Round-robin 방식으로 부하 분산
 * - Rate Limit 초과 문제 해결
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
      rpcUrl: config?.rpcUrl || process.env.NEXT_PUBLIC_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/CLIspK_3J2GVAuweafRIUoHzWjyn07rz',
      commitment: config?.commitment || 'confirmed',
    };
  }

  /**
   * Pool 초기화 (서버 시작 시 한 번만 실행)
   */
  private initialize() {
    if (this.isInitialized) return;

    console.log(`[ConnectionPool] Initializing ${this.config.maxSize} connections...`);

    for (let i = 0; i < this.config.maxSize; i++) {
      const connection = new Connection(this.config.rpcUrl, {
        commitment: this.config.commitment,
        confirmTransactionInitialTimeout: 90000,
        disableRetryOnRateLimit: true,
        httpHeaders: {
          'User-Agent': 'SolanaSwapChat/1.0',
          'Connection': 'keep-alive', // HTTP Keep-Alive로 연결 재사용
        },
        // fetch 옵션으로 연결 유지
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
    console.log(`[ConnectionPool] ✅ ${this.pool.length} connections ready`);
  }

  /**
   * Round-robin 방식으로 Connection 반환
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
   * Pool 상태 확인
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
   * Pool 리셋 (문제 발생 시)
   */
  reset() {
    this.pool = [];
    this.currentIndex = 0;
    this.isInitialized = false;
    console.log('[ConnectionPool] Reset completed');
  }
}

// 싱글톤 인스턴스 (서버 전역에서 공유)
export const connectionPool = new ConnectionPool();

export default connectionPool;
