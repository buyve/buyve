import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, messageData } = body;

    // 토큰 주소 매핑
    const ROOM_TOKEN_MAPPING: Record<string, string> = {
      'bonk': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      'wif': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      'popcat': '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
      'gmemoon': 'BkQCf3NSxf8hHJMrBKrFLCYBg7tKKSjU9KEts4F2ukL',
      'retard': '9H2NFytqpRBS7L5UVvnHGbq6Uum1cet4uxkCqBudcvtu',
      'meme': 'CYkD9AsNYPvWxmnRdQN6Qd2MkK5t8RivxvSaKnmGVfmH',
      'anon': 'AnonGEfxT5BcedgCnU7EGdJhqxkHWLKfwjBQEjhvJLM6'
    };

    const tokenAddress = ROOM_TOKEN_MAPPING[roomId] || roomId;
    
    if (!tokenAddress) {
      return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
    }

    // 트랜잭션 해시가 없으면 임시 생성
    const signature = messageData.tx_hash || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 런타임에서만 Supabase 사용 (빌드 시 스킵)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co') {
      // 빌드 중이거나 환경 변수가 설정되지 않은 경우 mock 응답
      return NextResponse.json({ 
        success: true, 
        data: {
          signature,
          token_address: tokenAddress,
          sender_wallet: messageData.user_address,
          message_type: messageData.trade_type.toUpperCase(),
          content: messageData.content,
          quantity: messageData.trade_amount ? parseFloat(messageData.trade_amount) : null,
          price: null,
          block_time: new Date().toISOString(),
        }
      });
    }

    // 동적으로 Supabase 클라이언트 import
    const { supabaseAdmin } = await import('@/lib/supabase');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not available' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('message_cache')
      .insert({
        signature,
        token_address: tokenAddress,
        sender_wallet: messageData.user_address,
        message_type: messageData.trade_type.toUpperCase() as 'BUY' | 'SELL',
        content: messageData.content,
        quantity: messageData.trade_amount ? parseFloat(messageData.trade_amount) : null,
        price: null,
        block_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Message save error:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}