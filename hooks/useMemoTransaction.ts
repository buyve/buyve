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

  // State management
  const [state, setState] = useState<UseMemoState>({
    isSending: false,
    lastTransaction: null,
    error: null,
  });

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Send memo message
  const sendMemo = useCallback(async (
    type: MessageType,
    content: string,
    options: SendMemoOptions = {}
  ): Promise<MemoTransactionResult> => {
    if (!publicKey) {
      throw new Error('Wallet is not connected');
    }

    if (!signTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    try {
      setState(prev => ({ ...prev, isSending: true, error: null }));

      // Create memo message format
      const message = formatMemoMessage(
        type,
        content,
        options.tokenSymbol,
        options.quantity,
        options.price,
        options.protocol
      );

      // Validate message
      const validation = validateMemoMessage(message);
      if (!validation.isValid) {
        throw new Error(`Message validation failed: ${validation.errors.join(', ')}`);
      }

      // Create transaction
      const transaction = createMemoTransaction(message, publicKey);

      // Set latest blockhash
      const stableConnection = await getStableConnection();
      const { blockhash } = await stableConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Sign transaction
      const signedTransaction = await signTransaction(transaction);

      // Send transaction (with retry)
      const signature = await sendMemoTransactionWithRetry(
        stableConnection,
        signedTransaction,
        options.maxRetries || 3,
        options.retryDelay || 1000
      );

      // Fetch transaction info
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to send memo';
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
    // State
    isSending: state.isSending,
    lastTransaction: state.lastTransaction,
    error: state.error,

    // Actions
    sendMemo,
    sendChatMessage,
    sendBuyMessage,
    sendSellMessage,
    clearError,

    // Utilities
    getMemoFromTransaction,
    parseMessage,
    validateMessage,
    formatMessage,

    // Status check
    isReady: Boolean(publicKey && signTransaction),
  };
}

export default useMemo; 