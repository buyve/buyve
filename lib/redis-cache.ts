import { createClient, RedisClientType } from 'redis';

// Edge Runtime 안전한 확인
let isNodeRuntime = false;
try {
  // Edge Runtime에서는 process.versions가 없음
  isNodeRuntime = typeof process !== 'undefined' && 
                  typeof process.versions !== 'undefined' && 
                  typeof process.versions.node === 'string';
} catch (e) {
  // Edge Runtime에서는 process.versions 접근 시 에러 발생 가능
  isNodeRuntime = false;
}

class RedisCacheManager {
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    // Edge Runtime에서는 Redis 비활성화
    if (!isNodeRuntime) {
      // Redis 사용 불가 시 조용히 비활성화
      return;
    }

    try {
      const REDIS_URL = process.env.REDIS_URL;
      if (!REDIS_URL) {
        // REDIS_URL 없으면 조용히 비활성화
        return;
      }

      this.client = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            // 3회 이상 재시도 실패 시 연결 중단
            if (retries > 3) {
              return false as any;
            }
            return Math.min(retries * 50, 500);
          },
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100
        }
      });

      this.client.on('error', () => {
        // Redis 연결 에러 시 조용히 비활성화 (로그 제거)
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      // 초기화 실패 시 조용히 비활성화 (로그 제거)
      this.client = null;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.client || !this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      // Redis 에러 시 조용히 null 반환
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      return true;
    } catch (error) {
      // Redis 에러 시 조용히 false 반환
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      // Redis 에러 시 조용히 false 반환
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      // Redis 에러 시 조용히 false 반환
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client || !this.isConnected) return -1;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      // Redis 에러 시 조용히 -1 반환
      return -1;
    }
  }

  async flush(): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      // Redis 에러 시 조용히 false 반환
      return false;
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        // Redis 종료 에러 시 조용히 무시
      }
    }
  }
}

export const redisCache = new RedisCacheManager();