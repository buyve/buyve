'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useWalletInternal } from '@/hooks/useWallet';

interface WalletContextType {
  // 연결 상태
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  
  // 지갑 정보
  address: string | null;
  publicKey: any;
  wallet: any;
  wallets: any[];
  
  // 프로필 정보
  profile: any;
  nickname: string;
  avatar: string;
  isLoadingProfile: boolean;
  authToken: string | null;
  
  // 잔고 정보
  balance: number | null;
  isLoadingBalance: boolean;
  
  // 에러 상태
  error: string | null;
  
  // 액션
  connectWallet: () => void;
  disconnectWallet: () => Promise<void>;
  updateProfile: (updates: { nickname?: string; avatar?: string }) => Promise<void>;
  fetchBalance: () => Promise<void>;
  clearError: () => void;
  select: (walletName: any) => void;
  
  // 서명 함수들
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
  signTransaction: any;
  sendTransaction: any;
  
  // 모달 제어
  setVisible: (visible: boolean) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const walletData = useWalletInternal();
  
  return (
    <WalletContext.Provider value={walletData}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}