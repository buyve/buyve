import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { CacheManager } from '@/lib/cache-manager';
import { SessionManager } from '@/lib/session-manager';

// 토큰에서 지갑 주소 추출 유틸리티
function extractTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // "Bearer " 제거
}

// GET - 프로필 조회
export async function GET(request: NextRequest) {
  try {
    // URL 파라미터에서 wallet_address 추출
    const { searchParams } = new URL(request.url);
    const wallet_address = searchParams.get('wallet_address');

    console.log(`[PROFILES API] GET request received`);
    console.log(`[PROFILES API] URL: ${request.url}`);
    console.log(`[PROFILES API] User-Agent: ${request.headers.get('User-Agent')}`);
    console.log(`[PROFILES API] Extracted wallet_address: ${wallet_address}`);

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // 런타임에서 Supabase 사용
    const { supabaseAdmin } = await import('@/lib/supabase');
    
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 503 }
      );
    }

    // 사용자 프로필 조회
    console.log(`[PROFILES API] Querying profile for wallet: ${wallet_address}`);
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('wallet_address', wallet_address)
      .single();
    
    console.log(`[PROFILES API] Query result:`, { profile, error });

    if (error) {
      // 프로필이 없는 경우는 에러가 아니라 빈 결과로 처리
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          profile: null
        });
      }
      return NextResponse.json(
        { error: 'Failed to fetch profile', details: error.message },
        { status: 500 }
      );
    }


    return NextResponse.json({
      success: true,
      profile
    }, {
      headers: {
        // 프로필 데이터를 5분간 캐시
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'
      }
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 프로필 저장/업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, nickname, avatar_url } = body;


    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const profileData = {
      wallet_address,
      nickname: nickname || null,
      avatar_url: avatar_url || null,
      updated_at: new Date().toISOString()
    };


    // 런타임에서 Supabase 사용
    const { supabaseAdmin } = await import('@/lib/supabase');
    
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 503 }
      );
    }

    // UPSERT (insert or update)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        profileData,
        {
          onConflict: 'wallet_address',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save profile', details: error.message },
        { status: 500 }
      );
    }

    // 프로필 캐시 무효화
    await CacheManager.invalidateUserData(wallet_address);
    // 세션도 무효화
    await SessionManager.invalidateSession(wallet_address);

    return NextResponse.json({
      success: true,
      profile: data
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - 사용자 프로필 업데이트
export async function PUT(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request);

    if (!token) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // JWT 토큰 검증
    const decoded = verifyJWT(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nickname, avatar } = body;

    // 업데이트할 데이터 준비
    const updateData: { nickname?: string; avatar?: string; updated_at: string } = {
      updated_at: new Date().toISOString()
    };

    if (nickname !== undefined) {
      updateData.nickname = nickname;
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }

    // 런타임에서 Supabase 사용
    const { supabase } = await import('@/lib/supabase');
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 503 }
      );
    }

    // 프로필 업데이트
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('wallet_address', decoded.walletAddress)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    // 프로필 캐시 무효화
    await CacheManager.invalidateUserData(decoded.walletAddress);
    // 세션도 무효화
    await SessionManager.invalidateSession(decoded.walletAddress);

    return NextResponse.json({
      success: true,
      profile: data
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 