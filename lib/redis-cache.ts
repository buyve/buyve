import { createClient, RedisClientType } from 'redis';

// Safe Edge Runtime check
let isNodeRuntime = false;
try {
  // Edge Runtime doesn't have process.versions
  isNodeRuntime = typeof process !== 'undefined' &&
                  typeof process.versions !== 'undefined' &&
                  typeof process.versions.node === 'string';
} catch (e) {
  // Edge Runtime may throw error when accessing process.versions
  isNodeRuntime = false;
}

class RedisCacheManager {
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    // Disable Redis in Edge Runtime
    if (!isNodeRuntime) {
      // Silently disable when Redis is unavailable
      return;
    }

    try {
      const REDIS_URL = process.env.REDIS_URL;
      if (!REDIS_URL) {
        // Silently disable if REDIS_URL is not set
        return;
      }

      this.client = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            // Stop reconnection after 3 failed attempts
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
        // Silently disable on Redis connection error (removed logging)
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
      // Silently disable on initialization failure (removed logging)
      this.client = null;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.client || !this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      // Silently return null on Redis error
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
      // Silently return false on Redis error
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      // Silently return false on Redis error
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      // Silently return false on Redis error
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client || !this.isConnected) return -1;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      // Silently return -1 on Redis error
      return -1;
    }
  }

  async flush(): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      // Silently return false on Redis error
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
        // Silently ignore Redis closure error
      }
    }
  }
}

export const redisCache = new RedisCacheManager();