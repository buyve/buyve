import { NextRequest, NextResponse } from 'next/server';
import { connectionPool } from '@/lib/connectionPool';

// 🚀 검증된 안정적인 RPC 엔드포인트만 선별
const RPC_ENDPOINTS = [
  // Tier 1: 환경변수에서 로드 (최우선)
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL,
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL,
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL,

  // Tier 3: 검증된 무료 서비스들
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo', // Alchemy 데모

  // Tier 4: 백업용 (응답 속도는 느리지만 안정적)
  'https://mainnet.rpcpool.com',

  // Tier 5: 공식 솔라나 (마지막 백업용 - 제한이 있음)
  'https://api.mainnet-beta.solana.com',
].filter(Boolean); // undefined 값 제거

let currentEndpointIndex = 0;
let lastSuccessfulEndpoint: string | null = null;
let requestCount = 0;
let lastSuccessTime = 0;
let poolRequestCount = 0; // Connection Pool 사용 횟수 추적

// 🚫 실패 엔드포인트 블랙리스트 시스템 (모든 실패 유형 포함)
const failureBlacklist = new Map<string, { 
  blockedUntil: number, 
  failureType: string, 
  failureCount: number 
}>();

// 실패 유형별 블랙리스트 지속시간
const FAILURE_COOLDOWNS = {
  'rate_limit': 60 * 1000,        // 1분 (Rate limit)
  'forbidden': 5 * 60 * 1000,     // 5분 (403 Forbidden)
  'dns_error': 10 * 60 * 1000,    // 10분 (DNS/ENOTFOUND)
  'cert_error': 30 * 60 * 1000,   // 30분 (Certificate error)
  'timeout': 30 * 1000,           // 30초 (Timeout)
  'generic': 30 * 1000,           // 30초 (기타 오류)
};

// 🚀 성공한 엔드포인트 재사용 로직
const SUCCESS_CACHE_DURATION = 3 * 60 * 1000; // 3분간 성공한 엔드포인트 재사용
const MAX_RETRIES = 3; // 최대 3개 엔드포인트만 시도

// 🎯 블록해시 캐싱 시스템 (30초 캐시)
interface BlockhashCache {
  blockhash: string;
  lastValidBlockHeight: number;
  cachedAt: number;
  endpoint: string;
}

let blockhashCache: BlockhashCache | null = null;
const BLOCKHASH_CACHE_DURATION = 30 * 1000; // 30초 캐시

// 백오프 전략: 요청 실패 시 대기 시간 증가
function getBackoffDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 3000); // 최대 3초로 단축
}

// 실패 유형 정의
type FailureType = 'rate_limit' | 'forbidden' | 'dns_error' | 'cert_error' | 'timeout' | 'generic';

// 오류 타입 정의
interface ErrorWithDetails {
  message: string;
  cause?: { code?: string };
  code?: string;
}

// 실패 유형 분류
function categorizeFailure(error: ErrorWithDetails): FailureType {
  const errorMessage = error?.message || '';
  const errorCode = error?.cause?.code || error?.code || '';
  
  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
    return 'rate_limit';
  }
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'forbidden';
  }
  if (errorCode === 'ENOTFOUND' || errorMessage.includes('getaddrinfo')) {
    return 'dns_error';
  }
  if (errorCode === 'DEPTH_ZERO_SELF_SIGNED_CERT' || errorMessage.includes('certificate')) {
    return 'cert_error';
  }
  if (errorCode === 'UND_ERR_CONNECT_TIMEOUT' || errorMessage.includes('timeout')) {
    return 'timeout';
  }
  return 'generic';
}

// 엔드포인트가 블랙리스트에 있는지 확인
function isBlacklisted(endpoint: string): boolean {
  const failure = failureBlacklist.get(endpoint);
  if (!failure) return false;
  
  const now = Date.now();
  if (now > failure.blockedUntil) {
    // 차단 해제 시간이 지났으면 블랙리스트에서 제거
    failureBlacklist.delete(endpoint);
    return false;
  }
  
  return true;
}

// 실패한 엔드포인트를 블랙리스트에 추가
function addToBlacklist(endpoint: string, error: ErrorWithDetails): void {
  const failureType = categorizeFailure(error);
  const cooldown = FAILURE_COOLDOWNS[failureType];
  const blockUntil = Date.now() + cooldown;
  
  const existing = failureBlacklist.get(endpoint);
  const failureCount = (existing?.failureCount || 0) + 1;
  
  failureBlacklist.set(endpoint, {
    blockedUntil: blockUntil,
    failureType,
    failureCount
  });
  
  
  // 성공 캐시 무효화
  if (lastSuccessfulEndpoint === endpoint) {
    lastSuccessfulEndpoint = null;
    lastSuccessTime = 0;
  }
}

// 최적의 엔드포인트 선택
function getPreferredEndpoint(): string | null {
  const now = Date.now();
  
  // 성공 캐시가 있고 유효하며 블랙리스트에 없으면 사용
  if (lastSuccessfulEndpoint && 
      (now - lastSuccessTime) < SUCCESS_CACHE_DURATION &&
      !isBlacklisted(lastSuccessfulEndpoint)) {
    return lastSuccessfulEndpoint;
  }
  
  // 블랙리스트에 없는 엔드포인트 찾기
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpoint = RPC_ENDPOINTS[(currentEndpointIndex + i) % RPC_ENDPOINTS.length];
    if (endpoint && !isBlacklisted(endpoint)) {
      currentEndpointIndex = (currentEndpointIndex + i) % RPC_ENDPOINTS.length;
      return endpoint;
    }
  }
  
  // 모든 엔드포인트가 블랙리스트에 있다면 null 반환
  return null;
}

// 🎯 Connection Pool을 사용한 RPC 요청 (Web3.js 방식)
async function makePooledRpcRequest(body: unknown): Promise<unknown> {
  const requestBody = body as { method?: string; params?: unknown[]; id?: string | number };

  // 🎯 getLatestBlockhash 요청에 대한 캐시 처리
  if (requestBody?.method === 'getLatestBlockhash') {
    const now = Date.now();

    // 캐시된 블록해시가 유효한지 확인
    if (blockhashCache &&
        (now - blockhashCache.cachedAt) < BLOCKHASH_CACHE_DURATION &&
        !isBlacklisted(blockhashCache.endpoint)) {
      poolRequestCount++;
      return {
        jsonrpc: '2.0',
        id: requestBody.id,
        result: {
          context: { slot: blockhashCache.lastValidBlockHeight },
          value: {
            blockhash: blockhashCache.blockhash,
            lastValidBlockHeight: blockhashCache.lastValidBlockHeight
          }
        }
      };
    }
  }

  try {
    // Connection Pool에서 Connection 가져오기
    const connection = connectionPool.getConnection();
    poolRequestCount++;

    const method = requestBody?.method;
    const params = requestBody?.params || [];

    let result;

    // 주요 메서드들을 Web3.js Connection 메서드로 매핑
    switch (method) {
      case 'getLatestBlockhash':
        result = await connection.getLatestBlockhash(params[0] as never);
        // 블록해시 캐싱
        if (result) {
          const poolStatus = connectionPool.getStatus();
          blockhashCache = {
            blockhash: result.blockhash,
            lastValidBlockHeight: result.lastValidBlockHeight,
            cachedAt: Date.now(),
            endpoint: poolStatus.rpcUrl
          };
        }
        break;

      case 'getSlot':
        result = await connection.getSlot(params[0] as never);
        break;

      case 'getBlockHeight':
        result = await connection.getBlockHeight(params[0] as never);
        break;

      case 'getBalance':
        result = await connection.getBalance(params[0] as never, params[1] as never);
        break;

      case 'getAccountInfo':
        result = await connection.getAccountInfo(params[0] as never, params[1] as never);
        break;

      case 'getParsedAccountInfo':
        result = await connection.getParsedAccountInfo(params[0] as never, params[1] as never);
        break;

      case 'getSignatureStatus':
        result = await connection.getSignatureStatus(params[0] as never, params[1] as never);
        break;

      case 'getAddressLookupTable':
        result = await connection.getAddressLookupTable(params[0] as never);
        break;

      case 'getParsedTokenAccountsByOwner':
        result = await connection.getParsedTokenAccountsByOwner(params[0] as never, params[1] as never, params[2] as never);
        break;

      // 기타 메서드는 fetch로 폴백
      default:
        return makeRpcRequest(body, 0);
    }

    return {
      jsonrpc: '2.0',
      id: requestBody.id,
      result
    };

  } catch (error) {
    console.error('[Pool] Connection pool request failed, falling back to fetch:', error);
    // Pool 실패 시 기존 fetch 방식으로 폴백
    return makeRpcRequest(body, 0);
  }
}

// RPC 요청을 서버에서 처리 (모든 실패 유형 블랙리스트 적용)
async function makeRpcRequest(body: unknown, retryCount = 0): Promise<unknown> {
  if (retryCount >= MAX_RETRIES) {
    throw new Error(`최대 재시도 횟수 초과 (${MAX_RETRIES}회 시도)`);
  }

  // 🎯 getLatestBlockhash 요청에 대한 캐시 처리
  const requestBody = body as { method?: string; id?: string | number };
  if (requestBody?.method === 'getLatestBlockhash') {
    const now = Date.now();

    // 캐시된 블록해시가 유효한지 확인
    if (blockhashCache &&
        (now - blockhashCache.cachedAt) < BLOCKHASH_CACHE_DURATION &&
        !isBlacklisted(blockhashCache.endpoint)) {
      return {
        jsonrpc: '2.0',
        id: requestBody.id,
        result: {
          context: { slot: blockhashCache.lastValidBlockHeight },
          value: {
            blockhash: blockhashCache.blockhash,
            lastValidBlockHeight: blockhashCache.lastValidBlockHeight
          }
        }
      };
    }
  }

  let endpoint: string | null = null;
  
  if (retryCount === 0) {
    // 첫 번째 시도: 최적의 엔드포인트 선택
    endpoint = getPreferredEndpoint();
    if (!endpoint) {
      // 모든 엔드포인트가 블랙리스트에 있으면 즉시 실패
      const blacklistInfo = Array.from(failureBlacklist.entries()).map(([endpoint, failure]) => ({
        endpoint,
        failureType: failure.failureType,
        remainingMs: Math.max(0, failure.blockedUntil - Date.now())
      }));
      
      throw new Error(
        `모든 RPC 엔드포인트가 일시적으로 사용 불가능합니다. ` +
        `잠시 후 다시 시도해주세요.\n블랙리스트 상태: ${JSON.stringify(blacklistInfo, null, 2)}`
      );
    }
  } else {
    // 재시도: 순서대로 시도하되 블랙리스트 체크
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      const testEndpoint = RPC_ENDPOINTS[(currentEndpointIndex + i) % RPC_ENDPOINTS.length];
      if (testEndpoint && !isBlacklisted(testEndpoint)) {
        endpoint = testEndpoint;
        currentEndpointIndex = (currentEndpointIndex + i) % RPC_ENDPOINTS.length;
        break;
      }
    }
    
    if (!endpoint) {
      throw new Error('재시도 중 사용 가능한 엔드포인트가 없습니다');
    }
  }
  
  // 백오프 지연 적용 (첫 번째 시도는 제외)
  if (retryCount > 0) {
    const delay = getBackoffDelay(retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  let alreadyBlacklisted = false;

  try {
    requestCount++;

    // 타임아웃 10초로 단축 (빠른 실패)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SolanaApp/1.0',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      addToBlacklist(endpoint, error as ErrorWithDetails);
      alreadyBlacklisted = true;
      throw error;
    }

    const data = await response.json();
    
    if (data.error) {
      const rpcError = data.error;
      const errorMessage = (rpcError?.message || '').toString();
      const normalized = errorMessage.toLowerCase();

      const isRateLimit = normalized.includes('rate limit') || normalized.includes('429');
      const isForbidden = normalized.includes('forbidden') || normalized.includes('403');
      const shouldBlacklist = isRateLimit || isForbidden;

      if (shouldBlacklist) {
        const blacklistError = new Error(errorMessage || 'RPC provider limited the request');
        addToBlacklist(endpoint, blacklistError as ErrorWithDetails);
        alreadyBlacklisted = true;
        throw blacklistError;
      }

      // 정상적인 RPC 에러는 그대로 반환 (엔드포인트는 건강함)
      return data;
    }

    
    // 🎯 getLatestBlockhash 응답 캐싱
    if (requestBody?.method === 'getLatestBlockhash' && data.result?.value) {
      blockhashCache = {
        blockhash: data.result.value.blockhash,
        lastValidBlockHeight: data.result.value.lastValidBlockHeight,
        cachedAt: Date.now(),
        endpoint: endpoint
      };
    }
    
    // 성공 정보 캐시
    lastSuccessfulEndpoint = endpoint;
    lastSuccessTime = Date.now();
    
    return data;
    
  } catch (error) {
    
    // 모든 실패를 블랙리스트에 추가 (이미 처리한 경우 제외)
    if (!alreadyBlacklisted && endpoint) {
      addToBlacklist(endpoint, error as ErrorWithDetails);
    }
    
    // 다음 엔드포인트로 전환
    currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
    
    // 재시도
    return makeRpcRequest(body, retryCount + 1);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 🎯 먼저 Connection Pool 시도
    const result = await makePooledRpcRequest(body);

    return NextResponse.json(result);

  } catch (error) {

    return NextResponse.json(
      {
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          details: {
            requestCount,
            poolRequestCount,
            lastSuccessfulEndpoint,
            currentIndex: currentEndpointIndex
          }
        }
      },
      { status: 500 }
    );
  }
}

// GET 요청도 지원 (건강성 체크용)
export async function GET() {
  try {
    const healthCheck = {
      jsonrpc: '2.0',
      id: 'health',
      method: 'getSlot'
    };

    const result = await makePooledRpcRequest(healthCheck);

    // 블랙리스트 정보 생성
    const blacklistInfo = Array.from(failureBlacklist.entries()).map(([endpoint, failure]) => ({
      endpoint,
      failureType: failure.failureType,
      failureCount: failure.failureCount,
      blockedUntil: new Date(failure.blockedUntil).toISOString(),
      remainingMs: Math.max(0, failure.blockedUntil - Date.now())
    }));

    // Connection Pool 상태
    const poolStatus = connectionPool.getStatus();

    return NextResponse.json({
      status: 'healthy',
      connectionPool: poolStatus,
      currentEndpoint: RPC_ENDPOINTS[currentEndpointIndex],
      lastSuccessful: lastSuccessfulEndpoint,
      requestCount,
      poolRequestCount,
      allEndpoints: RPC_ENDPOINTS,
      failureBlacklist: blacklistInfo,
      result
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        requestCount,
        poolRequestCount,
        triedEndpoints: RPC_ENDPOINTS.slice(0, currentEndpointIndex + 1),
        failureBlacklist: Array.from(failureBlacklist.entries()).map(([endpoint, failure]) => ({
          endpoint,
          failureType: failure.failureType,
          failureCount: failure.failureCount,
          blockedUntil: new Date(failure.blockedUntil).toISOString(),
          remainingMs: Math.max(0, failure.blockedUntil - Date.now())
        }))
      },
      { status: 500 }
    );
  }
} 
