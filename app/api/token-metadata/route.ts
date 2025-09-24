import { NextRequest, NextResponse } from 'next/server';
import { CacheManager } from '@/lib/cache-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uri = searchParams.get('uri');

    if (!uri) {
      return NextResponse.json(
        { error: 'URI parameter is required' },
        { status: 400 }
      );
    }

    // URI 유효성 검사
    if (!uri.startsWith('https://') && !uri.startsWith('http://')) {
      return NextResponse.json(
        { error: 'Invalid URI format' },
        { status: 400 }
      );
    }

    // 캐시에서 메타데이터 확인
    const cachedMetadata = await CacheManager.getTokenMetadata(uri);
    if (cachedMetadata.fromCache) {
      return NextResponse.json(cachedMetadata.data, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'HIT'
        }
      });
    }


    // 서버 사이드에서 메타데이터 fetch
    const response = await fetch(uri, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TokenMetadataBot/1.0)',
        'Accept': 'application/json, text/plain, */*',
      },
      // 타임아웃 설정
      signal: AbortSignal.timeout(10000) // 10초
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch metadata: ${response.status}` },
        { status: response.status }
      );
    }

    const metadata = await response.json();

    // 캐시에 저장 (1시간)
    await CacheManager.setTokenMetadata(uri, metadata);

    // CORS 헤더 추가
    return NextResponse.json(metadata, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600', // 1시간 캐시
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 