import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 환경 변수 확인 (값은 일부만 표시)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const debugInfo = {
      environment: process.env.NODE_ENV,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET',
      supabaseAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'NOT SET',
      supabaseServiceKey: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 10)}...` : 'NOT SET',
      isPlaceholder: supabaseUrl === 'https://placeholder.supabase.co',
    };

    // Supabase 연결 테스트
    let connectionTest = { status: 'not tested', error: null, data: null };
    
    try {
      const { supabase } = await import('@/lib/supabase');
      
      if (supabase && !debugInfo.isPlaceholder) {
        const { data, error } = await supabase
          .from('message_cache')
          .select('count')
          .limit(1);
          
        connectionTest = {
          status: error ? 'failed' : 'success',
          error: error ? error.message : null,
          data: data ? 'Connected successfully' : null
        };
      } else {
        connectionTest = {
          status: 'skipped',
          error: 'Supabase client not available or using placeholder URL',
          data: null
        };
      }
    } catch (err) {
      connectionTest = {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        data: null
      };
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      connectionTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}