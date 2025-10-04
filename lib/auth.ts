import jwt from 'jsonwebtoken'
import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

// JWT 시크릿 키 (환경 변수에서 가져오기)
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not configured')
}

// JWT 페이로드 타입 정의
interface JWTPayload {
  walletAddress: string
  iat: number
  exp: number
}

// JWT 토큰 생성
export function generateJWT(walletAddress: string): string {
  const payload: JWTPayload = {
    walletAddress,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24시간 만료
  }
  
  return jwt.sign(payload, JWT_SECRET)
}

// JWT 토큰 검증
export function verifyJWT(token: string): { walletAddress: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return { walletAddress: decoded.walletAddress }
  } catch {
    return null
  }
}

// Solana 지갑 서명 검증
export function verifyWalletSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    // 메시지를 Uint8Array로 변환
    const messageBytes = new TextEncoder().encode(message)

    // 서명을 Uint8Array로 변환 (Base58 디코딩)
    const signatureBytes = bs58.decode(signature)

    // 공개키를 Uint8Array로 변환
    const publicKeyBytes = new PublicKey(publicKey).toBytes()

    // 서명 검증
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)

    return isValid
  } catch (error) {
    console.error('[AUTH DEBUG] Signature verification error:', error)
    return false
  }
}

// 사용자 프로필 생성 또는 업데이트 (RLS 우회 버전)
export async function createOrUpdateProfile(walletAddress: string, nickname?: string) {
  try {
    // 서버 사이드에서는 일반 supabase 클라이언트 사용 (RLS 우회 시도)
    const { supabase } = await import('./supabase')
    
    // 먼저 기존 프로필 확인
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    // 프로필 데이터 준비
    const profileData: any = {
      wallet_address: walletAddress,
      updated_at: new Date().toISOString()
    };

    // 닉네임 처리: 명시적으로 제공된 경우만 업데이트
    if (nickname !== undefined) {
      profileData.nickname = nickname;
    } else if (!existingProfile) {
      // 새 프로필이고 닉네임이 없는 경우만 기본값 설정
      profileData.nickname = `User_${walletAddress.slice(0, 8)}`;
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, { 
        onConflict: 'wallet_address',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (error) {
      console.error('[AUTH] Profile upsert error:', error);
      throw new Error('Profile creation failed');
    }

    return data
  } catch (error) {
    console.error('[AUTH] createOrUpdateProfile error:', error);
    throw new Error('Profile creation failed');
  }
}

// 인증 메시지 생성
export function generateAuthMessage(walletAddress: string): string {
  const timestamp = Date.now()
  return `TradeChat Authentication\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\n\nSign this message to authenticate with TradeChat.`
}

// 인증 토큰으로 Supabase 세션 생성
export async function createSupabaseSession(walletAddress: string) {
  // 서버 사이드에서만 실행 가능
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseSession can only be called on the server side')
  }

  try {
    // Supabase Admin 동적 import (빌드 시 에러 방지)
    const { supabaseAdmin } = await import('./supabase')
    
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not available')
    }

    // JWT 토큰 생성
    const token = generateJWT(walletAddress)
    
    // Supabase에서 사용자 세션 생성
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: `${walletAddress}@tradechat.local`,
      password: token,
    })

    if (error) {
      // 사용자가 없으면 생성
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
        email: `${walletAddress}@tradechat.local`,
        password: token,
      })

      if (signUpError) throw signUpError
      return signUpData
    }

    return data
  } catch (error) {
    throw error
  }
} 