import { NextRequest, NextResponse } from 'next/server';
import { tokenPriceService } from '@/lib/tokenPriceService';
import { supabase } from '@/lib/supabase';

// 공개 API - 인증 없이 접근 가능
export async function GET(request: NextRequest) {
  try {
    // IP 확인 (선택적 보안)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    console.log(`Price collection requested from IP: ${ip}`);

    // 등록된 모든 토큰 가져오기
    const { data: chatRooms } = await supabase
      .from('chat_rooms')
      .select('token_address')
      .not('token_address', 'is', null)
      .not('token_address', 'eq', '');

    const uniqueTokens = [...new Set(chatRooms?.map(room => room.token_address) || [])];
    
    if (uniqueTokens.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No tokens found'
      });
    }

    // 모든 토큰 가격 업데이트
    const startTime = Date.now();
    const results = await Promise.allSettled(
      uniqueTokens.map(token => tokenPriceService.updateTokenPrice(token))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      stats: {
        total: uniqueTokens.length,
        successful,
        failed,
        duration: `${Date.now() - startTime}ms`
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to collect prices'
    }, { status: 500 });
  }
}

// POST도 지원
export async function POST(request: NextRequest) {
  return GET(request);
}