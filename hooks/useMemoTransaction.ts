'use client';

import { useState, useCallback } from 'react';
import { useWalletAdapter } from './useWalletAdapter';
import { 
  createMemoTransaction, 
  sendMemoTransactionWithRetry,
  formatMemoMessage,
  parseMemoMessage,
  validateMemoMessage,
  extractMemoFromTransaction,
  MemoMessage, 
  MessageType, 
  SupportedProtocol,
  MemoTransactionResult
} from '@/lib/memo';
import { getStableConnection } from '@/lib/solana';

interface UseMemoState {
  isSending: boolean;
  lastTransaction: MemoTransactionResult | null;
  error: string | null;
}

interface SendMemoOptions {
  tokenSymbol?: string;
  quantity?: number;
  price?: number;
  protocol?: SupportedProtocol;
  maxRetries?: number;
  retryDelay?: number;
}

export function useMemo() {
  const { publicKey, signTransaction } = useWalletAdapter();

  // 상태 관리
  const [state, setState] = useState<UseMemoState>({
    isSending: false,
    lastTransaction: null,
    error: null,
  });

  // 에러 클리어
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 메모 메시지 전송
  const sendMemo = useCallback(async (
    type: MessageType,
    content: string,
    options: SendMemoOptions = {}
  ): Promise<MemoTransactionResult> => {
    if (!publicKey) {
      throw new Error('지갑이 연결되지 않았습니다');
    }

    if (!signTransaction) {
      throw new Error('지갑이 트랜잭션 서명을 지원하지 않습니다');
    }

    try {
      setState(prev => ({ ...prev, isSending: true, error: null }));

      // 메모 메시지 포맷 생성
      const message = formatMemoMessage(
        type,
        content,
        options.tokenSymbol,
        options.quantity,
        options.price,
        options.protocol
      );

      // 메시지 유효성 검증
      const validation = validateMemoMessage(message);
      if (!validation.isValid) {
        throw new Error(`메시지 유효성 검증 실패: ${validation.errors.join(', ')}`);
      }

      // 트랜잭션 생성
      const transaction = createMemoTransaction(message, publicKey);

      // 최신 블록해시 설정
      const stableConnection = await getStableConnection();
      const { blockhash } = await stableConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // 트랜잭션 서명
      const signedTransaction = await signTransaction(transaction);

      // 트랜잭션 전송 (재시도 포함)
      const signature = await sendMemoTransactionWithRetry(
        stableConnection,
        signedTransaction,
        options.maxRetries || 3,
        options.retryDelay || 1000
      );

      // 트랜잭션 정보 조회
      const txInfo = await stableConnection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      const result: MemoTransactionResult = {
        signature,
        message,
        protocol: options.protocol,
        timestamp: new Date(),
        blockTime: txInfo?.blockTime ? new Date(txInfo.blockTime * 1000).getTime() : undefined,
      };

      setState(prev => ({
        ...prev,
        isSending: false,
        lastTransaction: result,
        error: null,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '메모 전송에 실패했습니다';
      setState(prev => ({
        ...prev,
        isSending: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [publicKey, signTransaction]);

  // 채팅 메시지 전송
  const sendChatMessage = useCallback(async (
    content: string,
    options: Omit<SendMemoOptions, 'tokenSymbol' | 'quantity' | 'price'> = {}
  ): Promise<MemoTransactionResult> => {
    return sendMemo('CHAT', content, options);
  }, [sendMemo]);

  // 매수 메시지 전송
  const sendBuyMessage = useCallback(async (
    tokenSymbol: string,
    quantity: number,
    price: number,
    protocol?: SupportedProtocol,
    options: Omit<SendMemoOptions, 'tokenSymbol' | 'quantity' | 'price' | 'protocol'> = {}
  ): Promise<MemoTransactionResult> => {
    return sendMemo('BUY', '', {
      ...options,
      tokenSymbol,
      quantity,
      price,
      protocol,
    });
  }, [sendMemo]);

  // 매도 메시지 전송
  const sendSellMessage = useCallback(async (
    tokenSymbol: string,
    quantity: number,
    price: number,
    protocol?: SupportedProtocol,
    options: Omit<SendMemoOptions, 'tokenSymbol' | 'quantity' | 'price' | 'protocol'> = {}
  ): Promise<MemoTransactionResult> => {
    return sendMemo('SELL', '', {
      ...options,
      tokenSymbol,
      quantity,
      price,
      protocol,
    });
  }, [sendMemo]);

  // 트랜잭션에서 메모 추출
  const getMemoFromTransaction = useCallback(async (signature: string): Promise<string | null> => {
    try {
      const stableConnection = await getStableConnection();
      return await extractMemoFromTransaction(stableConnection, signature);
    } catch (error) {
      return null;
    }
  }, []);

  // 메모 메시지 파싱
  const parseMessage = useCallback((memoText: string): MemoMessage => {
    return parseMemoMessage(memoText);
  }, []);

  // 메시지 유효성 검증
  const validateMessage = useCallback((message: string) => {
    return validateMemoMessage(message);
  }, []);

  // 메시지 포맷 생성
  const formatMessage = useCallback((
    type: MessageType,
    content: string,
    tokenSymbol?: string,
    quantity?: number,
    price?: number,
    protocol?: SupportedProtocol
  ): string => {
    return formatMemoMessage(type, content, tokenSymbol, quantity, price, protocol);
  }, []);

  return {
    // 상태
    isSending: state.isSending,
    lastTransaction: state.lastTransaction,
    error: state.error,
    
    // 액션
    sendMemo,
    sendChatMessage,
    sendBuyMessage,
    sendSellMessage,
    clearError,
    
    // 유틸리티
    getMemoFromTransaction,
    parseMessage,
    validateMessage,
    formatMessage,
    
    // 상태 확인
    isReady: Boolean(publicKey && signTransaction),
  };
}

export default useMemo; 