import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_TOKENS } from '@/lib/tokenPriceService';

// 🔍 데이터베이스 상태 확인 API
export async function GET() {
  try {
    
    // 전체 토큰 가격 히스토리 개수 조회
    const { count: totalCount } = await supabase
      .from('token_price_history')
      .select('*', { count: 'exact', head: true });


    // 각 토큰별 데이터 확인
    const tokenStatus = await Promise.all(
      DEFAULT_TOKENS.map(async (tokenAddress) => {
        const { data, error, count } = await supabase
          .from('token_price_history')
          .select('*', { count: 'exact' })
          .eq('token_address', tokenAddress)
          .order('timestamp_1min', { ascending: false })
          .limit(5);

        return {
          tokenAddress,
          count: count || 0,
          error: error?.message || null,
          latestRecords: data || [],
          hasData: (count || 0) > 0
        };
      })
    );

    // 최근 1분 데이터 확인
    const now = new Date();
    const currentSlot = new Date(now);
    currentSlot.setSeconds(0, 0);
    
    const { data: recentData, error: recentError } = await supabase
      .from('token_price_history')
      .select('*')
      .gte('timestamp_1min', currentSlot.toISOString())
      .order('timestamp_1min', { ascending: false });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        totalRecords: totalCount || 0,
        hasAnyData: (totalCount || 0) > 0
      },
      tokens: tokenStatus,
      recent: {
        currentTimeSlot: currentSlot.toISOString(),
        recentRecords: recentData || [],
        error: recentError?.message || null
      },
      debugInfo: {
        now: now.toISOString(),
        normalizedSlot: currentSlot.toISOString(),
        secondsInSlot: now.getSeconds()
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'DB 상태 확인 중 오류 발생',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 