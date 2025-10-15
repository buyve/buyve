'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TradeMode = 'buy' | 'sell';

export interface TradeSettings {
  mode: TradeMode;
  quantity: string;
  slippage: string;
  priorityFee: string;
  selectedToken: {
    contractAddress: string;
    name: string;
    symbol?: string;
  } | null;
}

interface TradeSettingsContextType {
  settings: TradeSettings;
  updateSettings: (updates: Partial<TradeSettings>) => void;
  resetSettings: () => void;
  setTokenPair: (contractAddress: string, tokenName: string, symbol?: string) => void;
}

const defaultSettings: TradeSettings = {
  mode: 'buy',
  quantity: '',
  slippage: '20',
  priorityFee: '0.001',
  selectedToken: null,
};

const TradeSettingsContext = createContext<TradeSettingsContextType | undefined>(undefined);

export function TradeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TradeSettings>(defaultSettings);

  const updateSettings = (updates: Partial<TradeSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  const setTokenPair = (contractAddress: string, tokenName: string, symbol?: string) => {
    setSettings(prev => ({
      ...prev,
      selectedToken: {
        contractAddress,
        name: tokenName,
        symbol: symbol || tokenName
      }
    }));
  };

  useEffect(() => {
    const handleTokenPairChanged = (event: CustomEvent) => {
      const { contractAddress, tokenName, symbol } = event.detail;
      if (contractAddress && tokenName) {
        setTokenPair(contractAddress, tokenName, symbol);
      }
    };

    window.addEventListener('tokenPairChanged', handleTokenPairChanged as EventListener);
    return () => window.removeEventListener('tokenPairChanged', handleTokenPairChanged as EventListener);
  }, []);

  return (
    <TradeSettingsContext.Provider value={{ settings, updateSettings, resetSettings, setTokenPair }}>
      {children}
    </TradeSettingsContext.Provider>
  );
}

export function useTradeSettings() {
  const context = useContext(TradeSettingsContext);
  if (context === undefined) {
    throw new Error('useTradeSettings must be used within a TradeSettingsProvider');
  }
  return context;
} 