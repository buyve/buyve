import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 마이그레이션 상태 확인 API
export async function GET() {
  try {
    // 1. 현재 컬럼 확인을 위한 쿼리
    let columnCheck = { hasTimestamp1min: false, hasTimestamp15min: false };
    
    // timestamp_1min으로 쿼리 시도
    try {
      const { data: test1min, error: error1min } = await supabase
        .from('token_price_history')
        .select('timestamp_1min')
        .limit(1);
      
      if (!error1min) {
        columnCheck.hasTimestamp1min = true;
      }
    } catch (e) {
      // 컬럼이 없음
    }

    // timestamp_15min으로 쿼리 시도
    try {
      const { data: test15min, error: error15min } = await supabase
        .from('token_price_history')
        .select('timestamp_15min')
        .limit(1);
      
      if (!error15min) {
        columnCheck.hasTimestamp15min = true;
      }
    } catch (e) {
      // 컬럼이 없음
    }

    // 2. 데이터 통계
    const { count: totalCount } = await supabase
      .from('token_price_history')
      .select('*', { count: 'exact', head: true });

    // 3. 각 토큰별 레코드 수
    const { data: tokenStats } = await supabase
      .rpc('get_token_record_counts')
      .single();

    // RPC가 없으면 수동으로 계산
    let tokenCounts = {};
    if (!tokenStats) {
      const { data: allTokens } = await supabase
        .from('token_price_history')
        .select('token_address');
      
      if (allTokens) {
        const counts = allTokens.reduce((acc: any, row: any) => {
          acc[row.token_address] = (acc[row.token_address] || 0) + 1;
          return acc;
        }, {});
        tokenCounts = counts;
      }
    }

    // 4. 최근 데이터 샘플
    const { data: recentData } = await supabase
      .from('token_price_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      migrationStatus: {
        isCompleted: columnCheck.hasTimestamp1min && !columnCheck.hasTimestamp15min,
        currentColumn: columnCheck.hasTimestamp1min ? 'timestamp_1min' : 'timestamp_15min',
        columnCheck
      },
      dataStats: {
        totalRecords: totalCount || 0,
        tokenCounts: Object.keys(tokenCounts).length > 0 ? tokenCounts : 'Unable to calculate',
        recentDataSample: recentData?.slice(0, 2) || []
      },
      recommendation: columnCheck.hasTimestamp1min 
        ? "✅ 마이그레이션 완료! 1분 간격 데이터를 사용할 수 있습니다."
        : "⚠️ 마이그레이션이 필요합니다. SQL 스크립트를 실행하세요.",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '마이그레이션 상태 확인 중 오류 발생',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}