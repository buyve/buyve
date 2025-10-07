'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage } from '@/types';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase, MessageCache } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';

const DEFAULT_AVATARS = [
  '🦊', '🐸', '🐱', '🐶', '🦁', '🐯', '🐨', '🐼'
];

// Message cache optimization settings
const MAX_MESSAGES_PER_ROOM = 500; // Maximum messages per room
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes
const MESSAGE_RETENTION_TIME = 24 * 60 * 60 * 1000; // Keep for 24 hours

// Token address mapping (legacy UI compatibility + dynamic CA support)
const ROOM_TOKEN_MAPPING: Record<string, string> = {
  'bonk': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'wif': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'popcat': '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  'gmemoon': 'BkQCf3NSxf8hHJMrBKrFLCYBg7tKKSjU9KEts4F2ukL',
  'retard': '9H2NFytqpRBS7L5UVvnHGbq6Uum1cet4uxkCqBudcvtu',
  'meme': 'CYkD9AsNYPvWxmnRdQN6Qd2MkK5t8RivxvSaKnmGVfmH',
  'anon': 'AnonGEfxT5BcedgCnU7EGdJhqxkHWLKfwjBQEjhvJLM6',
  'sol-usdc': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC Trading Room
  'btc-chat': 'So11111111111111111111111111111111111111112', // SOL Trading Room (temp)
  'general': 'So11111111111111111111111111111111111111112', // SOL Trading Room (temp)
};

// Extract token address from roomId (direct CA support)
const getTokenAddressFromRoomId = (roomId: string): string | null => {
  // Check static mapping first
  if (ROOM_TOKEN_MAPPING[roomId]) {
    return ROOM_TOKEN_MAPPING[roomId];
  }

  // Check if CA format (Solana CA is 32-44 characters Base58)
  if (roomId && roomId.length >= 32 && roomId.length <= 44) {
    return roomId;
  }

  return null;
};

// Real-time message state management
let globalMessages: ChatMessage[] = [];
const messageListeners = new Set<() => void>();
let realtimeChannel: RealtimeChannel | null = null;

// Notify listeners function
const notifyListeners = () => {
  messageListeners.forEach(listener => listener());
};

// Convert Supabase message to ChatMessage (without profile info)
function formatMessageFromSupabase(dbMessage: MessageCache, roomId: string): ChatMessage {
  const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

  // Handle SOL trading volume - convert from lamports to SOL if needed
  let formattedAmount: string | undefined;
  if (dbMessage.quantity && dbMessage.quantity > 0) {
    // If quantity > 1, treat as lamports and convert to SOL
    if (dbMessage.quantity >= 1000000000) { // 1 SOL = 1,000,000,000 lamports
      formattedAmount = (dbMessage.quantity / 1000000000).toFixed(3);
    } else if (dbMessage.quantity >= 1000000) { // 0.001 SOL = 1,000,000 lamports
      formattedAmount = (dbMessage.quantity / 1000000000).toFixed(6);
    } else {
      // Already in SOL units
      formattedAmount = dbMessage.quantity.toString();
    }
  }
  
  return {
    id: dbMessage.signature,
    roomId,
    userId: dbMessage.sender_wallet.slice(0, 8),
    userAddress: dbMessage.sender_wallet,
    nickname: `${dbMessage.sender_wallet.slice(0, 4)}...${dbMessage.sender_wallet.slice(-4)}`,
    avatar: randomAvatar,
    content: dbMessage.content,
    timestamp: new Date(dbMessage.block_time),
    tradeType: dbMessage.message_type ? dbMessage.message_type.toLowerCase() as 'buy' | 'sell' : 'buy',
    tradeAmount: formattedAmount,
    txHash: dbMessage.signature,
  };
}

// Fetch messages from Supabase (profiles fetched individually in ChatBubble)
async function fetchMessagesFromSupabase(roomId: string): Promise<ChatMessage[]> {
  try {
    const tokenAddress = getTokenAddressFromRoomId(roomId);
    if (!tokenAddress) {
      console.warn(`[useChatMessages] No token address found for roomId: ${roomId}`);
      return [];
    }


    // Check Supabase client
    if (!supabase) {
      console.error('[useChatMessages] Supabase client not initialized');
      return [];
    }

    const { data, error } = await supabase
      .from('message_cache')
      .select('*')
      .eq('token_address', tokenAddress)
      .order('block_time', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[useChatMessages] Error loading messages from Supabase:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }
    // Messages loaded from Supabase
    return data.map(msg => formatMessageFromSupabase(msg, roomId));
  } catch (error) {
    console.error('[useChatMessages] Unexpected error loading messages:', error);
    return [];
  }
}

// Save message to Supabase
const saveMessageToSupabase = async (roomId: string, messageData: {
  content: string;
  trade_type: 'buy' | 'sell';
  trade_amount?: string;
  tx_hash?: string;
  user_address: string;
  nickname?: string;
  avatar?: string;
}): Promise<ChatMessage | null> => {
  try {
    // Save message through API endpoint
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomId,
        messageData
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to save message: ${errorData.error}`);
    }

    const { data } = await response.json();

    // Only return message here as Realtime subscription handles updates
    const newMessage = formatMessageFromSupabase(data, roomId);
    return newMessage;
  } catch (error) {
    throw error; // Re-throw error for caller to handle
  }
};

// Setup Realtime subscription
const setupRealtimeSubscription = (roomId: string) => {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
  }

  const tokenAddress = getTokenAddressFromRoomId(roomId);
  if (!tokenAddress) {
    return;
  }

  realtimeChannel = supabase
    .channel(`messages_${tokenAddress}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_cache',
        filter: `token_address=eq.${tokenAddress}`
      },
      (payload) => {
        const newMessage = formatMessageFromSupabase(payload.new as MessageCache, roomId);

        // Check if message already exists (by signature)
        const existingMessageIndex = globalMessages.findIndex(msg => msg.id === newMessage.id);

        if (existingMessageIndex !== -1) {
          return; // Ignore if already exists
        }

        // Add new message
        globalMessages = [...globalMessages, newMessage];
        notifyListeners();
      }
    )
    .subscribe();
};

export const addMessage = async (roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'roomId'>) => {
  // Use txHash as signature if available
  const messageId = message.txHash || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Check if message already exists
  if (globalMessages.find(msg => msg.id === messageId)) {
    return;
  }

  // Create message for immediate UI display
  const newMessage: ChatMessage = {
    ...message,
    id: messageId,
    timestamp: Date.now(),
    roomId,
  };

  // Add to local state immediately
  globalMessages = [...globalMessages, newMessage];
  notifyListeners();

  // Save to Supabase in background
  const messageData = {
    content: message.content,
    trade_type: message.tradeType,
    trade_amount: message.tradeAmount,
    tx_hash: message.txHash,
    user_address: message.userAddress,
    nickname: message.nickname,
    avatar: message.avatar,
  };

  try {
    await saveMessageToSupabase(roomId, messageData);
    // Realtime subscription ignores if message already exists
  } catch (error) {
    console.error('Failed to save message to Supabase:', error);
    // Keep local message on error
  }
};

export const getMessages = () => globalMessages;

export const useChatMessages = (roomId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { connected, publicKey } = useWallet();

  // Check client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Register message listener
  useEffect(() => {
    if (!isClient) return;

    const updateMessages = () => {
      setMessages([...globalMessages]);
    };

    messageListeners.add(updateMessages);
    updateMessages(); // Load initial messages

    return () => {
      messageListeners.delete(updateMessages);
    };
  }, [isClient]);

  // Load messages per room and setup realtime subscription
  useEffect(() => {
    if (!isClient || !roomId) return;

    const loadMessages = async () => {
      try {
        globalMessages = await fetchMessagesFromSupabase(roomId);
        notifyListeners();
        setupRealtimeSubscription(roomId);
      } catch (error) {
        // Handle error silently
      }
    };

    loadMessages();

    return () => {
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
        realtimeChannel = null;
      }
    };
  }, [roomId, isClient]);

  const sendMessage = useCallback((content: string) => {
    if (!publicKey || !isClient || !connected) {
      return;
    }

    const messageData = {
      content,
      trade_type: 'buy' as const,
      trade_amount: undefined,
      user_address: publicKey.toString(),
      nickname: undefined,
      avatar: '🎉',
    };

    saveMessageToSupabase(roomId, messageData);
  }, [roomId, isClient, connected, publicKey]);

  const checkMyTransactions = useCallback(() => {
    if (!publicKey) {
      return;
    }
  }, []);

  return {
    messages,
    sendMessage,
    addMessage: async (message: Omit<ChatMessage, 'id' | 'timestamp' | 'roomId'>) => 
      roomId && isClient ? await addMessage(roomId, message) : null,
    addMemoFromTransaction: (signature: string) => 
      null,
    checkMyTransactions,
  };
};

// Global cleanup function (called on app exit)
export function cleanupChatMessages() {
  globalMessages = [];
  messageListeners.clear();
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
} 