'use client';

import { tokenMetadataCache } from './tokenMetadataCache';

interface JupiterTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  logoURI?: string;
  image?: string;
}

/**
 * Jupiter Token List 캐싱
 */
class JupiterTokenListCache {
  private cache: Map<string, JupiterTokenMetadata> | null = null;
  private lastFetch: number = 0;
  private ttl: number = 60 * 60 * 1000; // 1시간
  private fetchPromise: Promise<void> | null = null;

  async getToken(tokenAddress: string): Promise<JupiterTokenMetadata | null> {
    await this.ensureCache();
    return this.cache?.get(tokenAddress) || null;
  }

  private async ensureCache(): Promise<void> {
    const now = Date.now();
    
    // 캐시가 유효한 경우
    if (this.cache && now - this.lastFetch < this.ttl) {
      return;
    }

    // 이미 fetch가 진행 중인 경우
    if (this.fetchPromise) {
      await this.fetchPromise;
      return;
    }

    // 새로운 fetch 시작
    this.fetchPromise = this.fetchTokenList();
    try {
      await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async fetchTokenList(): Promise<void> {
    try {
      // Jupiter API 엔드포인트 변경: quote-api.jup.ag → lite-api.jup.ag
      // Solana token registry를 fallback으로 사용
      const response = await fetch('https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json');
      if (!response.ok) throw new Error('Failed to fetch token list');

      const data = await response.json();
      const tokens: JupiterTokenMetadata[] = data.tokens.map((t: any) => ({
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        logoURI: t.logoURI,
      }));
      this.cache = new Map(tokens.map(token => [token.address, token]));
      this.lastFetch = Date.now();
    } catch (error) {
      console.error('Failed to fetch token list:', error);
      // 빈 캐시 설정하여 반복 실패 요청 방지
      this.cache = new Map();
    }
  }
}

// 싱글톤 인스턴스
export const jupiterTokenListCache = new JupiterTokenListCache();

/**
 * 다양한 소스에서 토큰 이미지 조회 (캐싱 적용)
 */
export async function fetchTokenImageWithFallbacks(
  tokenAddress: string,
  providedImageUrl?: string | null
): Promise<string[]> {
  const sources: string[] = [];

  // 1. 제공된 이미지 URL이 유효한 경우
  if (providedImageUrl && providedImageUrl.startsWith('http')) {
    sources.push(providedImageUrl);
  }

  // 2. 캐시된 메타데이터 확인
  const cachedMetadata = tokenMetadataCache.get(tokenAddress);
  if (cachedMetadata?.image) {
    sources.push(cachedMetadata.image);
  }

  // 3. Jupiter Token List (캐싱됨)
  const jupiterToken = await jupiterTokenListCache.getToken(tokenAddress);
  if (jupiterToken?.logoURI) {
    sources.push(jupiterToken.logoURI);
  }

  // 4. Static 이미지 소스들
  sources.push(
    `https://static.jup.ag/images/${tokenAddress}.png`,
    `https://static-create.jup.ag/images/${tokenAddress}`,
    `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${tokenAddress}/logo.png`
  );

  // 중복 제거
  return [...new Set(sources)];
}

/**
 * 이미지 URL 최적화 (wsrv.nl 사용)
 */
export function getOptimizedImageUrl(originalUrl: string, size: number = 48): string {
  const hasExtension = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(originalUrl);
  const optimizedUrl = `https://wsrv.nl/?w=${size}&h=${size}&url=${encodeURIComponent(originalUrl)}&dpr=2&quality=80`;
  
  // 확장자가 없는 경우 output 형식 지정
  if (!hasExtension) {
    return `${optimizedUrl}&output=png`;
  }
  
  return optimizedUrl;
}

/**
 * CORS 프록시 URL 생성
 */
export function getProxiedImageUrl(originalUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * 토큰 아바타 폴백 텍스트 생성
 */
export function getTokenAvatarFallback(
  tokenName: string,
  providedImageUrl?: string | null,
  metaplexData?: { symbol?: string; name?: string } | null,
  jupiterData?: { symbol?: string; name?: string } | null
): string {
  // 이모지인 경우 그대로 반환
  if (providedImageUrl && !providedImageUrl.startsWith('http') && !providedImageUrl.startsWith('//')) {
    return providedImageUrl;
  }
  
  // 메타데이터에서 이름 추출
  const displayName = metaplexData?.symbol || metaplexData?.name || 
                     jupiterData?.symbol || jupiterData?.name || tokenName;
  
  return displayName
    .split(/[\s\/]/)
    .slice(0, 2)
    .map((word: string) => word.charAt(0))
    .join('')
    .toUpperCase();
}