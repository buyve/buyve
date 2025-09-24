import { NextRequest, NextResponse } from 'next/server';

const GECKOTERMINAL_API_BASE = 'https://api.geckoterminal.com/api/v2';

// Solana 주요 토큰의 실제 풀 주소 매핑 (GeckoTerminal에서 확인된 실제 주소)
const SOLANA_TOKEN_POOLS: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE', // SOL/USDC Orca
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE', // USDC/SOL
  // 기본값으로 SOL/USDC Orca 풀 사용
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token');
    const period = searchParams.get('period') || '1D';

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // 토큰 주소를 풀 주소로 변환
    const poolAddress = SOLANA_TOKEN_POOLS[tokenAddress] || SOLANA_TOKEN_POOLS['So11111111111111111111111111111111111111112'];
    
    // 시간 기간 매핑 (GeckoTerminal API v2 형식)
    const getTimeframe = (period: string) => {
      switch (period) {
        case '1H':
          return { timeframe: 'hour', aggregate: '1' };
        case '1D':
          return { timeframe: 'day', aggregate: '1' };
        case '1W':
          return { timeframe: 'week', aggregate: '1' };
        case '1M':
          return { timeframe: 'month', aggregate: '1' };
        case 'All':
          return { timeframe: 'day', aggregate: '30' };
        default:
          return { timeframe: 'day', aggregate: '1' };
      }
    };

    const { timeframe, aggregate } = getTimeframe(period);
    
    
    // GeckoTerminal API v2 호출
    const url = `${GECKOTERMINAL_API_BASE}/networks/solana/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&before_timestamp=${Math.floor(Date.now() / 1000)}&limit=100`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NextJS-ChartApp/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.data?.attributes?.ohlcv_list) {
      throw new Error('No OHLCV data found');
    }

    // OHLCV 데이터를 차트 포인트로 변환
    const ohlcvList = result.data.attributes.ohlcv_list;
    const chartData = ohlcvList.map((ohlcv: number[]) => ({
      timestamp: ohlcv[0] * 1000, // GeckoTerminal은 초 단위이므로 밀리초로 변환
      price: ohlcv[4], // Close price 사용
    }));


    return NextResponse.json({
      success: true,
      data: chartData,
      metadata: {
        pool: poolAddress,
        period,
        timeframe,
        count: chartData.length,
      },
    });

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