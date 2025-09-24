import { redisCache } from './redis-cache';

export class SessionManager {
  // 세션 생성
  static async createSession(walletAddress: string, token: string, profileData?: any) {
    const sessionKey = `session:${walletAddress}`;
    const sessionData = {
      walletAddress,
      token,
      profile: profileData,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    try {
      // 세션 저장 (1시간)
      await redisCache.set(sessionKey, sessionData, 3600);

      // 활성 사용자 세트에 추가
      await redisCache.client?.sAdd('active:users', walletAddress);

      return { success: true, sessionData };
    } catch (error) {
      console.error('Session creation error:', error);
      return { success: false, error: error.message };
    }
  }

  // 세션 조회
  static async getSession(walletAddress: string) {
    const sessionKey = `session:${walletAddress}`;
    
    try {
      const sessionData = await redisCache.get(sessionKey);
      
      if (!sessionData) {
        return { success: false, error: 'Session not found' };
      }

      // 활동 시간 업데이트
      sessionData.lastActivity = Date.now();
      await redisCache.set(sessionKey, sessionData, 3600);

      return { success: true, sessionData };
    } catch (error) {
      console.error('Session retrieval error:', error);
      return { success: false, error: error.message };
    }
  }

  // 세션 무효화
  static async invalidateSession(walletAddress: string) {
    const sessionKey = `session:${walletAddress}`;
    
    try {
      await redisCache.del(sessionKey);
      await redisCache.client?.sRem('active:users', walletAddress);
      
      return { success: true };
    } catch (error) {
      console.error('Session invalidation error:', error);
      return { success: false, error: error.message };
    }
  }

  // 세션 갱신
  static async refreshSession(walletAddress: string, extendMinutes: number = 60) {
    const sessionKey = `session:${walletAddress}`;
    
    try {
      const sessionData = await redisCache.get(sessionKey);
      
      if (!sessionData) {
        return { success: false, error: 'Session not found' };
      }

      sessionData.lastActivity = Date.now();
      await redisCache.set(sessionKey, sessionData, extendMinutes * 60);

      return { success: true, sessionData };
    } catch (error) {
      console.error('Session refresh error:', error);
      return { success: false, error: error.message };
    }
  }

  // 활성 사용자 목록 조회
  static async getActiveUsers() {
    try {
      const activeUsers = await redisCache.client?.sMembers('active:users');
      return { success: true, activeUsers: activeUsers || [] };
    } catch (error) {
      console.error('Active users retrieval error:', error);
      return { success: false, error: error.message };
    }
  }

  // 만료된 세션 정리
  static async cleanupExpiredSessions() {
    try {
      const activeUsers = await redisCache.client?.sMembers('active:users');
      
      if (!activeUsers) return { success: true, cleaned: 0 };

      let cleanedCount = 0;
      
      for (const walletAddress of activeUsers) {
        const sessionKey = `session:${walletAddress}`;
        const exists = await redisCache.exists(sessionKey);
        
        if (!exists) {
          await redisCache.client?.sRem('active:users', walletAddress);
          cleanedCount++;
        }
      }

      return { success: true, cleaned: cleanedCount };
    } catch (error) {
      console.error('Session cleanup error:', error);
      return { success: false, error: error.message };
    }
  }

  // 세션 통계
  static async getSessionStats() {
    try {
      const activeUsers = await redisCache.client?.sMembers('active:users');
      const totalSessions = activeUsers?.length || 0;

      return {
        success: true,
        stats: {
          totalActiveSessions: totalSessions,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Session stats error:', error);
      return { success: false, error: error.message };
    }
  }
}