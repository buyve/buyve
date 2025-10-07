import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from './rateLimiter';

// Rate limiting configuration (generous 200 requests per minute)
export const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: {
    general: 200,      // General API: 200 per minute
    priceUpdate: 200,  // Price updates: 200 per minute
    websocket: 200,    // WebSocket: 200 per minute
    auth: 200          // Authentication: 200 per minute
  }
};

export type RateLimitCategory = keyof typeof RATE_LIMIT_CONFIG.maxRequests;

/**
 * Extract client IP address
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0].trim() || real || 'unknown';
}

/**
 * Determine endpoint category
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
 * Rate limit middleware for API routes
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const rateLimitResult = await applyRateLimit(request);
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   // Normal processing
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

    // Return 429 response when rate limit exceeded
    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Too many requests. Please try again later.',
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

    // Return null on pass (consider returning result to add headers in response)
    return null;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request on error (fail-open)
    return null;
  }
}

/**
 * Helper to add rate limit headers to response
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
