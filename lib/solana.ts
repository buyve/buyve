import { Connection, PublicKey, LAMPORTS_PER_SOL, Commitment } from '@solana/web3.js';

// Solana network type definition
export type SolanaNetwork = 'mainnet' | 'devnet' | 'testnet';

const getMainnetRpcEndpoints = () => {
  const customRpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const baseEndpoints = [
    'https://mainnet.helius-rpc.com/?api-key=d0c461b2-279b-41ed-9a00-93952a97afd0', // Helius dedicated RPC
    'https://solana-mainnet.g.alchemy.com/v2/CLIspK_3J2GVAuweafRIUoHzWjyn07rz', // Alchemy RPC (priority)
    'https://rpc.ankr.com/solana', // Ankr
    'https://mainnet.rpcpool.com', // RPC Pool
    'https://api.mainnet-beta.solana.com', // Official RPC (backup)
    'https://solana-api.projectserum.com', // Project Serum (free)
    'https://api.metaplex.solana.com', // Metaplex (free)
    'https://rpc.public.solana.com', // Public RPC
    'https://solana-mainnet.core.chainstack.com',
  ];

  return customRpcUrl ? [customRpcUrl, ...baseEndpoints] : baseEndpoints;
};

const MAINNET_RPC_ENDPOINTS = getMainnetRpcEndpoints();

const DEVNET_RPC_ENDPOINTS = [
  'https://api.devnet.solana.com', // Official Devnet RPC (free)
  'https://devnet.solana.com', // Official alternative URL
];

const TESTNET_RPC_ENDPOINTS = [
  'https://api.testnet.solana.com', // Official Testnet RPC
];

export const NETWORK_CONFIG = {
  mainnet: {
    name: 'Mainnet Beta',
    urls: MAINNET_RPC_ENDPOINTS,
    url: MAINNET_RPC_ENDPOINTS[0],
    commitment: 'confirmed' as Commitment,
  },
  devnet: {
    name: 'Devnet',
    urls: DEVNET_RPC_ENDPOINTS,
    url: DEVNET_RPC_ENDPOINTS[0],
    commitment: 'confirmed' as Commitment,
  },
  testnet: {
    name: 'Testnet',
    urls: TESTNET_RPC_ENDPOINTS,
    url: TESTNET_RPC_ENDPOINTS[0],
    commitment: 'confirmed' as Commitment,
  },
} as const;

// Memo Program ID
export const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

// Get current network (default: mainnet)
export function getCurrentNetwork(): SolanaNetwork {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK as SolanaNetwork;
  if (!network || !['mainnet', 'devnet', 'testnet'].includes(network)) {
    return 'mainnet';
  }
  return network;
}

// Enhanced Connection creation with backup strategy
export function createSolanaConnection(network?: SolanaNetwork): Connection {
  const currentNetwork = network || getCurrentNetwork();
  
  let endpoint: string;
  
  if (typeof window !== 'undefined') {
    // Browser environment: prioritize proxy, fallback to direct connection
    endpoint = `${window.location.origin}/api/solana-rpc`;
  } else {
    // Server environment: direct connection
    const config = NETWORK_CONFIG[currentNetwork];
    endpoint = config.url;
  }

  // Create simple Connection
  return new Connection(endpoint, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 90000, // Increased to 90 seconds
    disableRetryOnRateLimit: true, // Disable retry on rate limit
    httpHeaders: {
      'User-Agent': 'SolanaSwapChat/1.0',
    },
    fetch: typeof window !== 'undefined' ? window.fetch.bind(window) : undefined,
  });
}

// Create backup Connection (direct connection on proxy failure)
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

// Connection cache system
interface ConnectionCache {
  connection: Connection;
  isHealthy: boolean;
  lastChecked: number;
  network: SolanaNetwork;
}

let connectionCache: ConnectionCache | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minute cache
const HEALTH_CHECK_TIMEOUT = 5000; // 5 second timeout

// Get stable Connection with caching and automatic backup
export async function getStableConnection(network?: SolanaNetwork): Promise<Connection> {
  const currentNetwork = network || getCurrentNetwork();
  const now = Date.now();

  // Check if cached connection is valid
  if (connectionCache && 
      connectionCache.network === currentNetwork && 
      connectionCache.isHealthy && 
      (now - connectionCache.lastChecked) < CACHE_DURATION) {
    return connectionCache.connection;
  }
  
  try {
    // First attempt: proxy connection
    const proxyConnection = createSolanaConnection(currentNetwork);

    // Quick connection test with timeout
    const healthCheckPromise = proxyConnection.getSlot();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
    );

    await Promise.race([healthCheckPromise, timeoutPromise]);

    // Connection successful - save to cache
    connectionCache = {
      connection: proxyConnection,
      isHealthy: true,
      lastChecked: now,
      network: currentNetwork
    };
    
    return proxyConnection;
    
  } catch {

    try {
      // Second attempt: direct connection
      const directConnection = createDirectConnection(currentNetwork);

      // Quick connection test
      const healthCheckPromise = directConnection.getSlot();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Direct health check timeout')), HEALTH_CHECK_TIMEOUT)
      );

      await Promise.race([healthCheckPromise, timeoutPromise]);

      // Direct connection successful - save to cache
      connectionCache = {
        connection: directConnection,
        isHealthy: true,
        lastChecked: now,
        network: currentNetwork
      };
      
      return directConnection;
      
    } catch {

      // Invalidate cache
      const oldCache = connectionCache;
      connectionCache = null;

      // Return existing connection if available (last resort)
      if (oldCache?.connection) {
        return oldCache.connection;
      }

      throw new Error('Unable to connect to Solana network');
    }
  }
}

// Stable Connection for blockhash retrieval (immediate fallback on error)
export async function getBlockhashConnection(network?: SolanaNetwork): Promise<Connection> {
  const currentNetwork = network || getCurrentNetwork();

  // First attempt: proxy connection
  try {
    const proxyConnection = createSolanaConnection(currentNetwork);

    // Test blockhash retrieval
    await proxyConnection.getLatestBlockhash('finalized');
    return proxyConnection;

  } catch {

    // Second attempt: direct connection
    try {
      const directConnection = createDirectConnection(currentNetwork);

      // Test blockhash retrieval
      await directConnection.getLatestBlockhash('finalized');
      return directConnection;

    } catch (directError) {
      throw new Error(`Unable to fetch blockhash: ${directError instanceof Error ? directError.message : String(directError)}`);
    }
  }
}

// Create Helius connection with WebSocket support
export function createHeliusConnection(apiKey?: string): Connection {
  const heliusApiKey = apiKey || 'd0c461b2-279b-41ed-9a00-93952a97afd0';
  const httpEndpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  const wsEndpoint = `wss://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

  return new Connection(httpEndpoint, {
    commitment: 'confirmed',
    wsEndpoint: wsEndpoint,
    confirmTransactionInitialTimeout: 90000,
    disableRetryOnRateLimit: false,
    httpHeaders: {
      'User-Agent': 'SolanaSwapChat/1.0',
    },
  });
}

// Invalidate connection cache (use when issues occur)
export function invalidateConnectionCache(): void {
  connectionCache = null;
}

// Automatic RPC endpoint selection (simplified as it's now handled by proxy)
export async function findHealthyRpcEndpoint(): Promise<string | null> {
  return '/api/solana-rpc';
}

// Network statistics information
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

// Connection status monitoring
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
    // Check initial status only (auto-repeat removed)
    this.checkStatus();
  }

  stopMonitoring() {
    this.isMonitoring = false;
    this.onStatusChange = undefined;
  }

  // Manual status check method
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

    // Auto-polling removed - call manually when needed
    // setTimeout(() => this.checkStatus(), 30000);
  }
}

// Default Connection instance (singleton)
let connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!connection) {
    connection = createSolanaConnection();
  }
  return connection;
}

// Network switching
export function switchNetwork(network: SolanaNetwork): Connection {
  connection = createSolanaConnection(network);
  return connection;
}

// Check Solana connection status
export async function checkSolanaConnection(conn?: Connection): Promise<{
  connected: boolean;
  network: string;
  blockHeight?: number;
  error?: string;
}> {
  const currentNetwork = getCurrentNetwork();
  const solanaConnection = conn || getSolanaConnection();

  try {
    // Quick health check (3 second timeout)
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

// Get account balance (SOL)
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

// Get account info
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

// Get latest blockhash
export async function getLatestBlockhash(conn?: Connection) {
  try {
    const solanaConnection = conn || getSolanaConnection();
    const latestBlockHash = await solanaConnection.getLatestBlockhash();
    return latestBlockHash;
  } catch (error) {
    throw error;
  }
}

// Confirm transaction
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
