import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from './rateLimiter';

// 🎯 Rate Limiting 설정 (분당 200회로 여유롭게)
export const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1분 윈도우
  maxRequests: {
    general: 200,      // 일반 API: 분당 200개
    priceUpdate: 200,  // 가격 업데이트: 분당 200개
    websocket: 200,    // WebSocket: 분당 200개
    auth: 200          // 인증: 분당 200개
  }
};

export type RateLimitCategory = keyof typeof RATE_LIMIT_CONFIG.maxRequests;

/**
 * IP 주소 추출
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0].trim() || real || 'unknown';
}

/**
 * 엔드포인트 카테고리 결정
 */
export function getEndpointCategory(pathname: string): RateLimitCategory {
  if (pathname.includes('/api/price-updater') || pathname.includes('/api/chatroom-tokens')) {
    return 'priceUpdate';
  }
  if (pathname.includes('/api/auth')) {
    return 'auth';
  }
  if (pathname.includes('/api/websocket')) {
    return 'websocket';
  }
  if (pathname.includes('/api/rpc-stats') || pathname.includes('/api/solana-rpc')) {
    return 'priceUpdate';
  }
  return 'general';
}

/**
 * API Route에서 사용할 Rate Limit 미들웨어
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const rateLimitResult = await applyRateLimit(request);
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   // 정상 처리
 *   return NextResponse.json({ data: '...' });
 * }
 */
export async function applyRateLimit(
  request: NextRequest,
  category?: RateLimitCategory
): Promise<NextResponse | null> {
  try {
    const ip = getClientIP(request);
    const endpoint = category || getEndpointCategory(request.nextUrl.pathname);
    const limit = RATE_LIMIT_CONFIG.maxRequests[endpoint];
    const windowMs = RATE_LIMIT_CONFIG.windowMs;

    const rateLimitKey = `ratelimit:${ip}:${endpoint}`;
    const result = await checkRateLimit(rateLimitKey, limit, windowMs);

    // Rate Limit 초과 시 429 응답
    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: 'Too Many Requests',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      );

      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
      response.headers.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());

      return response;
    }

    // 통과 시 null 반환 (헤더는 응답에서 추가 가능하도록 result 반환 고려)
    return null;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // 에러 시 요청 허용 (Fail-open)
    return null;
  }
}

/**
 * Rate Limit 헤더를 응답에 추가하는 헬퍼
 */
export async function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  category?: RateLimitCategory
): Promise<NextResponse> {
  try {
    const ip = getClientIP(request);
    const endpoint = category || getEndpointCategory(request.nextUrl.pathname);
    const limit = RATE_LIMIT_CONFIG.maxRequests[endpoint];
    const windowMs = RATE_LIMIT_CONFIG.windowMs;

    const rateLimitKey = `ratelimit:${ip}:${endpoint}`;
    const result = await checkRateLimit(rateLimitKey, limit, windowMs);

    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

    return response;
  } catch (error) {
    console.error('Failed to add rate limit headers:', error);
    return response;
  }
}
