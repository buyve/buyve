import { NextRequest, NextResponse } from 'next/server';
import { tokenPriceService, DEFAULT_TOKENS } from '@/lib/tokenPriceService';

// 🔄 토큰 가격 업데이트 API 엔드포인트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tokens } = body;
    
    // 업데이트할 토큰 목록 결정
    const tokensToUpdate = tokens && Array.isArray(tokens) ? tokens : DEFAULT_TOKENS;
    
    // 모든 토큰의 가격을 병렬로 업데이트
    await tokenPriceService.updateMultipleTokenPrices(tokensToUpdate);
    
    return NextResponse.json({
      success: true,
      message: `${tokensToUpdate.length}개 토큰 가격 업데이트 완료`,
      tokens: tokensToUpdate,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '가격 업데이트 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET 요청으로 현재 가격 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token') || DEFAULT_TOKENS[0];
    
    
    // 가격 히스토리 조회
    const priceHistory = await tokenPriceService.getTokenPriceHistory(tokenAddress);
    const latestPrice = await tokenPriceService.getLatestTokenPrice(tokenAddress);
    
    // 차트용 데이터 포맷
    const chartData = tokenPriceService.formatForChart(priceHistory);
    
    // 가격 변화율 계산
    let priceChange = 0;
    if (priceHistory.length >= 2) {
      const oldestPrice = priceHistory[0].open_price;
      const currentPrice = latestPrice || priceHistory[priceHistory.length - 1].close_price;
      priceChange = ((currentPrice - oldestPrice) / oldestPrice) * 100;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        tokenAddress,
        currentPrice: latestPrice,
        priceChange,
        historyCount: priceHistory.length,
        chartData,
        rawHistory: priceHistory,
        lastUpdated: priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].timestamp_1min : null
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '가격 조회 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 