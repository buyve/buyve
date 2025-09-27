import { Connection, PublicKey, LAMPORTS_PER_SOL, Commitment } from '@solana/web3.js';

// 솔라나 네트워크 타입 정의
export type SolanaNetwork = 'mainnet' | 'devnet' | 'testnet';

// ⚡ 사용자 지정 RPC URL을 우선 사용하고, 백업으로 무료 RPC 엔드포인트 사용
const getMainnetRpcEndpoints = () => {
  const customRpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const baseEndpoints = [
    'https://mainnet.helius-rpc.com/?api-key=***REMOVED_HELIUS_KEY***', // Helius dedicated RPC
    'https://solana-mainnet.g.alchemy.com/v2/***REMOVED_ALCHEMY_KEY***', // Alchemy RPC (우선)
    'https://rpc.ankr.com/solana', // Ankr
    'https://mainnet.rpcpool.com', // RPC Pool
    'https://api.mainnet-beta.solana.com', // 공식 RPC (백업용)
    'https://solana-api.projectserum.com', // Project Serum (무료)
    'https://api.metaplex.solana.com', // Metaplex (무료)
    'https://rpc.public.solana.com', // 공개 RPC
    'https://solana-mainnet.core.chainstack.com', // Chainstack 무료 티어
  ];
  
  // 사용자 지정 RPC URL이 있으면 가장 앞에 배치 (Alchemy 우선)
  return customRpcUrl ? [customRpcUrl, ...baseEndpoints] : baseEndpoints;
};

const MAINNET_RPC_ENDPOINTS = getMainnetRpcEndpoints();

const DEVNET_RPC_ENDPOINTS = [
  'https://api.devnet.solana.com', // 공식 Devnet RPC (무료)
  'https://devnet.solana.com', // 공식 대체 주소
];

const TESTNET_RPC_ENDPOINTS = [
  'https://api.testnet.solana.com', // 공식 Testnet RPC
];

// 네트워크 설정 (환경 변수 무시하고 강제로 첫 번째 RPC 사용)
export const NETWORK_CONFIG = {
  mainnet: {
    name: 'Mainnet Beta',
    urls: MAINNET_RPC_ENDPOINTS,
    url: MAINNET_RPC_ENDPOINTS[0], // 강제로 공식 RPC 사용
    commitment: 'confirmed' as Commitment,
  },
  devnet: {
    name: 'Devnet', 
    urls: DEVNET_RPC_ENDPOINTS,
    url: DEVNET_RPC_ENDPOINTS[0], // 강제로 공식 RPC 사용
    commitment: 'confirmed' as Commitment,
  },
  testnet: {
    name: 'Testnet',
    urls: TESTNET_RPC_ENDPOINTS,
    url: TESTNET_RPC_ENDPOINTS[0], // 강제로 공식 RPC 사용
    commitment: 'confirmed' as Commitment,
  },
} as const;

// Memo Program ID
export const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

// 현재 네트워크 가져오기 (기본값: mainnet)
export function getCurrentNetwork(): SolanaNetwork {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK as SolanaNetwork;
  if (!network || !['mainnet', 'devnet', 'testnet'].includes(network)) {
    return 'mainnet'; // devnet 대신 mainnet 기본값으로 변경
  }
  return network;
}

// 🚀 개선된 Connection 생성 (백업 전략 포함)
export function createSolanaConnection(network?: SolanaNetwork): Connection {
  const currentNetwork = network || getCurrentNetwork();
  
  let endpoint: string;
  
  if (typeof window !== 'undefined') {
    // 브라우저 환경: 프록시 우선, 실패 시 직접 연결
    endpoint = `${window.location.origin}/api/solana-rpc`;
  } else {
    // 서버 환경: 직접 연결
    const config = NETWORK_CONFIG[currentNetwork];
    endpoint = config.url;
  }
  
  // 단순한 Connection 생성
  return new Connection(endpoint, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 90000, // 90초로 증가
    disableRetryOnRateLimit: true, // 속도 제한 재시도 비활성화
    httpHeaders: {
      'User-Agent': 'SolanaSwapChat/1.0',
    },
    fetch: typeof window !== 'undefined' ? window.fetch.bind(window) : undefined,
  });
}

// 🎯 백업 Connection 생성 (프록시 실패 시 직접 연결)
export function createDirectConnection(network?: SolanaNetwork): Connection {
  const currentNetwork = network || getCurrentNetwork();
  const config = NETWORK_CONFIG[currentNetwork];
  
  return new Connection(config.url, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 90000,
    disableRetryOnRateLimit: true,
    httpHeaders: {
      'User-Agent': 'SolanaSwapChat/1.0',
    },
    fetch: typeof window !== 'undefined' ? window.fetch.bind(window) : undefined,
  });
}

// 📦 연결 캐시 시스템
interface ConnectionCache {
  connection: Connection;
  isHealthy: boolean;
  lastChecked: number;
  network: SolanaNetwork;
}

let connectionCache: ConnectionCache | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시
const HEALTH_CHECK_TIMEOUT = 5000; // 5초 타임아웃

// 🚀 안정적인 Connection 가져오기 (캐싱 + 자동 백업)
export async function getStableConnection(network?: SolanaNetwork): Promise<Connection> {
  const currentNetwork = network || getCurrentNetwork();
  const now = Date.now();
  
  // 캐시된 연결이 유효한지 확인
  if (connectionCache && 
      connectionCache.network === currentNetwork && 
      connectionCache.isHealthy && 
      (now - connectionCache.lastChecked) < CACHE_DURATION) {
    return connectionCache.connection;
  }
  
  try {
    // 1차: 프록시 연결 시도
    const proxyConnection = createSolanaConnection(currentNetwork);
    
    // 빠른 연결 테스트 (타임아웃 적용)
    const healthCheckPromise = proxyConnection.getSlot();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
    );
    
    await Promise.race([healthCheckPromise, timeoutPromise]);
    
    // 연결 성공 - 캐시에 저장
    connectionCache = {
      connection: proxyConnection,
      isHealthy: true,
      lastChecked: now,
      network: currentNetwork
    };
    
    return proxyConnection;
    
  } catch {
    
    try {
      // 2차: 직접 연결 시도
      const directConnection = createDirectConnection(currentNetwork);
      
      // 빠른 연결 테스트
      const healthCheckPromise = directConnection.getSlot();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Direct health check timeout')), HEALTH_CHECK_TIMEOUT)
      );
      
      await Promise.race([healthCheckPromise, timeoutPromise]);
      
      // 직접 연결 성공 - 캐시에 저장
      connectionCache = {
        connection: directConnection,
        isHealthy: true,
        lastChecked: now,
        network: currentNetwork
      };
      
      return directConnection;
      
    } catch {
      
      // 캐시 무효화
      const oldCache = connectionCache;
      connectionCache = null;
      
      // 기존 연결이라도 반환 (최후의 수단)
      if (oldCache?.connection) {
        return oldCache.connection;
      }
      
      throw new Error('Solana 네트워크에 연결할 수 없습니다');
    }
  }
}

// 🎯 블록해시 전용 안정적인 Connection (에러 시 즉시 백업 전환)
export async function getBlockhashConnection(network?: SolanaNetwork): Promise<Connection> {
  const currentNetwork = network || getCurrentNetwork();
  
  // 1차: 프록시 연결 시도
  try {
    const proxyConnection = createSolanaConnection(currentNetwork);
    
    // 블록해시 테스트
    await proxyConnection.getLatestBlockhash('finalized');
    return proxyConnection;
    
  } catch {
    
    // 2차: 직접 연결 시도
    try {
      const directConnection = createDirectConnection(currentNetwork);
      
      // 블록해시 테스트
      await directConnection.getLatestBlockhash('finalized');
      return directConnection;
      
    } catch (directError) {
      throw new Error(`블록해시 조회 불가: ${directError instanceof Error ? directError.message : String(directError)}`);
    }
  }
}

// 캐시 무효화 함수 (문제 발생 시 사용)
export function invalidateConnectionCache(): void {
  connectionCache = null;
}

// RPC 엔드포인트 자동 선택 (이제 프록시에서 처리되므로 단순화)
export async function findHealthyRpcEndpoint(): Promise<string | null> {
  return '/api/solana-rpc';
}

// 네트워크 통계 정보
export async function getNetworkStats(conn?: Connection) {
  try {
    const solanaConnection = conn || getSolanaConnection();
    const [blockHeight, epochInfo, supply] = await Promise.all([
      solanaConnection.getBlockHeight(),
      solanaConnection.getEpochInfo(),
      solanaConnection.getSupply(),
    ]);

    return {
      blockHeight,
      epochInfo,
      supply: {
        total: supply.value.total / LAMPORTS_PER_SOL,
        circulating: supply.value.circulating / LAMPORTS_PER_SOL,
        nonCirculating: supply.value.nonCirculating / LAMPORTS_PER_SOL,
      },
    };
  } catch (error) {
    throw error;
  }
}

// 연결 상태 모니터링
export class SolanaConnectionMonitor {
  private connection: Connection;
  private isMonitoring = false;
  private onStatusChange?: (status: { connected: boolean; error?: string }) => void;

  constructor(connection?: Connection) {
    this.connection = connection || getSolanaConnection();
  }

  startMonitoring(onStatusChange: (status: { connected: boolean; error?: string }) => void) {
    this.onStatusChange = onStatusChange;
    this.isMonitoring = true;
    // 초기 상태만 확인 (자동 반복 제거)
    this.checkStatus();
  }

  stopMonitoring() {
    this.isMonitoring = false;
    this.onStatusChange = undefined;
  }

  // 🎯 수동 상태 확인 메서드 추가
  async checkStatusManually() {
    if (!this.isMonitoring) return;
    await this.checkStatus();
  }

  private async checkStatus() {
    if (!this.isMonitoring) return;

    try {
      await this.connection.getBlockHeight();
      this.onStatusChange?.({ connected: true });
    } catch (error) {
      this.onStatusChange?.({
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }

    // 🚫 자동 폴링 제거 - 필요할 때만 수동으로 호출
    // setTimeout(() => this.checkStatus(), 30000);
  }
}

// 기본 Connection 인스턴스 (싱글톤)
let connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!connection) {
    connection = createSolanaConnection();
  }
  return connection;
}

// 네트워크 전환
export function switchNetwork(network: SolanaNetwork): Connection {
  connection = createSolanaConnection(network);
  return connection;
}

// Solana 연결 상태 확인
export async function checkSolanaConnection(conn?: Connection): Promise<{
  connected: boolean;
  network: string;
  blockHeight?: number;
  error?: string;
}> {
  const currentNetwork = getCurrentNetwork();
  const solanaConnection = conn || getSolanaConnection();
  
  try {
    // 빠른 건강성 체크 (3초 타임아웃)
    const healthPromise = solanaConnection.getSlot();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 3000)
    );
    
    const slot = await Promise.race([healthPromise, timeoutPromise]);
    
    return {
      connected: true,
      network: currentNetwork,
      blockHeight: slot,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      connected: false,
      network: currentNetwork,
      error: errorMessage,
    };
  }
}

// 계정 잔고 조회 (SOL)
export async function getAccountBalance(
  publicKey: PublicKey,
  conn?: Connection
): Promise<number> {
  try {
    const solanaConnection = conn || getSolanaConnection();
    const balance = await solanaConnection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    throw error;
  }
}

// 계정 정보 조회
export async function getAccountInfo(
  publicKey: PublicKey,
  conn?: Connection
) {
  try {
    const solanaConnection = conn || getSolanaConnection();
    const accountInfo = await solanaConnection.getAccountInfo(publicKey);
    return accountInfo;
  } catch (error) {
    throw error;
  }
}

// 최신 블록해시 조회
export async function getLatestBlockhash(conn?: Connection) {
  try {
    const solanaConnection = conn || getSolanaConnection();
    const latestBlockHash = await solanaConnection.getLatestBlockhash();
    return latestBlockHash;
  } catch (error) {
    throw error;
  }
}

// 트랜잭션 확인
export async function confirmTransaction(
  signature: string,
  conn?: Connection
): Promise<boolean> {
  try {
    const solanaConnection = conn || getSolanaConnection();
    const result = await solanaConnection.confirmTransaction(signature);
    return !result.value.err;
  } catch {
    return false;
  }
}

export default {
  createConnection: createSolanaConnection,
  getConnection: getSolanaConnection,
  getStableConnection,
  getBlockhashConnection,
  switchNetwork,
  checkConnection: checkSolanaConnection,
  getAccountBalance,
  getAccountInfo,
  getLatestBlockhash,
  confirmTransaction,
  getNetworkStats,
  getCurrentNetwork,
  NETWORK_CONFIG,
  MEMO_PROGRAM_ID,
  SolanaConnectionMonitor,
}; 
