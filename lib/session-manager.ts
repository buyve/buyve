import { redisCache } from './redis-cache';

export class SessionManager {
  // Create session
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
      // Save session (1 hour)
      await redisCache.set(sessionKey, sessionData, 3600);

      // Add to active users set
      await redisCache.client?.sAdd('active:users', walletAddress);

      return { success: true, sessionData };
    } catch (error) {
      console.error('Session creation error:', error);
      return { success: false, error: error.message };
    }
  }

  // Retrieve session
  static async getSession(walletAddress: string) {
    const sessionKey = `session:${walletAddress}`;

    try {
      const sessionData = await redisCache.get(sessionKey);

      if (!sessionData) {
        return { success: false, error: 'Session not found' };
      }

      // Update last activity time
      sessionData.lastActivity = Date.now();
      await redisCache.set(sessionKey, sessionData, 3600);

      return { success: true, sessionData };
    } catch (error) {
      console.error('Session retrieval error:', error);
      return { success: false, error: error.message };
    }
  }

  // Invalidate session
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

  // Refresh session
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

  // Get active users list
  static async getActiveUsers() {
    try {
      const activeUsers = await redisCache.client?.sMembers('active:users');
      return { success: true, activeUsers: activeUsers || [] };
    } catch (error) {
      console.error('Active users retrieval error:', error);
      return { success: false, error: error.message };
    }
  }

  // Clean up expired sessions
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

  // Session statistics
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