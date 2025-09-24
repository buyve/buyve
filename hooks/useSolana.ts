import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection } from '@solana/web3.js';
import { 
  getSolanaConnection, 
  checkSolanaConnection, 
  switchNetwork,
  getCurrentNetwork,
  getNetworkStats,
  SolanaConnectionMonitor,
  type SolanaNetwork 
} from '@/lib/solana';

interface SolanaConnectionStatus {
  connected: boolean;
  network: string;
  blockHeight?: number;
  error?: string;
  loading: boolean;
}

interface NetworkStats {
  blockHeight: number;
  epochInfo: {
    epoch: number;
    slotIndex: number;
    slotsInEpoch: number;
    absoluteSlot: number;
  };
  supply: {
    total: number;
    circulating: number;
    nonCirculating: number;
  };
}

export function useSolana() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [status, setStatus] = useState<SolanaConnectionStatus>({
    connected: false,
    network: '',
    loading: true,
  });
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [currentNetwork, setCurrentNetwork] = useState<SolanaNetwork>('mainnet');
  
  const monitorRef = useRef<SolanaConnectionMonitor | null>(null);

  // 연결 초기화
  const initializeConnection = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      
      const conn = getSolanaConnection();
      const network = getCurrentNetwork();
      
      setConnection(conn);
      setCurrentNetwork(network);
      
      // 연결 상태 확인
      const connectionStatus = await checkSolanaConnection(conn);
      setStatus({
        ...connectionStatus,
        loading: false,
      });

      // 네트워크 통계 가져오기
      if (connectionStatus.connected) {
        try {
          const networkStats = await getNetworkStats(conn);
          setStats(networkStats);
        } catch (error) {
        }
      }

    } catch (error) {
      setStatus({
        connected: false,
        network: getCurrentNetwork(),
        loading: false,
        error: error instanceof Error ? error.message : 'Initialization failed',
      });
    }
  }, []);

  // 네트워크 전환
  const changeNetwork = useCallback(async (network: SolanaNetwork) => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      
      const newConnection = switchNetwork(network);
      setConnection(newConnection);
      setCurrentNetwork(network);
      
      // 새 연결 상태 확인
      const connectionStatus = await checkSolanaConnection(newConnection);
      setStatus({
        ...connectionStatus,
        loading: false,
      });

      // 네트워크 통계 업데이트
      if (connectionStatus.connected) {
        try {
          const networkStats = await getNetworkStats(newConnection);
          setStats(networkStats);
        } catch (error) {
        }
      }

      // 모니터링 재시작
      if (monitorRef.current) {
        monitorRef.current.stopMonitoring();
        monitorRef.current = new SolanaConnectionMonitor(newConnection);
        monitorRef.current.startMonitoring((monitorStatus) => {
          setStatus(prev => ({
            ...prev,
            connected: monitorStatus.connected,
            error: monitorStatus.error,
          }));
        });
      }

    } catch (error) {
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Network change failed',
      }));
    }
  }, []);

  // 연결 재시도
  const reconnect = useCallback(async () => {
    await initializeConnection();
  }, [initializeConnection]);

  // 통계 새로고침
  const refreshStats = useCallback(async () => {
    if (!connection || !status.connected) return;
    
    try {
      const networkStats = await getNetworkStats(connection);
      setStats(networkStats);
    } catch (error) {
    }
  }, [connection, status.connected]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    initializeConnection();
  }, [initializeConnection]);

  // 연결 상태 모니터링 시작 제거 (필요시에만 수동 확인)
  useEffect(() => {
    if (connection && status.connected) {
      // 🚫 자동 모니터링 제거 - 필요시에만 수동으로 확인
      monitorRef.current = new SolanaConnectionMonitor(connection);
      
      // 자동 모니터링 시작하지 않음
      // monitorRef.current.startMonitoring(...)

      return () => {
        monitorRef.current?.stopMonitoring();
      };
    }
  }, [connection, status.connected]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      monitorRef.current?.stopMonitoring();
    };
  }, []);

  return {
    // 상태
    connection,
    status,
    stats,
    currentNetwork,
    
    // 액션
    changeNetwork,
    reconnect,
    refreshStats,
    
    // 헬퍼
    isConnected: status.connected,
    isLoading: status.loading,
    hasError: !!status.error,
  };
}

// Solana 네트워크 상태만 관리하는 경량 버전 (수동 새로고침만)
export function useSolanaStatus() {
  const [status, setStatus] = useState<SolanaConnectionStatus>({
    connected: false,
    network: '',
    loading: true,
  });

  // 상태 체크 함수
  const checkStatus = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      const connectionStatus = await checkSolanaConnection();
      setStatus({
        ...connectionStatus,
        loading: false,
      });
    } catch (error) {
      setStatus({
        connected: false,
        network: getCurrentNetwork(),
        loading: false,
        error: error instanceof Error ? error.message : 'Status check failed',
      });
    }
  }, []);

  // 초기 한 번만 상태 체크 (자동 폴링 제거)
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    ...status,
    refresh: checkStatus, // 수동 새로고침 함수 제공
  };
}

export default useSolana; 