import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT, generateJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { SessionManager } from '@/lib/session-manager'
import { CacheManager } from '@/lib/cache-manager'

// Authorization 헤더에서 토큰 추출하는 유틸리티 함수 (내부 함수로 변경)
function extractTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  return authHeader.substring(7) // "Bearer " 제거
}

// POST /api/auth/verify - JWT 토큰 검증
export async function POST(request: NextRequest) {
  try {
    const { message, signature, publicKey } = await request.json()
    
    if (!message || !signature || !publicKey) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the signature
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = bs58.decode(signature)
    const publicKeyBytes = new PublicKey(publicKey).toBytes()
    
    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    )
    
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Generate JWT auth token
    const authToken = generateJWT(publicKey)
    
    return NextResponse.json({
      success: true,
      authToken,
      publicKey
    })
    
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to verify signature' },
      { status: 500 }
    )
  }
}

// GET /api/auth/verify - Authorization 헤더를 통한 토큰 검증
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 400 }
      )
    }

    // JWT 토큰 검증
    const decoded = verifyJWT(token)
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // 세션에서 프로필 확인 (캐시 우선)
    const sessionResult = await SessionManager.getSession(decoded.walletAddress)
    
    if (sessionResult.success && sessionResult.sessionData?.profile) {
      // 세션에서 프로필 가져오기 성공
      return NextResponse.json({
        valid: true,
        walletAddress: decoded.walletAddress,
        profile: sessionResult.sessionData.profile,
      })
    }

    // 캐시에서 프로필 확인
    const cachedProfile = await CacheManager.getUserProfile(decoded.walletAddress)
    
    if (cachedProfile.fromCache && cachedProfile.data) {
      // 캐시에서 프로필 가져오기 성공
      // 세션도 업데이트
      await SessionManager.createSession(decoded.walletAddress, token, cachedProfile.data)
      
      return NextResponse.json({
        valid: true,
        walletAddress: decoded.walletAddress,
        profile: cachedProfile.data,
      })
    }

    // 캐시 미스 - DB에서 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', decoded.walletAddress)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // 캐시와 세션에 저장
    await CacheManager.setUserProfile(decoded.walletAddress, profile)
    await SessionManager.createSession(decoded.walletAddress, token, profile)

    // 성공 응답
    return NextResponse.json({
      valid: true,
      walletAddress: decoded.walletAddress,
      profile,
    })

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 