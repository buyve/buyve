import { NextRequest, NextResponse } from 'next/server'
import { 
  generateAuthMessage, 
  verifyWalletSignature, 
  generateJWT,
  createOrUpdateProfile
} from '@/lib/auth'

// POST /api/auth/wallet - 지갑 서명을 통한 인증
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddress, signature, message, nickname } = body

    // 필수 필드 검증
    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, signature, message' },
        { status: 400 }
      )
    }

    // 지갑 서명 검증
    const isValidSignature = verifyWalletSignature(message, signature, walletAddress)

    if (!isValidSignature) {
      console.error('[WALLET API] Signature validation failed')
      return NextResponse.json(
        { error: 'Invalid wallet signature' },
        { status: 401 }
      )
    }

    // 메시지 형식 검증
    if (!message.includes(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 401 }
      )
    }


    // 프로필 생성/업데이트
    const profile = await createOrUpdateProfile(walletAddress, nickname)
    
    // JWT 토큰 생성
    const token = generateJWT(walletAddress)

    return NextResponse.json({
      success: true,
      token,
      profile
    })

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/auth/wallet - 인증 메시지 생성
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing walletAddress parameter' },
        { status: 400 }
      )
    }

    const message = generateAuthMessage(walletAddress)

    return NextResponse.json({
      message,
      walletAddress
    })

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 