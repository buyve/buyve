import { NextRequest, NextResponse } from 'next/server';
import { unifiedPriceManager } from '@/lib/unifiedPriceManager';

// 🎯 통일된 실시간 가격 브로드캐스트 API
// Jupiter v6 기반 단일 데이터 소스
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens, syncToDatabase = false } = body;
    
    if (!tokens || !Array.isArray(tokens)) {
      return NextResponse.json({
        success: false,
        error: 'tokens 배열이 필요합니다'
      }, { status: 400 });
    }

    let updatedTokens = 0;
    const results = [];

    // 각 토큰에 대해 통일된 가격 업데이트
    for (const tokenAddress of tokens) {
      try {
        // 통일된 가격 매니저를 통해 가격 구독
        const pricePromise = new Promise(async (resolve) => {
          const unsubscribe = await unifiedPriceManager.subscribeToPrice(
            tokenAddress, 
            (data) => {
              resolve(data);
              unsubscribe();
            }
          );
        });

        const priceData = await Promise.race([
          pricePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          )
        ]) as any;

        // 옵션: 데이터베이스 동기화
        if (syncToDatabase) {
          await unifiedPriceManager.syncPriceToDatabase(tokenAddress);
        }

        results.push({
          tokenAddress,
          success: true,
          symbol: (priceData as any).symbol,
          price: (priceData as any).price,
          priceChange24h: (priceData as any).priceChange24h,
          priceChangePercent: (priceData as any).priceChangePercent,
          hasHistory: (priceData as any).hasHistory,
          source: (priceData as any).source,
          timestamp: (priceData as any).timestamp
        });
        
        updatedTokens++;
      } catch (error) {
        results.push({
          tokenAddress,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedTokens,
        totalTokens: tokens.length,
        results,
        unified: true
      },
      message: `${updatedTokens}개 토큰 통일된 가격 업데이트 완료`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '통일된 가격 브로드캐스트 실패',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET 요청으로 특정 토큰의 통일된 가격 상태 확인
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token');
    
    if (!tokenAddress) {
      return NextResponse.json({
        success: false,
        error: 'token 파라미터가 필요합니다'
      }, { status: 400 });
    }

    // 통일된 가격 정보 확인
    const pricePromise = new Promise(async (resolve) => {
      const unsubscribe = await unifiedPriceManager.subscribeToPrice(
        tokenAddress, 
        (data) => {
          resolve(data);
          unsubscribe();
        }
      );
    });

    const priceData = await Promise.race([
      pricePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
    ]) as any;

    return NextResponse.json({
      success: true,
      data: {
        tokenAddress,
        symbol: (priceData as any).symbol,
        currentPrice: (priceData as any).price,
        priceChange24h: (priceData as any).priceChange24h,
        priceChangePercent: (priceData as any).priceChangePercent,
        hasHistory: (priceData as any).hasHistory,
        source: (priceData as any).source,
        timestamp: (priceData as any).timestamp,
        unified: true
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '통일된 가격 정보 조회 실패',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}