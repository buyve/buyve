import { PublicKey } from '@solana/web3.js';

/**
 * Check if PublicKey is valid
 */
export function isValidPublicKey(publicKey: PublicKey | null | undefined): publicKey is PublicKey {
  return publicKey !== null && publicKey !== undefined && typeof publicKey.toString === 'function';
}

/**
 * Safely convert PublicKey to string
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
 * Safely convert PublicKey to Base58 string
 */
export function safePublicKeyToBase58(publicKey: PublicKey | null | undefined): string | null {
  if (!isValidPublicKey(publicKey)) {
    return null;
  }

  try {
    // In Solana, toString() returns Base58 format
    return publicKey.toString();
  } catch {
    return null;
  }
}

/**
 * Check wallet connection status
 */
export function isWalletConnected(
  connected: boolean,
  publicKey: PublicKey | null | undefined
): boolean {
  return connected && isValidPublicKey(publicKey);
}

/**
 * Wallet address formatting function (safe version)
 */
export function formatWalletAddress(publicKey: PublicKey | null | undefined, short = true): string {
  const address = safePublicKeyToString(publicKey);
  
  if (!address) {
    return 'Not connected';
  }
  
  if (!short) {
    return address;
  }
  
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
} 