'use client';

import { useState, useCallback, useEffect } from 'react';
import { TradeSettings, TradeExecution } from '@/types';

export function useTrade() {
  const [settings, setSettings] = useState<TradeSettings>({
    mode: 'buy',
    amount: '',
    slippage: '1',
    priorityFee: '0.001',
    autoExecute: true,
  });

  const [executions, setExecutions] = useState<TradeExecution[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useCallback((updates: Partial<TradeSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const executeTrade = useCallback(async (
    roomId: string, 
    messageContent: string,
    overrideSettings?: Partial<TradeSettings>
  ) => {
    const tradeSettings = { ...settings, ...overrideSettings };
    
    if (!tradeSettings.amount || parseFloat(tradeSettings.amount) <= 0) {
      setError('Please enter a valid trade amount.');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const execution: TradeExecution = {
        id: Date.now().toString(),
        userId: 'current-user',
        roomId,
        messageId: '',
        type: tradeSettings.mode,
        amount: tradeSettings.amount,
        price: tradeSettings.mode === 'buy' ? '150.25' : '149.75',
        txHash: '0x' + Math.random().toString(16).substr(2, 64),
        status: 'pending',
        createdAt: new Date(),
      };

      setExecutions(prev => [execution, ...prev]);

      setTimeout(() => {
        setExecutions(prev => 
          prev.map(exec => 
            exec.id === execution.id 
              ? { ...exec, status: 'confirmed' as const, confirmedAt: new Date() }
              : exec
          )
        );
      }, 3000);

      return execution;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute trade.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [settings]);

  const setPreset = useCallback((preset: string) => {
    setSettings(prev => ({ ...prev, amount: preset }));
  }, []);

  const toggleMode = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      mode: prev.mode === 'buy' ? 'sell' : 'buy',
      amount: ''
    }));
  }, []);

  const fetchTradeHistory = useCallback(async (limit = 50) => {
    try {
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trade history.');
    }
  }, [executions]);

  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('tradeSettings', JSON.stringify(settings));
    } catch (err) {
    }
  }, [settings]);

  const loadSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('tradeSettings');
      if (saved) {
        const savedSettings = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...savedSettings }));
      }
    } catch (err) {
    }
  }, []);

  const validateSettings = useCallback(() => {
    const errors: string[] = [];

    if (!settings.amount || parseFloat(settings.amount) <= 0) {
      errors.push('Please enter a valid trade amount.');
    }

    if (settings.mode === 'buy' && parseFloat(settings.amount) > 100) {
      errors.push('SOL trade amount is too large.');
    }

    if (settings.mode === 'sell' && (parseFloat(settings.amount) < 1 || parseFloat(settings.amount) > 100)) {
      errors.push('Sell percentage must be between 1-100%.');
    }

    if (parseFloat(settings.slippage) < 0.1 || parseFloat(settings.slippage) > 50) {
      errors.push('Slippage must be between 0.1-50%.');
    }

    if (parseFloat(settings.priorityFee) < 0 || parseFloat(settings.priorityFee) > 1) {
      errors.push('Priority fee must be between 0-1 SOL.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [settings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  return {
    settings,
    executions,
    isExecuting,
    error,
    updateSettings,
    executeTrade,
    setPreset,
    toggleMode,
    fetchTradeHistory,
    saveSettings,
    loadSettings,
    validateSettings,
    clearError: () => setError(null),
  };
} 