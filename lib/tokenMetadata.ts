'use client';

import { 
  findMetadataPda,
  fetchMetadata
} from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { tokenMetadataCache } from './tokenMetadataCache';

// 🌟 Solana 토큰 메타데이터 인터페이스
export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
    }>;
  };
}

// 🌟 토큰 메타데이터 조회 에러 타입
export class TokenMetadataError extends Error {
  constructor(
    message: string,
    public readonly tokenAddress: string,
    public readonly step: 'metadata' | 'uri' | 'json' | 'image'
  ) {
    super(message);
    this.name = 'TokenMetadataError';
  }
}

/**
 * 🎯 토큰 주소로부터 메타데이터 조회 (캐싱 적용)
 * @param tokenAddress - 조회할 토큰의 주소
 * @returns TokenMetadata 또는 null
 */
export async function fetchTokenMetadata(
  tokenAddress: string
): Promise<TokenMetadata | null> {
  // 캐시 확인
  const cached = tokenMetadataCache.get(tokenAddress);
  if (cached) {
    // stale-while-revalidate 패턴: 오래된 데이터도 먼저 반환하고 백그라운드에서 업데이트
    if (tokenMetadataCache.isStale(tokenAddress)) {
      // 백그라운드에서 업데이트 (await 하지 않음)
      fetchTokenMetadataFromChain(tokenAddress).then(metadata => {
        if (metadata) {
          tokenMetadataCache.set(tokenAddress, metadata);
        }
      }).catch(console.error);
    }
    return cached;
  }

  // 진행 중인 요청 확인 (중복 요청 방지)
  const pending = tokenMetadataCache.getPending(tokenAddress);
  if (pending) {
    return pending;
  }

  // 새로운 요청 생성
  const promise = fetchTokenMetadataFromChain(tokenAddress);
  tokenMetadataCache.setPending(tokenAddress, promise);

  try {
    const metadata = await promise;
    if (metadata) {
      tokenMetadataCache.set(tokenAddress, metadata);
    }
    return metadata;
  } catch (error) {
    throw error;
  }
}

/**
 * 🔗 체인에서 직접 메타데이터 조회 (캐시 우회)
 * @param tokenAddress - 조회할 토큰의 주소
 * @returns TokenMetadata 또는 null
 */
async function fetchTokenMetadataFromChain(
  tokenAddress: string
): Promise<TokenMetadata | null> {
  try {
    // RPC URL 설정
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/***REMOVED_ALCHEMY_KEY***';
    
    // UMI 인스턴스 생성
    const umi = createUmi(rpcUrl);
    
    // 토큰 주소를 UMI PublicKey로 변환
    const mintPublicKey = publicKey(tokenAddress);

    // 메타데이터 PDA 계산
    const metadataAddress = findMetadataPda(umi, { mint: mintPublicKey });

    // 메타데이터 조회
    const metadata = await fetchMetadata(umi, metadataAddress[0]);

    // URI에서 JSON 메타데이터 조회
    if (!metadata.uri) {
      return null;
    }
    
    // CORS 문제를 해결하기 위해 우리의 API 엔드포인트 사용
    const apiUrl = `/api/token-metadata?uri=${encodeURIComponent(metadata.uri)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new TokenMetadataError(
        `Failed to fetch JSON metadata: ${response.status}`,
        tokenAddress,
        'json'
      );
    }

    const jsonMetadata = await response.json();

    // 이미지 URL을 그대로 사용 (검증은 TokenAvatar에서 처리)
    const imageUrl = jsonMetadata.image;

    // 결과 반환
    const result: TokenMetadata = {
      mint: tokenAddress,
      name: metadata.name.replace(/\0/g, '').trim(), // null bytes 제거
      symbol: metadata.symbol.replace(/\0/g, '').trim(),
      description: jsonMetadata.description,
      image: imageUrl,
      attributes: jsonMetadata.attributes,
      external_url: jsonMetadata.external_url,
      animation_url: jsonMetadata.animation_url,
      properties: jsonMetadata.properties
    };

    return result;

  } catch (error) {
    if (error instanceof TokenMetadataError) {
      throw error;
    }
    
    // 알 수 없는 에러
    throw new TokenMetadataError(
      `Unknown error: ${error instanceof Error ? error.message : 'Unknown'}`,
      tokenAddress,
      'metadata'
    );
  }
}

/**
 * 🖼️ 이미지를 Blob으로 변환
 * @param imageUrl - 변환할 이미지 URL
 * @returns Blob 객체 또는 null
 */
export async function convertImageToBlob(imageUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    
    return blob;
  } catch {
    return null;
  }
}

/**
 * 🎯 토큰 주소로부터 이미지 URL 추출 (간단 버전)
 * @param tokenAddress - 토큰 주소
 * @returns 이미지 URL 또는 null
 */
export async function getTokenImageUrl(
  tokenAddress: string
): Promise<string | null> {
  try {
    const metadata = await fetchTokenMetadata(tokenAddress);
    return metadata?.image || null;
  } catch {
    return null;
  }
}

/**
 * 🔄 토큰 메타데이터 조회 재시도 로직 (캐싱 적용)
 * @param tokenAddress - 토큰 주소 
 * @param maxRetries - 최대 재시도 횟수
 * @returns TokenMetadata 또는 null
 */
export async function fetchTokenMetadataWithRetry(
  tokenAddress: string,
  maxRetries: number = 3
): Promise<TokenMetadata | null> {
  // 캐시 먼저 확인
  const cached = tokenMetadataCache.get(tokenAddress);
  if (cached) {
    return cached;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetchTokenMetadata(tokenAddress);
      // null이 반환되면 메타데이터가 없는 것으로 간주하고 즉시 반환
      if (result === null) {
        return null;
      }
      
      if (result) {
        return result;
      }
    } catch {
      if (attempt < maxRetries) {
        // 지수 백오프: 1초, 2초, 4초...
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return null;
}

/**
 * 🔥 캐시 클리어 (관리용)
 */
export function clearTokenMetadataCache(): void {
  tokenMetadataCache.clear();
}

/**
 * 📊 캐시 통계 (디버깅용)
 */
export function getTokenMetadataCacheStats() {
  return tokenMetadataCache.getStats();
}

export default {
  fetchTokenMetadata,
  fetchTokenMetadataWithRetry,
  convertImageToBlob,
  getTokenImageUrl,
  TokenMetadataError
}; 