import jwt from 'jsonwebtoken'
import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

// JWT secret key (retrieved from environment variables)
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not configured')
}

// JWT payload type definition
interface JWTPayload {
  walletAddress: string
  iat: number
  exp: number
}

// Generate JWT token
export function generateJWT(walletAddress: string): string {
  const payload: JWTPayload = {
    walletAddress,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24 hours
  }

  return jwt.sign(payload, JWT_SECRET)
}

// Verify JWT token
export function verifyJWT(token: string): { walletAddress: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return { walletAddress: decoded.walletAddress }
  } catch {
    return null
  }
}

// Verify Solana wallet signature
export function verifyWalletSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    // Convert message to Uint8Array
    const messageBytes = new TextEncoder().encode(message)

    // Convert signature to Uint8Array (Base58 decoding)
    const signatureBytes = bs58.decode(signature)

    // Convert public key to Uint8Array
    const publicKeyBytes = new PublicKey(publicKey).toBytes()

    // Verify signature
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)

    return isValid
  } catch (error) {
    console.error('[AUTH DEBUG] Signature verification error:', error)
    return false
  }
}

// Create or update user profile (RLS bypass version)
export async function createOrUpdateProfile(walletAddress: string, nickname?: string) {
  try {
    // Use regular supabase client on server side (attempting to bypass RLS)
    const { supabase } = await import('./supabase')

    // First check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    // Prepare profile data
    const profileData: any = {
      wallet_address: walletAddress,
      updated_at: new Date().toISOString()
    };

    // Nickname handling: update only when explicitly provided
    if (nickname !== undefined) {
      profileData.nickname = nickname;
    } else if (!existingProfile) {
      // Set default value only for new profiles without nickname
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

// Generate authentication message
export function generateAuthMessage(walletAddress: string): string {
  const timestamp = Date.now()
  return `Buyve Authentication\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\n\nSign this message to authenticate with Buyve.`
}

// Create Supabase session with authentication token
export async function createSupabaseSession(walletAddress: string) {
  // Can only be executed on server side
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseSession can only be called on the server side')
  }

  try {
    // Dynamically import Supabase Admin (prevent build errors)
    const { supabaseAdmin } = await import('./supabase')

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not available')
    }

    // Generate JWT token
    const token = generateJWT(walletAddress)

    // Create user session in Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: `${walletAddress}@tradechat.local`,
      password: token,
    })

    if (error) {
      // Create user if doesn't exist
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