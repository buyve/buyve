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
      console.warn('Redis not available in Edge Runtime - caching disabled');
      return;
    }

    try {
      const REDIS_URL = process.env.REDIS_URL;
      if (!REDIS_URL) {
        console.warn('REDIS_URL not found - caching disabled');
        return;
      }

      this.client = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Cache Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Cache Connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis Cache Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to initialize Redis cache:', error);
      this.client = null;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.client || !this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
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
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client || !this.isConnected) return -1;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  }

  async flush(): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('Redis flush error:', error);
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
        console.error('Redis close error:', error);
      }
    }
  }
}

export const redisCache = new RedisCacheManager();