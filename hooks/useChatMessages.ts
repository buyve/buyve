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

// 🎯 메시지 캐시 최적화 설정
const MAX_MESSAGES_PER_ROOM = 500; // 방당 최대 메시지 수
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5분마다 정리
const MESSAGE_RETENTION_TIME = 24 * 60 * 60 * 1000; // 24시간 보관

// 🚀 토큰 주소 매핑 (기존 UI 호환성 + 동적 CA 지원)
const ROOM_TOKEN_MAPPING: Record<string, string> = {
  'bonk': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'wif': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'popcat': '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  'gmemoon': 'BkQCf3NSxf8hHJMrBKrFLCYBg7tKKSjU9KEts4F2ukL',
  'retard': '9H2NFytqpRBS7L5UVvnHGbq6Uum1cet4uxkCqBudcvtu',
  'meme': 'CYkD9AsNYPvWxmnRdQN6Qd2MkK5t8RivxvSaKnmGVfmH',
  'anon': 'AnonGEfxT5BcedgCnU7EGdJhqxkHWLKfwjBQEjhvJLM6',
  'sol-usdc': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC Trading Room
  'btc-chat': 'So11111111111111111111111111111111111111112', // SOL Trading Room (임시)
  'general': 'So11111111111111111111111111111111111111112', // SOL Trading Room (임시)
};

// 🚀 roomId에서 토큰 주소 추출 (CA 직접 지원)
const getTokenAddressFromRoomId = (roomId: string): string | null => {
  // 정적 매핑 먼저 확인
  if (ROOM_TOKEN_MAPPING[roomId]) {
    return ROOM_TOKEN_MAPPING[roomId];
  }
  
  // CA 형식인지 확인 (Solana CA는 44자 Base58)
  if (roomId && roomId.length >= 32 && roomId.length <= 44) {
    return roomId;
  }
  
  return null;
};

// 실시간 메시지 상태 관리
let globalMessages: ChatMessage[] = [];
const messageListeners = new Set<() => void>();
let realtimeChannel: RealtimeChannel | null = null;

// 리스너 알림 함수
const notifyListeners = () => {
  messageListeners.forEach(listener => listener());
};

// Supabase 메시지를 ChatMessage로 변환 (프로필 정보 없이)
function formatMessageFromSupabase(dbMessage: MessageCache, roomId: string): ChatMessage {
  const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
  
  // SOL 거래량 처리 - quantity가 lamports 단위인 경우 SOL로 변환
  let formattedAmount: string | undefined;
  if (dbMessage.quantity && dbMessage.quantity > 0) {
    // quantity가 1보다 큰 경우 lamports로 간주하고 SOL로 변환
    if (dbMessage.quantity >= 1000000000) { // 1 SOL = 1,000,000,000 lamports
      formattedAmount = (dbMessage.quantity / 1000000000).toFixed(3);
    } else if (dbMessage.quantity >= 1000000) { // 0.001 SOL = 1,000,000 lamports
      formattedAmount = (dbMessage.quantity / 1000000000).toFixed(6);
    } else {
      // 이미 SOL 단위인 경우
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

// Supabase에서 메시지 가져오기 (프로필은 ChatBubble에서 개별 조회)
async function fetchMessagesFromSupabase(roomId: string): Promise<ChatMessage[]> {
  try {
    const tokenAddress = getTokenAddressFromRoomId(roomId);
    if (!tokenAddress) {
      console.warn(`[useChatMessages] No token address found for roomId: ${roomId}`);
      return [];
    }

    
    // Supabase 클라이언트 확인
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
    // Supabase에서 메시지 로드됨
    return data.map(msg => formatMessageFromSupabase(msg, roomId));
  } catch (error) {
    console.error('[useChatMessages] Unexpected error loading messages:', error);
    return [];
  }
}

// Supabase에 메시지 저장
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
    // API 엔드포인트를 통해 메시지 저장
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
      throw new Error(`메시지 저장 실패: ${errorData.error}`);
    }

    const { data } = await response.json();
    
    // Realtime 구독이 처리하므로 여기서는 메시지를 반환만 함
    const newMessage = formatMessageFromSupabase(data, roomId);
    return newMessage;
  } catch (error) {
    throw error; // 오류를 다시 throw하여 호출자가 처리하도록
  }
};

// Realtime 구독 설정
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
        
        // 이미 존재하는 메시지인지 확인 (signature 기준)
        const existingMessageIndex = globalMessages.findIndex(msg => msg.id === newMessage.id);
        
        if (existingMessageIndex !== -1) {
          return; // 이미 존재하면 무시
        }
        
        // 새 메시지 추가
        globalMessages = [...globalMessages, newMessage];
        notifyListeners();
      }
    )
    .subscribe();
};

export const addMessage = async (roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'roomId'>) => {
  // txHash가 있으면 이미 signature로 사용
  const messageId = message.txHash || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 이미 존재하는 메시지인지 확인
  if (globalMessages.find(msg => msg.id === messageId)) {
    return;
  }
  
  // 즉시 UI에 표시하기 위해 메시지 생성
  const newMessage: ChatMessage = {
    ...message,
    id: messageId,
    timestamp: Date.now(),
    roomId,
  };
  
  // 로컬 상태에 즉시 추가
  globalMessages = [...globalMessages, newMessage];
  notifyListeners();
  
  // 백그라운드에서 Supabase에 저장
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
    // Realtime 구독이 이미 존재하는 메시지를 감지하면 무시함
  } catch (error) {
    console.error('Failed to save message to Supabase:', error);
    // 에러 발생 시 로컬 메시지 유지
  }
};

export const getMessages = () => globalMessages;

export const useChatMessages = (roomId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { connected, publicKey } = useWallet();

  // 클라이언트 사이드 렌더링 확인
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 메시지 리스너 등록
  useEffect(() => {
    if (!isClient) return;

    const updateMessages = () => {
      setMessages([...globalMessages]);
    };

    messageListeners.add(updateMessages);
    updateMessages(); // 초기 메시지 로드

    return () => {
      messageListeners.delete(updateMessages);
    };
  }, [isClient]);

  // 룸별 메시지 로드 및 실시간 구독
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

// 전역 정리 함수 (앱 종료 시 호출)
export function cleanupChatMessages() {
  globalMessages = [];
  messageListeners.clear();
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
} 