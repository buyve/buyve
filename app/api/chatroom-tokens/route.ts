import { NextRequest, NextResponse } from 'next/server';
import { chatRoomTokenCollector } from '@/lib/chatRoomTokenCollector';

// 🏠 채팅방 토큰 가격 수집 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'collect';

    switch (action) {
      case 'list': {
        // 채팅방의 모든 토큰 주소 조회
        const tokens = await chatRoomTokenCollector.getAllChatRoomTokens();
        
        return NextResponse.json({
          success: true,
          data: {
            totalTokens: tokens.length,
            tokens,
            message: `${tokens.length}개의 토큰 주소 발견`
          }
        });
      }

      case 'active': {
        // 활성 채팅방의 토큰만 조회
        const activeTokens = await chatRoomTokenCollector.collectActiveChatRoomTokens();
        
        return NextResponse.json({
          success: true,
          data: {
            totalActiveTokens: activeTokens.length,
            tokens: activeTokens,
            message: `${activeTokens.length}개의 활성 토큰 발견`
          }
        });
      }

      case 'collect':
      default: {
        // 모든 채팅방 토큰의 가격 수집
        const result = await chatRoomTokenCollector.collectAllChatRoomTokenPrices();
        
        return NextResponse.json({
          success: result.success,
          data: result,
          message: result.success 
            ? `${result.successfulUpdates}/${result.totalTokens} 토큰 가격 수집 완료`
            : '가격 수집 중 오류 발생'
        });
      }
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '채팅방 토큰 처리 중 서버 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST: 특정 채팅방의 토큰 등록 및 즉시 수집
export async function POST(request: NextRequest) {
  try {
    const { roomId, tokenAddress } = await request.json();

    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'roomId가 필요합니다'
      }, { status: 400 });
    }

    const success = await chatRoomTokenCollector.onNewChatRoomCreated(roomId, tokenAddress);

    return NextResponse.json({
      success,
      data: {
        roomId,
        tokenAddress,
        priceCollectionStarted: success
      },
      message: success 
        ? '새 채팅방 토큰 등록 및 가격 수집 시작 성공'
        : '토큰 등록은 성공했지만 가격 수집에 실패'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '채팅방 토큰 등록 중 서버 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 