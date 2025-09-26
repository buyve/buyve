'use client';

import {
  findMetadataPda,
  fetchMetadata
} from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
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

function sanitizeString(value?: string | null): string {
  return value ? value.replace(/\0/g, '').trim() : '';
}

async function fetchJsonMetadata(uri: string, tokenAddress: string) {
  const apiUrl = `/api/token-metadata?uri=${encodeURIComponent(uri)}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new TokenMetadataError(
      `Failed to fetch JSON metadata: ${response.status}`,
      tokenAddress,
      'json'
    );
  }

  return response.json();
}

function isMetadataAccountNotFound(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('was not found') || message.includes('Account does not exist');
}

async function fetchToken2022Metadata(
  connection: Connection,
  mintPublicKey: PublicKey,
  tokenAddress: string
): Promise<TokenMetadata | null> {
  const parsedAccount = await connection.getParsedAccountInfo(mintPublicKey);
  const account = parsedAccount.value;

  const ownerAddress = typeof account?.owner === 'string'
    ? account.owner
    : account?.owner?.toBase58?.();

  if (!account || ownerAddress !== TOKEN_2022_PROGRAM_ID.toBase58()) {
    return null;
  }

  const accountData = account.data;
  if (!accountData || typeof accountData === 'string' || Array.isArray(accountData)) {
    return null;
  }

  if (!('parsed' in accountData)) {
    return null;
  }

  const parsed = (accountData as ParsedAccountData).parsed as any;
  const extensions = parsed?.info?.extensions;

  if (!Array.isArray(extensions)) {
    return null;
  }

  const metadataExtension = extensions.find((ext: any) => ext.extension === 'tokenMetadata');
  if (!metadataExtension?.state) {
    return null;
  }

  const uri = sanitizeString(metadataExtension.state.uri);
  if (!uri) {
    return null;
  }

  const jsonMetadata = await fetchJsonMetadata(uri, tokenAddress);

  const name = sanitizeString(metadataExtension.state.name) || sanitizeString(parsed?.info?.name);
  const symbol = sanitizeString(metadataExtension.state.symbol) || sanitizeString(parsed?.info?.symbol);

  const result: TokenMetadata = {
    mint: tokenAddress,
    name: name || tokenAddress,
    symbol,
    description: jsonMetadata.description,
    image: jsonMetadata.image,
    attributes: jsonMetadata.attributes,
    external_url: jsonMetadata.external_url,
    animation_url: jsonMetadata.animation_url,
    properties: jsonMetadata.properties
  };

  return result;
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
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/CLIspK_3J2GVAuweafRIUoHzWjyn07rz';
    const connection = new Connection(rpcUrl, 'confirmed');

    // UMI 인스턴스 생성
    const umi = createUmi(rpcUrl);
    
    // 토큰 주소 PublicKey 생성
    const mintPublicKeyUmi = publicKey(tokenAddress);
    const mintPublicKey = new PublicKey(tokenAddress);

    // Token-2022 메타데이터 확장 우선 시도
    const token2022Metadata = await fetchToken2022Metadata(connection, mintPublicKey, tokenAddress);
    if (token2022Metadata) {
      return token2022Metadata;
    }

    // 메타데이터 PDA 계산
    const metadataAddress = findMetadataPda(umi, { mint: mintPublicKeyUmi });

    // 메타데이터 조회
    let metadata;
    try {
      metadata = await fetchMetadata(umi, metadataAddress[0]);
    } catch (error) {
      if (isMetadataAccountNotFound(error)) {
        return null;
      }

      throw new TokenMetadataError(
        `Failed to fetch on-chain metadata: ${error instanceof Error ? error.message : 'Unknown'}`,
        tokenAddress,
        'metadata'
      );
    }

    const uri = sanitizeString(metadata.uri);
    if (!uri) {
      return null;
    }

    const jsonMetadata = await fetchJsonMetadata(uri, tokenAddress);

    const result: TokenMetadata = {
      mint: tokenAddress,
      name: sanitizeString(metadata.name) || tokenAddress,
      symbol: sanitizeString(metadata.symbol),
      description: jsonMetadata.description,
      image: jsonMetadata.image,
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
