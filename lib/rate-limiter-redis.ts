import { redisCache } from './redis-cache';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  total: number;
}

export class RedisRateLimiter {
  // IP-based rate limiting
  static async checkRateLimit(
    ip: string,
    category: string,
    limit: number,
    windowSeconds: number = 60
  ): Promise<RateLimitResult> {
    const key = `rate_limit:${category}:${ip}`;

    try {
      // Allow if Redis is unavailable
      if (!redisCache.isReady()) {
        return {
          allowed: true,
          remaining: limit,
          resetTime: Date.now() + (windowSeconds * 1000),
          total: limit
        };
      }

      // Get current count
      const currentValue = await redisCache.get(key);
      const current = currentValue ? currentValue + 1 : 1;

      // Update count
      await redisCache.set(key, current, windowSeconds);

      // Check TTL
      const ttl = await redisCache.ttl(key);
      const resetTime = Date.now() + (Math.max(ttl, 0) * 1000);

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime,
        total: limit
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Allow on error (fail open)
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
        total: limit
      };
    }
  }

  // User-based rate limiting
  static async checkUserRateLimit(
    walletAddress: string,
    category: string,
    limit: number,
    windowSeconds: number = 60
  ): Promise<RateLimitResult> {
    const key = `rate_limit:user:${category}:${walletAddress}`;

    try {
      // Allow if Redis is unavailable
      if (!redisCache.isReady()) {
        return {
          allowed: true,
          remaining: limit,
          resetTime: Date.now() + (windowSeconds * 1000),
          total: limit
        };
      }

      // Get current count
      const currentValue = await redisCache.get(key);
      const current = currentValue ? currentValue + 1 : 1;

      // Update count
      await redisCache.set(key, current, windowSeconds);

      const ttl = await redisCache.ttl(key);
      const resetTime = Date.now() + (Math.max(ttl, 0) * 1000);

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime,
        total: limit
      };
    } catch (error) {
      console.error('User rate limit check error:', error);
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
        total: limit
      };
    }
  }

  // Global rate limiting (for all users)
  static async checkGlobalRateLimit(
    category: string,
    limit: number,
    windowSeconds: number = 60
  ): Promise<RateLimitResult> {
    const key = `rate_limit:global:${category}`;

    try {
      // Allow if Redis is unavailable
      if (!redisCache.isReady()) {
        return {
          allowed: true,
          remaining: limit,
          resetTime: Date.now() + (windowSeconds * 1000),
          total: limit
        };
      }

      // Get current count
      const currentValue = await redisCache.get(key);
      const current = currentValue ? currentValue + 1 : 1;

      // Update count
      await redisCache.set(key, current, windowSeconds);

      const ttl = await redisCache.ttl(key);
      const resetTime = Date.now() + (Math.max(ttl, 0) * 1000);

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime,
        total: limit
      };
    } catch (error) {
      console.error('Global rate limit check error:', error);
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
        total: limit
      };
    }
  }

  // Get rate limit information
  static async getRateLimitInfo(
    key: string
  ): Promise<{ current: number; ttl: number; resetTime: number }> {
    try {
      if (!redisCache.isReady()) {
        return { current: 0, ttl: 0, resetTime: Date.now() };
      }

      const current = await redisCache.get(key);
      const ttl = await redisCache.ttl(key);

      return {
        current: current ? parseInt(current) : 0,
        ttl: Math.max(ttl, 0),
        resetTime: Date.now() + (Math.max(ttl, 0) * 1000)
      };
    } catch (error) {
      console.error('Rate limit info error:', error);
      return { current: 0, ttl: 0, resetTime: Date.now() };
    }
  }

  // Reset rate limit
  static async resetRateLimit(key: string): Promise<boolean> {
    try {
      await redisCache.del(key);
      return true;
    } catch (error) {
      console.error('Rate limit reset error:', error);
      return false;
    }
  }

  // Rate limit statistics
  static async getRateLimitStats(category: string): Promise<any> {
    try {
      if (!redisCache.isReady()) {
        return {
          totalKeys: 0,
          category,
          timestamp: new Date().toISOString(),
          note: 'Redis not available'
        };
      }

      // Using scan instead of keys command would be better,
      // but direct client access is required with current structure
      return {
        totalKeys: 0,
        category,
        timestamp: new Date().toISOString(),
        note: 'Statistics temporarily disabled'
      };
    } catch (error) {
      console.error('Rate limit stats error:', error);
      return {
        error: error.message,
        category,
        timestamp: new Date().toISOString()
      };
    }
  }
}