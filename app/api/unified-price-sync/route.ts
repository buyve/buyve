import { NextRequest, NextResponse } from 'next/server';
import { unifiedPriceManager } from '@/lib/unifiedPriceManager';

// 🎯 통일된 가격 데이터베이스 동기화 API
// Jupiter v6 → Database 동기화 전용 엔드포인트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens } = body;
    
    if (!tokens || !Array.isArray(tokens)) {
      return NextResponse.json({
        success: false,
        error: 'tokens 배열이 필요합니다'
      }, { status: 400 });
    }

    let syncedTokens = 0;
    const results = [];

    // 각 토큰에 대해 데이터베이스 동기화
    for (const tokenAddress of tokens) {
      try {
        const success = await unifiedPriceManager.syncPriceToDatabase(tokenAddress);
        
        if (success) {
          syncedTokens++;
          results.push({
            tokenAddress,
            success: true,
            message: '데이터베이스 동기화 완료'
          });
        } else {
          results.push({
            tokenAddress,
            success: false,
            error: '동기화 실패'
          });
        }
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
        syncedTokens,
        totalTokens: tokens.length,
        results
      },
      message: `${syncedTokens}개 토큰 데이터베이스 동기화 완료`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '데이터베이스 동기화 실패',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET 요청으로 동기화 상태 확인
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

    // 동기화 상태 확인
    const success = await unifiedPriceManager.syncPriceToDatabase(tokenAddress);
    
    return NextResponse.json({
      success: true,
      data: {
        tokenAddress,
        synced: success,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '동기화 상태 확인 실패',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}