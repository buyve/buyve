'use client';

import { useCallback, useState } from 'react';
import { useWalletAdapter } from './useWalletAdapter';
import { 
  Transaction,
  TransactionInstruction,
  PublicKey,
  Connection,
} from '@solana/web3.js';
// SPL Token features are implemented separately
import { getStableConnection } from '@/lib/solana';
import { jupiterService, JupiterQuote } from '@/lib/jupiter';
import { TOKENS, formatTokenAmount, getTokenByAddress } from '@/lib/tokens';
import { safePublicKeyToString, isValidPublicKey } from '@/lib/wallet-utils';
import { extractMemoFromTransaction } from '@/lib/memo';
import { confirmTransactionHybrid, createAlchemyConnection, getConfirmationStats } from '@/lib/transaction-confirmation';

// Fee configuration (automatically handled by Jupiter API)
const FEE_RECIPIENT_ADDRESS = 'AmDH1y39wJGjmnUqijMuui3nvYq2E2m2WHU6Ssnc2hYL';
const FEE_RATE = 0.0069;
const PLATFORM_FEE_BPS = Math.round(FEE_RATE * 10000);

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

// Helper function to create memo instruction
function createMemoInstruction(memo: string, signer: PublicKey): TransactionInstruction {
  const truncatedMemo = truncateMemoByBytes(memo);

  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo Program ID
    data: Buffer.from(truncatedMemo, 'utf8'),
  });
}

// Swap state type
export interface SwapState {
  loading: boolean;
  error: string | null;
  quote: JupiterQuote | null;
  transaction: string | null;
  signature: string | null;
}

// Swap result type
export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// Swap Hook
export function useSwap() {
  const { publicKey, signTransaction } = useWalletAdapter();
  const [state, setState] = useState<SwapState>({
    loading: false,
    error: null,
    quote: null,
    transaction: null,
    signature: null,
  });

  // State update helper
  const updateState = useCallback((updates: Partial<SwapState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Get quote
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
      updateState({ loading: false, error: 'Please check your wallet connection.' });
      return null;
    }

    updateState({ loading: true, error: null });

    try {
      // Get token info - find by symbol
      const fromTokenInfo = Object.values(TOKENS).find(token => token.symbol === fromToken) ||
                           getTokenByAddress(fromToken);
      const toTokenInfo = Object.values(TOKENS).find(token => token.symbol === toToken) ||
                         getTokenByAddress(toToken);

      if (!fromTokenInfo || !toTokenInfo) {
        throw new Error('Unsupported token.');
      }

      const rawAmount = Math.floor(amount * Math.pow(10, fromTokenInfo.decimals));

      const quote = await jupiterService.getQuote({
        inputMint: fromTokenInfo.address,
        outputMint: toTokenInfo.address,
        amount: rawAmount,
        userPublicKey: userPublicKeyString,
        platformFeeBps: PLATFORM_FEE_BPS,
      });

      updateState({ quote, loading: false });

      return quote;


    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get quote';
      updateState({ loading: false, error: errorMessage });
      return null;
    }
  }, [publicKey, updateState]);

  // Execute swap
  const executeSwap = useCallback(async (
    quote: JupiterQuote, 
    memo?: string
  ): Promise<SwapResult> => {
    if (!isValidPublicKey(publicKey)) {
      return { success: false, error: 'Wallet is not connected.' };
    }

    if (!signTransaction) {
      return { success: false, error: 'Wallet does not support transaction signing.' };
    }

    const userPublicKeyString = safePublicKeyToString(publicKey);
    if (!userPublicKeyString) {
      return { success: false, error: 'Invalid PublicKey.' };
    }

    updateState({ loading: true, error: null, signature: null });

    try {
      // Request to handle fees through Jupiter platform features
      const swapResponse = await jupiterService.getSwapTransaction(quote, {
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        amount: quote.inAmount,
        userPublicKey: userPublicKeyString,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        feeAccount: FEE_RECIPIENT_ADDRESS,
        platformFeeBps: PLATFORM_FEE_BPS,
      });

      // Decode received swapTransaction
      const swapTxBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = Transaction.from(swapTxBuf);

      // Setup connection
      const connection = await getStableConnection();

      // Replace with latest blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey; // Explicitly set if not present

      // Add memo instruction (optional)
      if (memo && memo.trim()) {
        // Create memo with app identifier
        const appMemo = `[SwapChat] ${memo.trim()}`;
        const memoInstruction = createMemoInstruction(appMemo, publicKey);
        transaction.add(memoInstruction);
      }

      try {
        // Sign through wallet adapter
        const signedTransaction = await signTransaction(transaction);

        // Send signed transaction
        const txId = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });

        // Confirm transaction - hybrid approach using Alchemy RPC
        const alchemyRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
        let confirmed = false;

        if (alchemyRpcUrl && alchemyRpcUrl.includes('alchemy')) {
          // Hybrid confirmation with WebSocket support when using Alchemy RPC
          const alchemyConnection = createAlchemyConnection(alchemyRpcUrl);

          try {
            confirmed = await confirmTransactionHybrid(alchemyConnection, txId, {
              timeout: 30000,
              commitment: 'confirmed',
              useWebSocket: true
            });

          } catch (error) {
            console.error('Hybrid confirmation error:', error);
            // Fallback: retry with existing connection
            confirmed = await confirmTransactionHybrid(connection, txId, {
              timeout: 15000,
              commitment: 'confirmed',
              useWebSocket: false // Fallback uses polling only
            });
          }
        } else {
          // Use polling only for non-Alchemy RPCs
          confirmed = await confirmTransactionHybrid(connection, txId, {
            timeout: 30000,
            commitment: 'confirmed',
            useWebSocket: false
          });
        }


        if (!confirmed) {
          console.warn('Transaction confirmation timeout, but may still succeed');
          // Continue (likely succeeded anyway)
        }

        // If memo exists, verify and add to chat after transaction confirmation
        if (memo && memo.trim()) {
          try {
            // Verify memo with direct connection
            const memoText = await extractMemoFromTransaction(connection, txId);

            if (memoText && memoText.includes('[SwapChat]')) {
              const cleanMemo = memoText.replace('[SwapChat]', '').trim();

              // Get transaction info (using direct connection)
              const txInfo = await connection.getTransaction(txId, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              });

              if (txInfo) {
                const senderAddress = txInfo.transaction.message.staticAccountKeys[0]?.toString() || 'Unknown';

                // Add to global messages (directly add to useChatMessages global store)
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
              }
            }
          } catch (memoError) {
            // Try adding default message even if memo verification fails
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

        // Update transaction status
        updateState({ signature: txId, loading: false });

        return { success: true, signature: txId };

      } catch (sendError) {
        throw sendError;
      }


    } catch (error) {
      let errorMessage = 'Failed to execute swap';

      if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient balance.';
        } else if (error.message.includes('slippage')) {
          errorMessage = 'Slippage limit exceeded. Please adjust settings or try again.';
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'User cancelled the transaction.';
        } else if (error.message.includes('signature verification failure')) {
          errorMessage = 'Transaction signature verification failed. Please try again.';
        } else if (error.message.includes('Transaction too large')) {
          errorMessage = 'Transaction is too large. Please shorten the memo or try again.';
        } else {
          errorMessage = error.message;
        }
      }

      updateState({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [publicKey, signTransaction, updateState]);

  // Convenient swap functions
  const swapSOLtoUSDC = useCallback(async (solAmount: number, memo?: string): Promise<SwapResult> => {
    const quote = await getQuote('SOL', 'USDC', solAmount);
    if (!quote) return { success: false, error: 'Failed to get quote' };
    return executeSwap(quote, memo);
  }, [getQuote, executeSwap]);

  const swapUSDCtoSOL = useCallback(async (usdcAmount: number, memo?: string): Promise<SwapResult> => {
    const quote = await getQuote('USDC', 'SOL', usdcAmount);
    if (!quote) return { success: false, error: 'Failed to get quote' };
    return executeSwap(quote, memo);
  }, [getQuote, executeSwap]);

  // Reset state
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
    // State
    ...state,

    // Functions
    getQuote,
    executeSwap,
    swapSOLtoUSDC,
    swapUSDCtoSOL,
    reset,

    // Convenience properties
    canSwap: !!publicKey && !state.loading,
    hasQuote: !!state.quote,
    isSwapping: state.loading,
  };
}

export default useSwap; 
