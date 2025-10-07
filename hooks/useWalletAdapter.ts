'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { getStableConnection as getLibStableConnection, checkSolanaConnection } from '@/lib/solana';
import { Connection } from '@solana/web3.js';

interface WalletAdapterState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;

  // Wallet info
  publicKey: PublicKey | null;
  walletName: string | null;

  // Balance info
  balance: number | null;
  isLoadingBalance: boolean;

  // Error state
  error: string | null;
}

interface TransactionOptions {
  skipPreflight?: boolean;
  preflightCommitment?: 'processed' | 'confirmed' | 'finalized';
}

export function useWalletAdapter() {
  const { 
    publicKey, 
    connected,
    connecting,
    disconnecting,
    wallet,
    connect,
    disconnect,
    sendTransaction,
    signTransaction,
    signAllTransactions,
    signMessage
  } = useWallet();
  
  const { connection } = useConnection();

  // State management
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // Check client mount state
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Wallet state (hydration safe)
  const walletState: WalletAdapterState = {
    isConnected: connected && hasMounted,
    isConnecting: connecting && hasMounted,
    isDisconnecting: disconnecting && hasMounted,
    publicKey: connected && hasMounted ? publicKey : null,
    walletName: hasMounted ? (wallet?.adapter.name || null) : null,
    balance,
    isLoadingBalance,
    error,
  };

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      setError(null);
      await connect();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect wallet.');
    }
  }, [connect]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      setError(null);

      // Check if wallet is connected and disconnect function exists
      if (connected && disconnect && typeof disconnect === 'function') {
        await disconnect();
      }

      // Reset state
      setBalance(null);

    } catch (error) {

      // Reset state even on error
      setBalance(null);

      // Show simple message to user
      setError('An error occurred while disconnecting wallet.');
    }
  }, [disconnect, connected]);

  // Get stable connection
  const getStableConnection = useCallback(async (): Promise<Connection> => {
    try {
      // Quick health check with short timeout
      const quickHealthCheck = Promise.race([
        checkSolanaConnection(connection),
        new Promise<{ connected: boolean }>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 3000)
        )
      ]);
      
      const healthCheck = await quickHealthCheck;
      if (healthCheck.connected) {
        return connection;
      }

      // Create new stable connection if unstable
      return await getLibStableConnection();
    } catch (error) {
      // fallback to library stable connection
      return await getLibStableConnection();
    }
  }, [connection]);

  // Fetch balance (using stable connection)
  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }

    setIsLoadingBalance(true);
    setError(null);
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const connection = await getStableConnection();

        const lamports = await connection.getBalance(publicKey);
        const solBalance = lamports / LAMPORTS_PER_SOL;
        setBalance(solBalance);
        setIsLoadingBalance(false);
        return;
      } catch (error) {
        lastError = error;
        console.error(`[WalletAdapter] Balance fetch attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('[WalletAdapter] All balance fetch attempts failed:', lastError);
    setError('Failed to load balance. Please try again later.');
    setBalance(null);
    setIsLoadingBalance(false);
  }, [publicKey, getStableConnection]);

  // Send transaction
  const sendSolanaTransaction = useCallback(async (
    transaction: Transaction,
    options: TransactionOptions = {}
  ): Promise<string> => {
    if (!publicKey) {
      throw new WalletNotConnectedError();
    }

    try {
      setError(null);

      // Get latest blockhash
      const connection = await getStableConnection();
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: options.skipPreflight,
        preflightCommitment: options.preflightCommitment || 'confirmed',
      });

      // Wait for transaction confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }


      // Update balance
      await fetchBalance();

      return signature;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send transaction.';
      setError(errorMessage);
      throw error;
    }
  }, [publicKey, sendTransaction, getStableConnection]);

  // Send SOL
  const sendSol = useCallback(async (
    recipient: string | PublicKey,
    amount: number
  ): Promise<string> => {
    if (!publicKey) {
      throw new WalletNotConnectedError();
    }

    try {
      const recipientPubkey = typeof recipient === 'string' 
        ? new PublicKey(recipient) 
        : recipient;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports: amount * LAMPORTS_PER_SOL,
        })
      );

      return await sendSolanaTransaction(transaction);
    } catch (error) {
      throw error;
    }
  }, [publicKey, sendSolanaTransaction]);

  // Sign message
  const signWalletMessage = useCallback(async (message: string): Promise<Uint8Array> => {
    if (!signMessage) {
      throw new Error('Wallet does not support message signing.');
    }

    try {
      setError(null);
      const messageBytes = new TextEncoder().encode(message);
      return await signMessage(messageBytes);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign message.';
      setError(errorMessage);
      throw error;
    }
  }, [signMessage]);

  // Sign transaction (without sending)
  const signWalletTransaction = useCallback(async (transaction: Transaction): Promise<Transaction> => {
    if (!signTransaction) {
      throw new Error('Wallet does not support transaction signing.');
    }

    if (!publicKey) {
      throw new WalletNotConnectedError();
    }

    try {
      setError(null);

      // Set latest blockhash
      const connection = await getStableConnection();
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      return await signTransaction(transaction);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign transaction.';
      setError(errorMessage);
      throw error;
    }
  }, [signTransaction, publicKey, getStableConnection]);

  // Sign multiple transactions
  const signAllWalletTransactions = useCallback(async (transactions: Transaction[]): Promise<Transaction[]> => {
    if (!signAllTransactions) {
      throw new Error('Wallet does not support signing multiple transactions.');
    }

    if (!publicKey) {
      throw new WalletNotConnectedError();
    }

    try {
      setError(null);

      // Set latest blockhash for all transactions
      const connection = await getStableConnection();
      const { blockhash } = await connection.getLatestBlockhash();
      transactions.forEach(transaction => {
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
      });

      return await signAllTransactions(transactions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign transactions.';
      setError(errorMessage);
      throw error;
    }
  }, [signAllTransactions, publicKey, getStableConnection]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Remove automatic balance fetch when connection state changes (manual fetch only)
  useEffect(() => {
    if (connected && publicKey) {
      // Automatic balance fetch removed - no fetchBalance() call
    } else {
      setBalance(null);
    }
  }, [connected, publicKey]); // fetchBalance dependency removed

  return {
    // State
    ...walletState,

    // Actions
    connect: connectWallet,
    disconnect: disconnectWallet,
    fetchBalance,
    sendTransaction: sendSolanaTransaction,
    sendSol,
    signMessage: signWalletMessage,
    signTransaction: signWalletTransaction,
    signAllTransactions: signAllWalletTransactions,
    clearError,

    // Helpers
    formatAddress: (address?: string) => {
      if (!address) return '';
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    },
    
    formatBalance: (balance?: number | null) => {
      if (balance === null || balance === undefined) return 'N/A';
      return `${balance.toFixed(4)} SOL`;
    },
  };
}

export default useWalletAdapter; 