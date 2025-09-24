import { NextRequest, NextResponse } from 'next/server';
import { tokenPriceService, DEFAULT_TOKENS } from '@/lib/tokenPriceService';
import { headers } from 'next/headers';

// 🔄 Vercel Cron Job을 위한 가격 수집 API
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Job 인증 확인
    const authHeader = headers().get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // 프로덕션에서는 보안 체크
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 가격 업데이트 실행
    const startTime = Date.now();
    const results = await Promise.allSettled(
      DEFAULT_TOKENS.map(token => tokenPriceService.updateTokenPrice(token))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      stats: {
        successful,
        failed,
        total: results.length,
        duration: `${Date.now() - startTime}ms`
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to collect prices'
    }, { status: 500 });
  }
}

// Vercel에서는 cron 설정을 지원
export const runtime = 'edge';
export const dynamic = 'force-dynamic';