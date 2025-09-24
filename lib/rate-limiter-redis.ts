import { redisCache } from './redis-cache';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  total: number;
}

export class RedisRateLimiter {
  // IP 기반 rate limiting
  static async checkRateLimit(
    ip: string,
    category: string,
    limit: number,
    windowSeconds: number = 60
  ): Promise<RateLimitResult> {
    const key = `rate_limit:${category}:${ip}`;
    
    try {
      // Redis가 사용 불가능한 경우 허용
      if (!redisCache.isReady()) {
        return {
          allowed: true,
          remaining: limit,
          resetTime: Date.now() + (windowSeconds * 1000),
          total: limit
        };
      }

      // 현재 카운트 조회
      const currentValue = await redisCache.get(key);
      const current = currentValue ? currentValue + 1 : 1;
      
      // 카운트 업데이트
      await redisCache.set(key, current, windowSeconds);
      
      // TTL 확인
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
      // 에러 시 허용 (fail open)
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
        total: limit
      };
    }
  }

  // 사용자별 rate limiting
  static async checkUserRateLimit(
    walletAddress: string,
    category: string,
    limit: number,
    windowSeconds: number = 60
  ): Promise<RateLimitResult> {
    const key = `rate_limit:user:${category}:${walletAddress}`;
    
    try {
      // Redis가 사용 불가능한 경우 허용
      if (!redisCache.isReady()) {
        return {
          allowed: true,
          remaining: limit,
          resetTime: Date.now() + (windowSeconds * 1000),
          total: limit
        };
      }

      // 현재 카운트 조회
      const currentValue = await redisCache.get(key);
      const current = currentValue ? currentValue + 1 : 1;
      
      // 카운트 업데이트
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

  // 글로벌 rate limiting (모든 사용자 대상)
  static async checkGlobalRateLimit(
    category: string,
    limit: number,
    windowSeconds: number = 60
  ): Promise<RateLimitResult> {
    const key = `rate_limit:global:${category}`;
    
    try {
      // Redis가 사용 불가능한 경우 허용
      if (!redisCache.isReady()) {
        return {
          allowed: true,
          remaining: limit,
          resetTime: Date.now() + (windowSeconds * 1000),
          total: limit
        };
      }

      // 현재 카운트 조회
      const currentValue = await redisCache.get(key);
      const current = currentValue ? currentValue + 1 : 1;
      
      // 카운트 업데이트
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

  // Rate limit 정보 조회
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

  // Rate limit 리셋
  static async resetRateLimit(key: string): Promise<boolean> {
    try {
      await redisCache.del(key);
      return true;
    } catch (error) {
      console.error('Rate limit reset error:', error);
      return false;
    }
  }

  // Rate limit 통계
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

      // keys 명령어 대신 scan을 사용하는 것이 좋지만, 
      // 현재 구조상 직접 client 접근 필요
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