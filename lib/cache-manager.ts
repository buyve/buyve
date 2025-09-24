import { redisCache } from './redis-cache';

export class CacheManager {
  // 토큰 메타데이터 캐싱 (1시간)
  static async getTokenMetadata(tokenAddress: string) {
    const cacheKey = `token:metadata:${tokenAddress}`;
    
    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return { data: cached, fromCache: true };
      }
      
      return { data: null, fromCache: false };
    } catch (error) {
      console.error('Cache get error for token metadata:', error);
      return { data: null, fromCache: false };
    }
  }

  static async setTokenMetadata(tokenAddress: string, metadata: any) {
    const cacheKey = `token:metadata:${tokenAddress}`;
    const TTL = 3600; // 1시간
    
    try {
      await redisCache.set(cacheKey, metadata, TTL);
      return true;
    } catch (error) {
      console.error('Cache set error for token metadata:', error);
      return false;
    }
  }

  // 토큰 가격 캐싱 (30초)
  static async getTokenPrice(tokenAddress: string) {
    const cacheKey = `token:price:${tokenAddress}`;
    
    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return { data: cached, fromCache: true };
      }
      
      return { data: null, fromCache: false };
    } catch (error) {
      console.error('Cache get error for token price:', error);
      return { data: null, fromCache: false };
    }
  }

  static async setTokenPrice(tokenAddress: string, priceData: any) {
    const cacheKey = `token:price:${tokenAddress}`;
    const TTL = 30; // 30초
    
    try {
      await redisCache.set(cacheKey, priceData, TTL);
      return true;
    } catch (error) {
      console.error('Cache set error for token price:', error);
      return false;
    }
  }

  // 차트 데이터 캐싱 (1분)
  static async getChartData(tokenAddress: string) {
    const cacheKey = `chart:data:${tokenAddress}`;
    
    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return { data: cached, fromCache: true };
      }
      
      return { data: null, fromCache: false };
    } catch (error) {
      console.error('Cache get error for chart data:', error);
      return { data: null, fromCache: false };
    }
  }

  static async setChartData(tokenAddress: string, chartData: any) {
    const cacheKey = `chart:data:${tokenAddress}`;
    const TTL = 60; // 1분
    
    try {
      await redisCache.set(cacheKey, chartData, TTL);
      return true;
    } catch (error) {
      console.error('Cache set error for chart data:', error);
      return false;
    }
  }

  // 채팅방 목록 캐싱 (5분)
  static async getChatRooms() {
    const cacheKey = 'chatrooms:list';
    
    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return { data: cached, fromCache: true };
      }
      
      return { data: null, fromCache: false };
    } catch (error) {
      console.error('Cache get error for chat rooms:', error);
      return { data: null, fromCache: false };
    }
  }

  static async setChatRooms(roomsData: any) {
    const cacheKey = 'chatrooms:list';
    const TTL = 300; // 5분
    
    try {
      await redisCache.set(cacheKey, roomsData, TTL);
      return true;
    } catch (error) {
      console.error('Cache set error for chat rooms:', error);
      return false;
    }
  }

  // 사용자 프로필 캐싱 (15분)
  static async getUserProfile(walletAddress: string) {
    const cacheKey = `profile:${walletAddress}`;
    
    try {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        return { data: cached, fromCache: true };
      }
      
      return { data: null, fromCache: false };
    } catch (error) {
      console.error('Cache get error for user profile:', error);
      return { data: null, fromCache: false };
    }
  }

  static async setUserProfile(walletAddress: string, profileData: any) {
    const cacheKey = `profile:${walletAddress}`;
    const TTL = 900; // 15분
    
    try {
      await redisCache.set(cacheKey, profileData, TTL);
      return true;
    } catch (error) {
      console.error('Cache set error for user profile:', error);
      return false;
    }
  }

  // 캐시 무효화
  static async invalidateTokenData(tokenAddress: string) {
    const keys = [
      `token:metadata:${tokenAddress}`,
      `token:price:${tokenAddress}`,
      `chart:data:${tokenAddress}`
    ];
    
    try {
      for (const key of keys) {
        await redisCache.del(key);
      }
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  static async invalidateUserData(walletAddress: string) {
    const key = `profile:${walletAddress}`;
    
    try {
      await redisCache.del(key);
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  // 캐시 상태 확인
  static async getCacheStats() {
    try {
      const isReady = redisCache.isReady();
      return {
        isReady,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        isReady: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}