'use client';

import { useEffect } from 'react';
import { tokenMetadataCache } from '@/lib/tokenMetadataCache';
import { fetchTokenMetadata } from '@/lib/tokenMetadata';

// 자주 사용되는 토큰들
const POPULAR_TOKENS = [
  'So11111111111111111111111111111111111111112', // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // jitoSOL
];

/**
 * 토큰 메타데이터 미리 로드 훅
 * 앱 시작 시 자주 사용되는 토큰들의 메타데이터를 캐시에 미리 로드
 */
export function useTokenMetadataPreload() {
  useEffect(() => {
    // 앱 시작 후 2초 뒤에 백그라운드에서 로드
    const timer = setTimeout(() => {
      tokenMetadataCache.preheat(POPULAR_TOKENS, fetchTokenMetadata)
        .catch(console.error);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);
}

/**
 * 특정 토큰 리스트 미리 로드
 */
export function preloadTokenMetadata(tokenAddresses: string[]) {
  return tokenMetadataCache.preheat(tokenAddresses, fetchTokenMetadata);
}