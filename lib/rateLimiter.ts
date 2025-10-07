import { createClient } from 'redis';

// Create Redis client
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected for rate limiting');
    });

    await redisClient.connect();
  }

  return redisClient;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Redis-based Rate Limiter
 * @param key - Rate limit key (e.g., "ratelimit:192.168.1.1:general")
 * @param limit - Request limit count
 * @param windowMs - Time window (milliseconds)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const client = await getRedisClient();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis Transaction
    const multi = client.multi();

    // 1. Remove old requests outside time window
    multi.zRemRangeByScore(key, 0, windowStart);

    // 2. Check request count within current window
    multi.zCard(key);

    // 3. Add current request
    multi.zAdd(key, { score: now, value: `${now}` });

    // 4. Set key expiration time (window size + buffer)
    multi.expire(key, Math.ceil(windowMs / 1000) + 10);

    const results = await multi.exec();

    // zCard result (index 1)
    const currentCount = (results?.[1] as number) || 0;
    const remaining = Math.max(0, limit - currentCount - 1);
    const allowed = currentCount < limit;

    return {
      allowed,
      remaining,
      resetTime: now + windowMs,
      limit
    };
  } catch (error) {
    console.error('Rate limiter error:', error);

    // Allow request on Redis error (Fail-open)
    return {
      allowed: true,
      remaining: limit,
      resetTime: Date.now() + windowMs,
      limit
    };
  }
}

/**
 * Initialize Rate Limiter (call on server start)
 */
export async function initRateLimiter() {
  try {
    await getRedisClient();
    console.log('✅ Rate Limiter initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Rate Limiter:', error);
  }
}

/**
 * Close Rate Limiter (call on server shutdown)
 */
export async function closeRateLimiter() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ Rate Limiter closed');
  }
}
