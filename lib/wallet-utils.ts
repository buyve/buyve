import { PublicKey } from '@solana/web3.js';

/**
 * PublicKey가 유효한지 확인하는 함수
 */
export function isValidPublicKey(publicKey: PublicKey | null | undefined): publicKey is PublicKey {
  return publicKey !== null && publicKey !== undefined && typeof publicKey.toString === 'function';
}

/**
 * 안전하게 PublicKey를 문자열로 변환하는 함수
 */
export function safePublicKeyToString(publicKey: PublicKey | null | undefined): string | null {
  if (!isValidPublicKey(publicKey)) {
    return null;
  }
  
  try {
    return publicKey.toString();
  } catch {
    return null;
  }
}

/**
 * 안전하게 PublicKey를 Base58 문자열로 변환하는 함수
 */
export function safePublicKeyToBase58(publicKey: PublicKey | null | undefined): string | null {
  if (!isValidPublicKey(publicKey)) {
    return null;
  }
  
  try {
    // Solana에서는 toString()이 Base58 형식을 반환합니다
    return publicKey.toString();
  } catch {
    return null;
  }
}

/**
 * 지갑 연결 상태를 확인하는 함수
 */
export function isWalletConnected(
  connected: boolean, 
  publicKey: PublicKey | null | undefined
): boolean {
  return connected && isValidPublicKey(publicKey);
}

/**
 * 주소 포맷팅 함수 (안전한 버전)
 */
export function formatWalletAddress(publicKey: PublicKey | null | undefined, short = true): string {
  const address = safePublicKeyToString(publicKey);
  
  if (!address) {
    return '연결되지 않음';
  }
  
  if (!short) {
    return address;
  }
  
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
} 