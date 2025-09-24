import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 데이터베이스 스키마 확인 API
export async function GET() {
  try {
    // 1. 테이블 구조 확인
    const { data: columns, error: columnsError } = await supabase
      .from('token_price_history')
      .select('*')
      .limit(0); // 메타데이터만 가져옴

    // 2. 실제 컬럼 목록 확인 (information_schema 쿼리)
    const { data: schemaInfo, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'token_price_history' })
      .single();

    // 3. 최근 데이터 확인 (어떤 컬럼이든)
    const { data: recentData, error: dataError } = await supabase
      .from('token_price_history')
      .select('*')
      .limit(1);

    // 4. 간단한 테스트 쿼리
    let testQuery1 = null;
    let testQuery2 = null;
    let test1Error = null;
    let test2Error = null;

    try {
      const { data, error } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', 'So11111111111111111111111111111111111111112')
        .order('created_at', { ascending: false })
        .limit(1);
      testQuery1 = data;
      test1Error = error;
    } catch (e) {
      test1Error = e;
    }

    // 5. 전체 레코드 수 확인
    const { count, error: countError } = await supabase
      .from('token_price_history')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      schemaCheck: {
        columnsError: columnsError?.message || null,
        schemaError: schemaError?.message || null,
        dataError: dataError?.message || null,
        hasData: !!recentData && recentData.length > 0,
        totalRecords: count || 0
      },
      recentData: recentData?.[0] || null,
      testQueries: {
        basicQuery: {
          data: testQuery1,
          error: test1Error?.message || null
        }
      },
      availableColumns: recentData?.[0] ? Object.keys(recentData[0]) : [],
      debug: {
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set'
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '스키마 확인 중 오류 발생',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}