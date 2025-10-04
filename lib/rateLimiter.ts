import { createClient } from 'redis';

// Redis 클라이언트 생성
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
 * Redis 기반 Rate Limiter
 * @param key - Rate limit 키 (예: "ratelimit:192.168.1.1:general")
 * @param limit - 제한 횟수
 * @param windowMs - 시간 윈도우 (밀리초)
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

    // Redis Transaction 사용
    const multi = client.multi();

    // 1. 시간 윈도우 밖의 오래된 요청 삭제
    multi.zRemRangeByScore(key, 0, windowStart);

    // 2. 현재 윈도우 내의 요청 개수 확인
    multi.zCard(key);

    // 3. 현재 요청 추가
    multi.zAdd(key, { score: now, value: `${now}` });

    // 4. 키 만료 시간 설정 (윈도우 크기 + 여유)
    multi.expire(key, Math.ceil(windowMs / 1000) + 10);

    const results = await multi.exec();

    // zCard 결과 (인덱스 1)
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

    // Redis 에러 시 요청 허용 (Fail-open)
    return {
      allowed: true,
      remaining: limit,
      resetTime: Date.now() + windowMs,
      limit
    };
  }
}

/**
 * Rate Limiter 초기화 (서버 시작 시 호출)
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
 * Rate Limiter 종료 (서버 종료 시 호출)
 */
export async function closeRateLimiter() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ Rate Limiter closed');
  }
}
