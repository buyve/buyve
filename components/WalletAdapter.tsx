'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, Copy, ExternalLink, RefreshCw, X, AlertTriangle
} from 'lucide-react';

interface WalletAdapterProps {
  className?: string;
  showBalance?: boolean;
  showActions?: boolean;
}

export default function WalletAdapter({ 
  className = '', 
  showBalance = true, 
  showActions = true 
}: WalletAdapterProps) {
  const { 
    isConnected,
    isConnecting,
    isDisconnecting,
    address,
    balance,
    isLoadingBalance,
    error,
    connectWallet,
    disconnectWallet,
    fetchBalance,
    clearError,
    wallet
  } = useWallet();
  
  // 클라이언트 마운트 상태
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, [isConnected, address, wallet?.adapter?.name]);

  // 주소 복사
  const copyAddress = async () => {
    if (address && hasMounted) {
      try {
        await navigator.clipboard.writeText(address);
        alert('주소가 복사되었습니다!');
      } catch {
        alert('주소 복사에 실패했습니다');
      }
    }
  };

  // Solana Explorer 열기
  const openExplorer = () => {
    if (address && hasMounted) {
      const url = `https://solscan.io/account/${address}`;
      window.open(url, '_blank');
    }
  };

  // 주소 포맷팅
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // 잔고 포맷팅
  const formatBalance = (balance: number | null) => {
    if (balance === null) return '0.0000';
    return balance.toFixed(4);
  };

  if (!hasMounted) {
    return (
      <div className={`p-4 ${className}`}>
        <Card>
          <CardContent className="flex items-center justify-center p-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">로딩 중...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 에러 메시지 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button
              variant="neutral"
              size="sm"
              onClick={clearError}
              className="ml-2 p-1 h-auto"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 지갑 연결되지 않은 상태 */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              지갑 연결
            </CardTitle>
            <CardDescription>
              Solana 지갑을 연결하여 거래를 시작하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 연결 중 상태 표시 */}
            {isConnecting && (
              <Alert>
                <AlertDescription>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    지갑에 연결 중...
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* 지갑 연결 버튼 */}
            <Button 
              className="w-full"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? '연결 중...' : '지갑 연결'}
            </Button>
            
            {/* 디버깅 정보 표시 */}
            <div className="text-xs text-gray-500 space-y-1">
              <div>🔍 연결 상태: {isConnected ? '연결됨' : isConnecting ? '연결 중' : '연결 안됨'}</div>
              <div>🔑 주소: {address ? '있음' : '없음'}</div>
              <div>💼 지갑: {wallet?.adapter?.name || '없음'}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 지갑 연결된 상태 */}
      {isConnected && address && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                연결된 지갑
              </div>
              {wallet?.adapter?.name && (
                <Badge variant="neutral">{wallet.adapter.name}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 연결 해제 중 상태 표시 */}
            {isDisconnecting && (
              <Alert>
                <AlertDescription>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                    지갑 연결 해제 중...
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* 지갑 주소 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">지갑 주소</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                  {formatAddress(address)}
                </code>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={copyAddress}
                  className="shrink-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={openExplorer}
                  className="shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* 잔고 표시 */}
            {showBalance && (
              <div className="space-y-2">
                <label className="text-sm font-medium">SOL 잔고</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                    {isLoadingBalance ? '로딩 중...' : `${formatBalance(balance)} SOL`}
                  </code>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={fetchBalance}
                    disabled={isLoadingBalance}
                    className="shrink-0"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            )}

            {/* 액션 버튼들 */}
            {showActions && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="reverse"
                  onClick={disconnectWallet}
                  disabled={isDisconnecting}
                  className="flex-1"
                >
                  {isDisconnecting ? '해제 중...' : '연결 해제'}
                </Button>
                
                {showBalance && (
                  <Button
                    variant="neutral"
                    onClick={fetchBalance}
                    disabled={isLoadingBalance}
                    className="shrink-0"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 간단한 지갑 버튼 컴포넌트
export function WalletButton({ className = '' }: { className?: string }) {
  const { isConnected, address, nickname, connectWallet, isConnecting } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!hasMounted) {
    return (
      <Button variant="neutral" className={className} disabled>
        <Wallet className="h-4 w-4 mr-2" />
        로딩 중...
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button 
        onClick={connectWallet} 
        disabled={isConnecting}
        className={className}
      >
        <Wallet className="h-4 w-4 mr-2" />
        {isConnecting ? '연결 중...' : '지갑 연결'}
      </Button>
    );
  }

  return (
    <Button variant="neutral" className={className}>
      <Wallet className="h-4 w-4 mr-2" />
      {nickname || formatAddress(address || '')}
    </Button>
  );
} 