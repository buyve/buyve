import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, 
  maxRequests: {
    general: 100,        
    priceUpdate: 60,      
    websocket: 200,      
    auth: 30             
  }
};

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || real || 'unknown';
}

function getEndpointCategory(pathname: string): keyof typeof RATE_LIMIT_CONFIG.maxRequests {
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

function checkRateLimit(ip: string, category: keyof typeof RATE_LIMIT_CONFIG.maxRequests): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.maxRequests[category],
    resetTime: Date.now() + RATE_LIMIT_CONFIG.windowMs
  };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/api/')) {
    const ip = getRateLimitKey(request);
    const category = getEndpointCategory(pathname);
    
    try {
      const rateLimit = checkRateLimit(ip, category);
      
      const response = rateLimit.allowed 
        ? NextResponse.next()
        : NextResponse.json(
            { 
              error: 'Too Many Requests',
              message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
              retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
            },
            { status: 429 }
          );
      
      response.headers.set('X-RateLimit-Limit', RATE_LIMIT_CONFIG.maxRequests[category].toString());
      response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
      response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
      
      if (!rateLimit.allowed) {
        response.headers.set('Retry-After', Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString());
      }
      
      return response;
    } catch (error) {
      console.error('Rate limiting error, allowing request:', error);
      return NextResponse.next();
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
}; 