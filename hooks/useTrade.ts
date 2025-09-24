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

  // 거래 설정 업데이트
  const updateSettings = useCallback((updates: Partial<TradeSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // 거래 실행
  const executeTrade = useCallback(async (
    roomId: string, 
    messageContent: string,
    overrideSettings?: Partial<TradeSettings>
  ) => {
    const tradeSettings = { ...settings, ...overrideSettings };
    
    if (!tradeSettings.amount || parseFloat(tradeSettings.amount) <= 0) {
      setError('올바른 거래 수량을 입력해주세요.');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      // TODO: 실제 DEX 거래 실행 로직
      // const tradeParams = {
      //   type: tradeSettings.mode,
      //   amount: tradeSettings.amount,
      //   slippage: tradeSettings.slippage,
      //   priorityFee: tradeSettings.priorityFee,
      // };

      // Mock 거래 실행
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

      // 거래 확인 시뮬레이션 (실제로는 블록체인 이벤트 리스닝)
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
      const errorMessage = err instanceof Error ? err.message : '거래 실행에 실패했습니다.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [settings]);

  // 프리셋 설정
  const setPreset = useCallback((preset: string) => {
    setSettings(prev => ({ ...prev, amount: preset }));
  }, []);

  // 거래 모드 변경
  const toggleMode = useCallback(() => {
    setSettings(prev => ({ 
      ...prev, 
      mode: prev.mode === 'buy' ? 'sell' : 'buy',
      amount: '' // 모드 변경 시 수량 초기화
    }));
  }, []);

  // 거래 내역 조회
  const fetchTradeHistory = useCallback(async (limit = 50) => {
    try {
      // TODO: 실제 API 호출
      // const response = await fetch(`/api/trades?limit=${limit}`);
      // const data = await response.json();
      
      // Mock 데이터는 이미 설정됨
    } catch (err) {
      setError(err instanceof Error ? err.message : '거래 내역 조회에 실패했습니다.');
    }
  }, [executions]);

  // 설정 저장/로드 (localStorage)
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

  // 유효성 검사
  const validateSettings = useCallback(() => {
    const errors: string[] = [];

    if (!settings.amount || parseFloat(settings.amount) <= 0) {
      errors.push('올바른 거래 수량을 입력해주세요.');
    }

    if (settings.mode === 'buy' && parseFloat(settings.amount) > 100) {
      errors.push('SOL 거래 수량이 너무 큽니다.');
    }

    if (settings.mode === 'sell' && (parseFloat(settings.amount) < 1 || parseFloat(settings.amount) > 100)) {
      errors.push('매도 비율은 1-100% 사이여야 합니다.');
    }

    if (parseFloat(settings.slippage) < 0.1 || parseFloat(settings.slippage) > 50) {
      errors.push('슬리피지는 0.1-50% 사이여야 합니다.');
    }

    if (parseFloat(settings.priorityFee) < 0 || parseFloat(settings.priorityFee) > 1) {
      errors.push('프라이어리티 수수료는 0-1 SOL 사이여야 합니다.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [settings]);

  // 초기 설정 로드
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 거래 내역 초기 로드
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