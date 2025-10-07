'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatRoom, ChatMessage } from '@/types';

export function useChat() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection is managed by useChatMessages
  const ws = useRef<WebSocket | null>(null);

  // Fetch chat room list
  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'}/api/chat/rooms`);
      const result = await response.json();

      if (result.success) {
        // Convert server data to client format
        const formattedRooms: ChatRoom[] = result.data.map((room: any) => ({
          id: room.id,
          name: room.name,
          description: room.description,
          image: room.image,
          tokenAddress: room.token_address,
          createdBy: room.created_by,
          memberCount: room.member_count,
          lastMessage: room.last_message ? {
            id: room.last_message.id,
            roomId: room.id,
            userId: room.last_message.user_address?.slice(0, 8) || 'unknown',
            userAddress: room.last_message.user_address,
            content: room.last_message.content,
            tradeType: room.last_message.trade_type,
            timestamp: new Date(room.last_message.created_at)
          } : undefined,
          isActive: room.is_active,
          createdAt: new Date(room.created_at),
          updatedAt: new Date(room.updated_at),
        }));

        setRooms(formattedRooms);

        // Set default selected chat room (for UI compatibility)
        if (formattedRooms.length > 0 && !activeRoomId) {
          const defaultRoom = formattedRooms.find(r => r.name === 'SOL/USDC') || formattedRooms[0];
          const roomKey = defaultRoom.name === 'SOL/USDC' ? 'sol-usdc' :
                          defaultRoom.name === 'BTC Discussion' ? 'btc-chat' :
                          'general';
          setActiveRoomId(roomKey);
        }
      } else {
        setError('Failed to fetch chat room list.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chat room list.');
    } finally {
      setIsLoading(false);
    }
  }, [activeRoomId]);

  // Fetch chat room messages (simplified as managed by useChatMessages)
  const fetchMessages = useCallback(async (roomId: string, page = 1) => {
    // Managed directly by useChatMessages, not handled here
  }, []);

  // Send message (managed by useChatMessages)
  const sendMessage = useCallback(async (roomId: string, content: string, tradeType: 'buy' | 'sell', tradeAmount?: string) => {
    // Managed directly by useChatMessages, not handled here
  }, []);

  // Create chat room
  const createRoom = useCallback(async (name: string, description?: string, tokenAddress?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'}/api/chat/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          token_address: tokenAddress,
          created_by: 'current-user', // In practice, use authenticated user ID
        }),
      });

      const result = await response.json();

      if (result.success) {
        const newRoom: ChatRoom = {
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          image: result.data.image,
          tokenAddress: result.data.token_address,
          createdBy: result.data.created_by,
          memberCount: result.data.member_count,
          isActive: result.data.is_active,
          createdAt: new Date(result.data.created_at),
          updatedAt: new Date(result.data.updated_at),
        };

        setRooms(prev => [...prev, newRoom]);
        setActiveRoomId(newRoom.id);

        return newRoom;
      } else {
        throw new Error(result.error || 'Failed to create chat room.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chat room.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search chat rooms
  const searchRooms = useCallback(async (query: string) => {
    if (!query.trim()) return rooms;

    try {
      // Local filtering (in practice, use server search API)
      return rooms.filter(room =>
        room.name.toLowerCase().includes(query.toLowerCase()) ||
        room.description?.toLowerCase().includes(query.toLowerCase())
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search chat rooms.');
      return [];
    }
  }, [rooms]);

  // WebSocket connection setup (disabled as managed by useChatMessages)
  const connectWebSocket = useCallback(() => {
    // Socket.IO is managed by useChatMessages
  }, []);

  // Load initial data on component mount
  useEffect(() => {
    fetchRooms();
    connectWebSocket();

    return () => {
      ws.current?.close();
    };
  }, [fetchRooms, connectWebSocket]);

  // Load messages when active chat room changes (managed by useChatMessages)
  useEffect(() => {
    if (activeRoomId && !messages[activeRoomId]) {
      // Automatically handled by useChatMessages
    }
  }, [activeRoomId, messages]);

  return {
    rooms,
    activeRoomId,
    activeRoom: rooms.find(room => {
      // roomId mapping (for UI compatibility)
      const roomKey = room.name === 'SOL/USDC' ? 'sol-usdc' :
                      room.name === 'BTC Discussion' ? 'btc-chat' :
                      'general';
      return roomKey === activeRoomId;
    }),
    messages: messages[activeRoomId] || [],
    isLoading,
    error,
    setActiveRoomId,
    fetchRooms,
    fetchMessages,
    sendMessage,
    createRoom,
    searchRooms,
    clearError: () => setError(null),
  };
} 