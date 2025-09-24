import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabaseAdmin } from '@/lib/supabase';

// GET: 컨트랙트 주소 중복 체크
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');

    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: '컨트랙트 주소가 필요합니다.' },
        { status: 400 }
      );
    }

    // 컨트랙트 주소 형식 검증
    try {
      new PublicKey(contractAddress);
    } catch {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 컨트랙트 주소입니다.' },
        { status: 400 }
      );
    }

    // Supabase에서 중복 체크
    const { data: existingRoom, error: dbError } = await supabaseAdmin
      .from('chat_rooms')
      .select('token_address')
      .eq('token_address', contractAddress.trim())
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 = No rows found
      return NextResponse.json(
        { success: false, error: '중복 체크 중 데이터베이스 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const exists = !!existingRoom;

    return NextResponse.json({
      success: true,
      exists,
      message: exists 
        ? '이미 해당 컨트랙트 주소로 생성된 채팅방이 존재합니다.' 
        : '사용 가능한 컨트랙트 주소입니다.'
    });

  } catch {
    return NextResponse.json(
      { success: false, error: '중복 체크 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 