import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CacheManager } from '@/lib/cache-manager';

// 데이터베이스 기반 차트 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token');

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // 캐시에서 차트 데이터 확인
    const cachedChart = await CacheManager.getChartData(tokenAddress);
    if (cachedChart.fromCache) {
      return NextResponse.json({
        ...cachedChart.data,
        cached: true
      });
    }

    // 1분 간격 데이터를 조회 (최대 60개)
    const { data, error } = await supabase
      .from('token_price_history')
      .select('*')
      .eq('token_address', tokenAddress)
      .order('timestamp_1min', { ascending: true })
      .limit(60);

    if (error) {
      // timestamp_1min 컬럼이 없는 경우, 기존 컬럼으로 폴백
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', tokenAddress)
        .order('timestamp_15min', { ascending: true })
        .limit(60);

      if (fallbackError) {
        throw new Error(`Database error: ${fallbackError.message}`);
      }

      // 15분 데이터를 차트 형식으로 변환
      const chartData = (fallbackData || []).map(record => ({
        timestamp: new Date(record.timestamp_15min).getTime(),
        price: record.close_price || record.price,
        open: record.open_price,
        high: record.high_price,
        low: record.low_price,
        close: record.close_price,
        volume: record.volume || 0
      }));

      const response = {
        success: true,
        data: chartData,
        metadata: {
          tokenAddress,
          count: chartData.length,
          interval: '15min',
          fallback: true
        }
      };

      // 캐시에 저장
      await CacheManager.setChartData(tokenAddress, response);

      return NextResponse.json(response);
    }

    // 1분 데이터를 차트 형식으로 변환
    const chartData = (data || []).map(record => ({
      timestamp: new Date(record.timestamp_1min).getTime(),
      price: record.close_price || record.price,
      open: record.open_price,
      high: record.high_price,
      low: record.low_price,
      close: record.close_price,
      volume: record.volume || 0
    }));

    const response = {
      success: true,
      data: chartData,
      metadata: {
        tokenAddress,
        count: chartData.length,
        interval: '1min'
      }
    };

    // 캐시에 저장
    await CacheManager.setChartData(tokenAddress, response);

    return NextResponse.json(response);

  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch chart data',
        success: false,
      },
      { status: 500 }
    );
  }
}