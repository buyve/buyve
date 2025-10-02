import { NextRequest, NextResponse } from 'next/server';
import { tokenPriceService, DEFAULT_TOKENS } from '@/lib/tokenPriceService';
import { chatRoomTokenCollector } from '@/lib/chatRoomTokenCollector';

// ⏰ 가격 데이터 수집 크론 작업
// 주기적 크론이 tokenPriceService.updateTokenPrice를 호출해 DB를 채우는 구조로,
// 확장 토큰은 배치 업데이트를 사용하며, 배치 실패 시 개별 호출로 내려갑니다.
// 성공·실패 통계는 응답으로 남겨 모니터링할 수 있게 되어 있습니다.
export async function GET(request: NextRequest) {
  try {
    // 인증 헤더 확인 (선택사항 - 보안 강화용)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    // 1. 모든 토큰 주소 수집
    const chatRoomTokens = await chatRoomTokenCollector.getAllChatRoomTokens();
    const allTokens = [...DEFAULT_TOKENS, ...chatRoomTokens.filter(token => !DEFAULT_TOKENS.includes(token))];

    // 2. 배치 방식으로 모든 토큰 가격 업데이트 (확장 토큰은 배치 업데이트 사용)
    const batchSuccess = await tokenPriceService.updateMultipleTokenPricesBatch(allTokens);

    let defaultResults: any[] = [];
    let chatRoomResult: any = { totalTokens: 0, successfulUpdates: 0, failedTokens: [], details: [] };

    if (batchSuccess) {
      // 배치 성공 시 모든 토큰을 성공으로 처리
      defaultResults = DEFAULT_TOKENS.map(tokenAddress => ({
        status: 'fulfilled' as const,
        value: { tokenAddress, success: true, source: 'default' }
      }));

      chatRoomResult = {
        totalTokens: chatRoomTokens.length,
        successfulUpdates: chatRoomTokens.length,
        failedTokens: [],
        details: chatRoomTokens.map(tokenAddress => ({
          tokenAddress,
          success: true,
          source: 'chatroom'
        }))
      };
    } else {
      // 배치 실패 시 개별 호출로 내려감
      console.log('Batch update failed, falling back to individual updates');

      defaultResults = await Promise.allSettled(
        DEFAULT_TOKENS.map(async (tokenAddress) => {
          try {
            const success = await tokenPriceService.updateTokenPrice(tokenAddress);
            return { tokenAddress, success, source: 'default' };
          } catch (error) {
            return { tokenAddress, success: false, error, source: 'default' };
          }
        })
      );

      chatRoomResult = await chatRoomTokenCollector.collectAllChatRoomTokenPrices();
    }

    // 결과 통합
    const chatRoomResults = chatRoomResult.details.map(detail => ({
      status: 'fulfilled' as const,
      value: {
        tokenAddress: detail.tokenAddress,
        success: detail.success,
        source: 'chatroom',
        error: detail.error
      }
    }));

    const results = [...defaultResults, ...chatRoomResults];

    // 결과 분석
    const successful = results.filter(result =>
      result.status === 'fulfilled' && result.value.success
    ).length;

    const failed = results.filter(result =>
      result.status === 'rejected' || !result.value.success
    );

    const duration = Date.now() - startTime;

    // 소스별 통계
    const defaultSuccessful = defaultResults.filter(result =>
      result.status === 'fulfilled' && result.value.success
    ).length;

    const totalTokens = DEFAULT_TOKENS.length + chatRoomResult.totalTokens;



    // 성공·실패 통계는 응답으로 남겨 모니터링할 수 있게 되어 있습니다
    return NextResponse.json({
      success: true,
      message: `가격 데이터 수집 완료 (${batchSuccess ? '배치 처리' : '개별 처리'})`,
      batchProcessed: batchSuccess,
      stats: {
        defaultTokens: {
          total: DEFAULT_TOKENS.length,
          successful: defaultSuccessful,
          failed: DEFAULT_TOKENS.length - defaultSuccessful
        },
        chatRoomTokens: {
          total: chatRoomResult.totalTokens,
          successful: chatRoomResult.successfulUpdates,
          failed: chatRoomResult.failedTokens.length
        },
        overall: {
          total: totalTokens,
          successful,
          failed: failed.length,
          duration: `${duration}ms`
        }
      },
      tokens: {
        default: DEFAULT_TOKENS,
        chatRooms: chatRoomResult.details.map(d => d.tokenAddress)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '가격 수집 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST로도 수동 실행 가능
export async function POST(request: NextRequest) {
  return GET(request);
} 