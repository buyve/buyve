'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ImageCacheManager } from '@/lib/utils';
import bs58 from 'bs58';

export const DEFAULT_AVATARS = ['👤', '🧑', '👩', '🤵', '👩‍💼', '🧑‍💼', '👨‍💼', '🧙‍♂️', '🧙‍♀️', '🥷'];

// Global authentication state management (independent of React state system)
const authenticatingAddresses = new Set<string>();
const completedAddresses = new Set<string>();
const authenticationPromises = new Map<string, Promise<any>>();

// Timer for debouncing
let walletConnectDebounceTimer: NodeJS.Timeout | null = null;

// Profile loading state management
const loadingProfiles = new Set<string>();

export const formatWalletAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

interface WalletProfile {
  wallet_address: string;
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export function useWalletInternal() {
  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnecting, 
    wallet,
    wallets,
    select,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    sendTransaction
  } = useSolanaWallet();
  
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  
  // Local state
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  // Wallet address
  const address = publicKey?.toBase58() || null;

  // Get nickname and avatar from profile (stabilized with memoization)
  const { nickname, avatar } = useMemo(() => {
    const profileNickname = profile?.nickname || '';
    const rawAvatar = profile?.avatar_url;
    

    let processedAvatar = DEFAULT_AVATARS[0]; // Default value

    if (!rawAvatar) {
      processedAvatar = DEFAULT_AVATARS[0];
    } else if (rawAvatar.startsWith('emoji:')) {
      // Remove emoji: prefix (for emoji avatars)
      processedAvatar = rawAvatar.replace('emoji:', '');
    } else if (rawAvatar.startsWith('http') || rawAvatar.startsWith('data:')) {
      // Return as-is for HTTP URL or data URL
      processedAvatar = rawAvatar;
    } else {
      // Return as-is for other cases (emojis, etc.)
      processedAvatar = rawAvatar;
    }
    
    return {
      nickname: profileNickname,
      avatar: processedAvatar
    };
  }, [profile?.nickname, profile?.avatar_url]);

  // Wallet authentication
  const authenticateWallet = useCallback(async (walletAddress: string) => {
    try {
      // 1. Request message to sign
      const msgResponse = await fetch(`/api/auth/wallet?walletAddress=${encodeURIComponent(walletAddress)}`, {
        credentials: 'include'
      });

      if (!msgResponse.ok) {
        throw new Error('Failed to get auth message');
      }

      const { message } = await msgResponse.json();

      // 2. Sign message with wallet
      if (!signMessage) {
        throw new Error('Wallet does not support message signing');
      }

      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);

      // 3. Verify signature and generate token
      const authResponse = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          walletAddress,
          signature: bs58.encode(signature),
          message
        })
      });
      
      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }
      
      const authResult = await authResponse.json();
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      // Save JWT token
      if (authResult.authToken) {
        setAuthToken(authResult.authToken);
        // Also save to local storage (for page refresh)
        localStorage.setItem('authToken', authResult.authToken);
      }
      
      return authResult;
    } catch (error) {
      console.error('Wallet authentication error:', error);
      throw error;
    }
  }, [signMessage]);
  

  // Load profile
  const loadProfile = useCallback(async (walletAddress: string) => {
    // Skip if already loading this address
    if (loadingProfiles.has(walletAddress)) {
      return;
    }

    loadingProfiles.add(walletAddress);
    setIsLoadingProfile(true);
    setError(null);

    try {
      const headers: HeadersInit = {};

      // Add Authorization header if token exists
      const token = authToken || localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/profiles?wallet_address=${encodeURIComponent(walletAddress)}`, {
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        if (result.profile) {
          setProfile(result.profile);

          // Preload profile image
          if (result.profile.avatar_url &&
              (result.profile.avatar_url.startsWith('http') ||
               result.profile.avatar_url.startsWith('data:'))) {
            ImageCacheManager.preload(result.profile.avatar_url);
          }
        } else {
          // Create new profile if none exists
          await createProfile(walletAddress);
        }
      } else {
        throw new Error(result.error || 'Failed to load profile');
      }
    } catch {
      setError('Failed to load profile');
      // Set empty profile even on failure to keep UI functional
      setProfile(null);
    } finally {
      loadingProfiles.delete(walletAddress);
      setIsLoadingProfile(false);
    }
  }, [authToken]);

  // Create profile
  const createProfile = useCallback(async (walletAddress: string) => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };

      // Add Authorization header if token exists
      const token = authToken || localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          wallet_address: walletAddress,
          nickname: null,
          avatar_url: null
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.profile) {
        setProfile(result.profile);
      } else {
        throw new Error(result.error || 'Failed to create profile');
      }
    } catch {
      setError('Failed to create profile');
    }
  }, [setError, authToken]);

  // Update profile
  const updateProfile = useCallback(async (updates: { nickname?: string; avatar?: string }) => {
    if (!address) return;

    try {
      // Process avatar URL
      let avatarUrl = updates.avatar || null;
      if (updates.avatar && !updates.avatar.startsWith('http') && !updates.avatar.startsWith('data:') && !updates.avatar.startsWith('emoji:')) {
        // Add emoji: prefix only for emojis
        if (DEFAULT_AVATARS.includes(updates.avatar)) {
          avatarUrl = `emoji:${updates.avatar}`;
        }
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };

      // Add Authorization header if token exists
      const token = authToken || localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          wallet_address: address,
          nickname: updates.nickname?.trim() || null,
          avatar_url: avatarUrl
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setProfile(result.profile);

        // Dispatch global profile update event
        const profileUpdateEvent = new CustomEvent('profileUpdated', {
          detail: {
            walletAddress: address,
            profile: result.profile
          }
        });
        window.dispatchEvent(profileUpdateEvent);
      }
    } catch {
      setError('Failed to update profile');
    }
  }, [address, authToken]);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connection) return;

    setIsLoadingBalance(true);
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const balance = await connection.getBalance(publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
        setError(null);
        setIsLoadingBalance(false);
        return;
      } catch (error) {
        lastError = error;
        console.error(`[Balance] Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    console.error('[Balance] All balance fetch attempts failed:', lastError);
    setError('Failed to fetch balance. Please try again later.');
    setBalance(null);
    setIsLoadingBalance(false);
  }, [publicKey, connection]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      setError(null);

      if (!wallet) {
        // Open modal if wallet not selected
        setVisible(true);
        return;
      }

      // Already connected
      if (connected) {
        return;
      }

      // Attempt to connect
      await connect();
    } catch (error) {
      
      if (error instanceof Error) {
        if (error.name === 'WalletNotReadyError') {
          setError('Wallet not installed. Please install Phantom or Solflare.');
        } else if (error.name === 'WalletNotSelectedError') {
          setError('Please select a wallet.');
        } else {
          setError(error.message || 'Failed to connect wallet');
        }
      } else {
        setError('Failed to connect wallet');
      }
    }
  }, [wallet, connected, connect, setVisible]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      setProfile(null);
      setBalance(null);
      setError(null);
    } catch {
      setError('Failed to disconnect wallet');
    }
  }, [disconnect]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check existing authentication state (using JWT token)
  const checkExistingAuth = useCallback(async (walletAddress: string) => {
    try {
      // Check token from local storage
      const storedToken = localStorage.getItem('authToken');
      if (!storedToken) {
        return false;
      }

      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.valid && result.walletAddress === walletAddress && result.profile) {
          setProfile(result.profile);
          setAuthToken(storedToken);
          return true;
        }
      } else {
        // Remove token if invalid
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Failed to check existing auth:', error);
      localStorage.removeItem('authToken');
    }
    return false;
  }, []);

  // Authenticate and load profile on wallet connection (with debouncing)
  useEffect(() => {
    // Cancel existing timer
    if (walletConnectDebounceTimer) {
      clearTimeout(walletConnectDebounceTimer);
    }

    // 100ms debouncing
    walletConnectDebounceTimer = setTimeout(() => {
      const handleWalletConnect = async () => {
      if (connected && address) {
        // Wait if authentication Promise is already in progress for the same address
        if (authenticationPromises.has(address)) {
          try {
            await authenticationPromises.get(address);
            fetchBalance();
            return;
          } catch (error) {
            console.error('Authentication promise failed for:', address, error);
            authenticationPromises.delete(address);
          }
        }

        // Skip if authentication already in progress (additional security)
        if (authenticatingAddresses.has(address)) {
          return;
        }

        // Create and cache authentication Promise
        const authPromise = (async () => {
          try {
            // 1. First check existing authentication state (JWT token in cookie)
            const hasValidAuth = await checkExistingAuth(address);

            if (hasValidAuth) {
              completedAddresses.add(address);
              return;
            }

            // 2. Load profile only if already completed
            if (completedAddresses.has(address)) {
              await loadProfile(address);
              return;
            }

            // 3. New authentication required
            authenticatingAddresses.add(address);

            try {
              await authenticateWallet(address);
              // Load profile after successful authentication
              await loadProfile(address);
              completedAddresses.add(address);
            } finally {
              authenticatingAddresses.delete(address);
            }

          } catch (error) {
            console.error('Failed to authenticate wallet:', error);
            authenticatingAddresses.delete(address);
            setError('Failed to authenticate wallet. Please try again.');
            throw error;
          } finally {
            // Remove from cache after Promise completion
            authenticationPromises.delete(address);
          }
        })();

        // Store Promise in cache
        authenticationPromises.set(address, authPromise);

        try {
          await authPromise;
          fetchBalance();
        } catch (error) {
          // Error already handled inside authPromise
        }

      } else if (!connected) {
        setProfile(null);
        setBalance(null);
        setError(null);
        setAuthToken(null);
        // Remove token on disconnect
        localStorage.removeItem('authToken');
        // Clean up only authentication in-progress state on disconnect
        if (address) {
          authenticatingAddresses.delete(address);
          authenticationPromises.delete(address);
          // Keep completedAddresses to utilize existing auth state on reconnect
        }
      }
      };

      handleWalletConnect();
    }, 100); // 100ms debouncing

    // Cleanup function
    return () => {
      if (walletConnectDebounceTimer) {
        clearTimeout(walletConnectDebounceTimer);
      }
    };
  }, [connected, address, checkExistingAuth, authenticateWallet, loadProfile, fetchBalance]);

  return {
    // Connection state
    isConnected: connected,
    isConnecting: connecting,
    isDisconnecting: disconnecting,

    // Wallet info
    address,
    publicKey,
    wallet,
    wallets,

    // Profile info
    profile,
    nickname,
    avatar,
    isLoadingProfile,
    authToken,

    // Balance info
    balance,
    isLoadingBalance,

    // Error state
    error,

    // Actions
    connectWallet,
    disconnectWallet,
    updateProfile,
    fetchBalance,
    clearError,
    select,

    // Signing functions
    signMessage,
    signTransaction,
    sendTransaction,

    // Modal control
    setVisible
  };
}
