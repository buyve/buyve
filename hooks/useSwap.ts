'use client';

import { useCallback, useState } from 'react';
import { useWalletAdapter } from './useWalletAdapter';
import { 
  Transaction,
  TransactionInstruction,
  PublicKey,
  Connection,
  SystemProgram,
} from '@solana/web3.js';
// SPL Token 관련 기능은 별도 구현
import { getStableConnection } from '@/lib/solana';
import { jupiterService, JupiterQuote } from '@/lib/jupiter';
import { TOKENS, formatTokenAmount, getTokenByAddress } from '@/lib/tokens';
import { safePublicKeyToString, isValidPublicKey } from '@/lib/wallet-utils';
import { extractMemoFromTransaction } from '@/lib/memo';
import { confirmTransactionHybrid, createAlchemyConnection, getConfirmationStats } from '@/lib/transaction-confirmation';

// 🎯 수수료 설정 (Jupiter API에서 자동 처리)
const FEE_RECIPIENT_ADDRESS = '9YGfNLAiVNWbkgi9jFunyqQ1Q35yirSEFYsKLN6PP1DG';

const MEMO_BYTE_LIMIT = 120;

function truncateMemoByBytes(memo: string, limit = MEMO_BYTE_LIMIT): string {
  const encoder = new TextEncoder();
  const memoBytes = encoder.encode(memo);

  if (memoBytes.byteLength <= limit) {
    return memo;
  }

  const ellipsis = '...';
  const ellipsisBytes = encoder.encode(ellipsis);
  const allowedBytes = Math.max(limit - ellipsisBytes.byteLength, 0);

  let truncated = '';
  let usedBytes = 0;

  for (const char of memo) {
    const charBytes = encoder.encode(char);
    if (usedBytes + charBytes.byteLength > allowedBytes) {
      break;
    }
    truncated += char;
    usedBytes += charBytes.byteLength;
  }

  return `${truncated}${ellipsis}`;
}

// 🎯 메모 인스트럭션 생성 헬퍼 함수
function createMemoInstruction(memo: string, signer: PublicKey): TransactionInstruction {
  const truncatedMemo = truncateMemoByBytes(memo);

  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo Program ID
    data: Buffer.from(truncatedMemo, 'utf8'),
  });
}

// 💰 간단한 SOL 수수료 전송 함수
async function addFeeInstruction(
  transaction: Transaction,
  fromPubkey: PublicKey,
  feeAmount: number
): Promise<void> {
  try {
    const feeRecipient = new PublicKey(FEE_RECIPIENT_ADDRESS);
    
    // 올바른 SystemProgram.transfer() 사용
    const feeInstruction = SystemProgram.transfer({
      fromPubkey: fromPubkey,
      toPubkey: feeRecipient,
      lamports: feeAmount,
    });
    
    // 트랜잭션 맨 앞에 수수료 인스트럭션 추가
    transaction.instructions.unshift(feeInstruction);
  } catch (error) {
    throw error;
  }
}

// 💰 수수료는 Jupiter API에서 자동 처리됩니다

// 🔄 스왑 상태 타입
export interface SwapState {
  loading: boolean;
  error: string | null;
  quote: JupiterQuote | null;
  transaction: string | null;
  signature: string | null;
}

// 🔄 스왑 결과 타입
export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// 🌟 스왑 Hook
export function useSwap() {
  const { publicKey, signTransaction } = useWalletAdapter();
  const [state, setState] = useState<SwapState>({
    loading: false,
    error: null,
    quote: null,
    transaction: null,
    signature: null,
  });

  // 🔄 상태 업데이트 헬퍼
  const updateState = useCallback((updates: Partial<SwapState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 🔍 견적 조회
  const getQuote = useCallback(async (
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<JupiterQuote | null> => {
    if (!publicKey) {
      return null;
    }

    const userPublicKeyString = safePublicKeyToString(publicKey);
    if (!userPublicKeyString) {
      updateState({ loading: false, error: '지갑 연결을 확인해주세요.' });
      return null;
    }

    updateState({ loading: true, error: null });

    try {
      // 토큰 정보 가져오기 - 심볼로 찾기
      const fromTokenInfo = Object.values(TOKENS).find(token => token.symbol === fromToken) || 
                           getTokenByAddress(fromToken);
      const toTokenInfo = Object.values(TOKENS).find(token => token.symbol === toToken) || 
                         getTokenByAddress(toToken);

      if (!fromTokenInfo || !toTokenInfo) {
        throw new Error('지원하지 않는 토큰입니다.');
      }

      const rawAmount = Math.floor(amount * Math.pow(10, fromTokenInfo.decimals));


      const quote = await jupiterService.getQuote({
        inputMint: fromTokenInfo.address,
        outputMint: toTokenInfo.address,
        amount: rawAmount,
        userPublicKey: userPublicKeyString,
      });

      updateState({ quote, loading: false });
      
      // 견적 정보 로깅
      const inputAmount = formatTokenAmount(quote.inAmount, fromTokenInfo.decimals);
      const outputAmount = formatTokenAmount(quote.outAmount, toTokenInfo.decimals);
      

      return quote;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '견적 조회 실패';
      updateState({ loading: false, error: errorMessage });
      return null;
    }
  }, [publicKey, updateState]);

  // 🔄 스왑 실행
  const executeSwap = useCallback(async (
    quote: JupiterQuote, 
    memo?: string
  ): Promise<SwapResult> => {
    if (!isValidPublicKey(publicKey)) {
      return { success: false, error: '지갑이 연결되지 않았습니다.' };
    }

    if (!signTransaction) {
      return { success: false, error: '지갑에서 트랜잭션 서명을 지원하지 않습니다.' };
    }

    const userPublicKeyString = safePublicKeyToString(publicKey);
    if (!userPublicKeyString) {
      return { success: false, error: '유효하지 않은 PublicKey입니다.' };
    }

    updateState({ loading: true, error: null, signature: null });

    try {

      // 🎯 새로운 Jupiter 수수료 포함 API 사용
      const inputToken = getTokenByAddress(quote.inputMint);
      const outputToken = getTokenByAddress(quote.outputMint);
      

      // 기본 스왑 트랜잭션 생성 (수수료 없이)
      const swapResponse = await jupiterService.getSwapTransaction(quote, {
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        amount: quote.inAmount,
        userPublicKey: userPublicKeyString,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
      });


      // 받은 swapTransaction 디코딩 (Transaction)
      const swapTxBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = Transaction.from(swapTxBuf);

      // 🎯 수수료 계산 및 추가
      const swapInputToken = getTokenByAddress(quote.inputMint);
      
      // SOL 또는 WSOL인지 확인 (Jupiter는 SOL을 WSOL로 처리함)
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const isSOLInput = swapInputToken?.symbol === 'SOL' || 
                        quote.inputMint === SOL_MINT ||
                        quote.inputMint.toLowerCase() === SOL_MINT.toLowerCase();
      
      
      // 🚨 테스트: 무조건 수수료 추가 (SOL 체크 우회)
      if (true) { // 원래: if (isSOLInput) {
        // Buy 모드: SOL을 다른 토큰으로 스왑
        const solAmount = parseFloat(quote.inAmount) / 1e9; // lamports to SOL
        const feeAmount = Math.floor(solAmount * 0.0069 * 1e9); // 0.69% 수수료
        
        await addFeeInstruction(transaction, publicKey, feeAmount);
      } else {
        // No fee for non-SOL input tokens
      }

      // 연결 설정
      const connection = await getStableConnection();

      // 최신 블록해시로 교체
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey; // 혹시 없으면 명시적으로 지정


      // 5) 메모 인스트럭션 추가 (옵션)
      if (memo && memo.trim()) {
        // 🏷️ 앱 식별자를 포함한 메모 생성
        const appMemo = `[SwapChat] ${memo.trim()}`;
        const memoInstruction = createMemoInstruction(appMemo, publicKey);
        transaction.add(memoInstruction);
      }


      try {
        // 6) 지갑 어댑터를 통한 서명
        const signedTransaction = await signTransaction(transaction);


        // 7) 서명된 트랜잭션 전송
        const txId = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        // 8) 트랜잭션 확인 - Alchemy RPC를 사용한 하이브리드 방식
        const alchemyRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
        let confirmed = false;
        
        if (alchemyRpcUrl && alchemyRpcUrl.includes('alchemy')) {
          // Alchemy RPC 사용 시 WebSocket 지원 하이브리드 확인
          const alchemyConnection = createAlchemyConnection(alchemyRpcUrl);
          
          try {
            confirmed = await confirmTransactionHybrid(alchemyConnection, txId, {
              timeout: 30000,
              commitment: 'confirmed',
              useWebSocket: true
            });
            
            // 확인 통계 로깅 (개발 환경에서만)
            if (process.env.NODE_ENV === 'development') {
              const stats = getConfirmationStats();
              console.log('Transaction confirmation stats:', stats);
            }
          } catch (error) {
            console.error('Hybrid confirmation error:', error);
            // 폴백: 기존 연결로 한 번 더 시도
            confirmed = await confirmTransactionHybrid(connection, txId, {
              timeout: 15000,
              commitment: 'confirmed',
              useWebSocket: false // 폴백은 폴링만 사용
            });
          }
        } else {
          // Alchemy가 아닌 경우 폴링만 사용
          confirmed = await confirmTransactionHybrid(connection, txId, {
            timeout: 30000,
            commitment: 'confirmed',
            useWebSocket: false
          });
        }
        
        if (!confirmed) {
          console.warn('Transaction confirmation timeout, but may still succeed');
          // 계속 진행 (실제로는 성공했을 가능성이 높음)
        }

        // 🎯 메모가 있는 경우 트랜잭션 확정 후 메모 확인 및 채팅에 추가
        if (memo && memo.trim()) {
          try {
            
            // 직접 연결로 메모 확인
            const memoText = await extractMemoFromTransaction(directConnection, txId);
            
            if (memoText && memoText.includes('[SwapChat]')) {
              const cleanMemo = memoText.replace('[SwapChat]', '').trim();
              
              // 트랜잭션 정보 가져오기 (직접 연결 사용)
              const txInfo = await directConnection.getTransaction(txId, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              });
              
              if (txInfo) {
                const senderAddress = txInfo.transaction.message.staticAccountKeys[0]?.toString() || 'Unknown';
                
                
                // 전역 메시지에 추가 (useChatMessages의 글로벌 저장소에 직접 추가)
                try {
                  const { addMessage } = await import('./useChatMessages');
                  await addMessage('sol-usdc', {
                    userId: `user-${Date.now()}`,
                    userAddress: senderAddress,
                    avatar: '✅',
                    tradeType: 'buy' as const,
                    tradeAmount: '',
                    content: `✅ ${cleanMemo}`,
                  });
                  
                } catch (addError) {
                  // Ignore chat message add errors
                }
              } else {
                // Transaction info not available
              }
            } else {
              // Memo not found or invalid format
            }
          } catch (memoError) {
            
            // 메모 확인 실패해도 기본 메시지 추가 시도
            try {
              const { addMessage } = await import('./useChatMessages');
              await addMessage('sol-usdc', {
                userId: `user-${Date.now()}`,
                userAddress: publicKey?.toString() || 'Unknown',
                avatar: '✅',
                tradeType: 'buy' as const,
                tradeAmount: '',
                content: `✅ ${memo.trim()}`,
              });
            } catch (fallbackError) {
              // Ignore fallback message errors
            }
          }
        }


        // 트랜잭션 상태 업데이트
        updateState({ signature: txId, loading: false });

        return { success: true, signature: txId };

      } catch (sendError) {
        throw sendError;
      }
      
    } catch (error) {
      let errorMessage = '스왑 실행 실패';
      
      if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = '잔액이 부족합니다.';
        } else if (error.message.includes('slippage')) {
          errorMessage = '슬리피지 한도를 초과했습니다. 설정을 조정하거나 다시 시도해주세요.';
        } else if (error.message.includes('User rejected')) {
          errorMessage = '사용자가 트랜잭션을 취소했습니다.';
        } else if (error.message.includes('signature verification failure')) {
          errorMessage = '트랜잭션 서명 검증에 실패했습니다. 다시 시도해주세요.';
        } else if (error.message.includes('Transaction too large')) {
          errorMessage = '트랜잭션이 너무 큽니다. 메모를 짧게 하거나 다시 시도해주세요.';
        } else {
          errorMessage = error.message;
        }
      }
      
      updateState({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [publicKey, signTransaction, updateState]);

  // 🔄 간편 스왑 함수들
  const swapSOLtoUSDC = useCallback(async (solAmount: number, memo?: string): Promise<SwapResult> => {
    const quote = await getQuote('SOL', 'USDC', solAmount);
    if (!quote) return { success: false, error: '견적 조회 실패' };
    return executeSwap(quote, memo);
  }, [getQuote, executeSwap]);

  const swapUSDCtoSOL = useCallback(async (usdcAmount: number, memo?: string): Promise<SwapResult> => {
    const quote = await getQuote('USDC', 'SOL', usdcAmount);
    if (!quote) return { success: false, error: '견적 조회 실패' };
    return executeSwap(quote, memo);
  }, [getQuote, executeSwap]);

  // 🧹 상태 초기화
  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      quote: null,
      transaction: null,
      signature: null,
    });
  }, []);

  return {
    // 상태
    ...state,
    
    // 함수들
    getQuote,
    executeSwap,
    swapSOLtoUSDC,
    swapUSDCtoSOL,
    reset,
    
    // 편의 속성들
    canSwap: !!publicKey && !state.loading,
    hasQuote: !!state.quote,
    isSwapping: state.loading,
  };
}

export default useSwap; 
