'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Copy } from 'lucide-react';
import ChatBubble from '@/components/layout/ChatBubble';
import ChatInput from '@/components/layout/ChatInput';
import TokenAvatar from '@/components/ui/TokenAvatar';
import { useChatMessages } from '@/hooks/useChatMessages';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Chatroom data type definition (considering backend integration)
interface ChatRoom {
  id: string;
  name: string;
  image: string;
  contractAddress: string;
  lastMessage?: string;
  unreadCount?: number;
}

// Chatroom type received from API
interface ApiChatRoom {
  id: string;
  name: string;
  contractAddress: string;
  creatorAddress: string;
  transactionSignature: string;
  createdAt: string;
  isActive: boolean;
  image?: string; // Image URL fetched from token metadata
}

export default function ChatArea() {
  const [isPopupMode, setIsPopupMode] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [popupRoomId, setPopupRoomId] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Chat message hooks
  const { messages } = useChatMessages(selectedRoom);

  // Fetch real-time price data
  useEffect(() => {
    if (!selectedRoom || selectedRoom === 'So11111111111111111111111111111111111111112') {
      setCurrentPrice(0);
      setPriceChange(0);
      return;
    }

    const fetchRealtimePrice = async () => {
      try {
        const response = await fetch(`/api/price-realtime?token=${encodeURIComponent(selectedRoom)}`);

        if (!response.ok) {
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          setCurrentPrice(result.data.currentPrice);
          setPriceChange(result.data.priceChange);
        }
      } catch {
        // Ignore errors
      }
    };

    // Initial fetch
    fetchRealtimePrice();

    // Update every minute
    const interval = setInterval(fetchRealtimePrice, 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedRoom]);



      // Check if popup mode via URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const popup = urlParams.get('popup') === 'true';
    const roomParam = urlParams.get('room');
    
    setIsPopupMode(popup);
    
          // If popup mode and specific room is specified
    if (popup && roomParam) {
      setPopupRoomId(roomParam);
    }
      }, []); // Keep dependency array empty to execute only on mount

      // Load actual chatroom data
  const loadChatrooms = useCallback(async () => {
    try {
      const response = await fetch('/api/chatrooms');
      const data = await response.json();

      console.log('📥 [ChatArea] API Response:', JSON.stringify(data, null, 2));

      if (data.success && data.chatrooms) {
                  // Convert API data to UI format
        const formattedRooms: ChatRoom[] = data.chatrooms.map((room: ApiChatRoom) => ({
          id: room.contractAddress,
          name: room.name,
                      image: room.image || '🪙', // Token image URL or default emoji
          contractAddress: room.contractAddress
        }));

        console.log('🎨 [ChatArea] Formatted Rooms:', JSON.stringify(formattedRooms, null, 2));

        // Sora 토큰 특별 확인
        const soraRoom = formattedRooms.find(r => r.contractAddress === '48yjoFSJ8m6jgDorrYvwfxoLCPAuML9sGz975ZAJtbBY');
        if (soraRoom) {
          console.log('🎯 [ChatArea] Sora Token Data:', JSON.stringify({
            name: soraRoom.name,
            image: soraRoom.image,
            contractAddress: soraRoom.contractAddress
          }, null, 2));
        }
        
        setChatRooms(formattedRooms);
        
                  // If popup mode and specific room exists
        if (isPopupMode && popupRoomId) {
          const targetRoom = formattedRooms.find(room => room.contractAddress === popupRoomId);
          if (targetRoom) {
            setSelectedRoom(targetRoom.id);
            
            // Token pair change event
            window.dispatchEvent(new CustomEvent('tokenPairChanged', {
              detail: { 
                contractAddress: targetRoom.contractAddress,
                tokenName: targetRoom.name 
              }
            }));
          } else {
          }
        } 
        // Set default selected chatroom only when not in popup mode
        else if (!isPopupMode && formattedRooms.length > 0 && !selectedRoom) {
          const firstRoom = formattedRooms[0];
          setSelectedRoom(firstRoom.id);
          
          // Token pair change event
          window.dispatchEvent(new CustomEvent('tokenPairChanged', {
            detail: { 
              contractAddress: firstRoom.contractAddress,
              tokenName: firstRoom.name 
            }
          }));
        }
      } else {
        setChatRooms([]);
      }
    } catch {
      setChatRooms([]);
    }
  }, [selectedRoom, isPopupMode, popupRoomId]);

  // Load data on component mount
  useEffect(() => {
    loadChatrooms();
  }, [loadChatrooms]);

  // New chatroom creation event listener
  useEffect(() => {
    const handleChatroomCreated = (event: CustomEvent) => {
      loadChatrooms(); // Refresh list when new chatroom is created
      
      // Auto-switch to newly created chatroom only when not in popup mode
      if (!isPopupMode && event.detail?.chatroom?.contractAddress) {
        setSelectedRoom(event.detail.chatroom.contractAddress);
        window.dispatchEvent(new CustomEvent('tokenPairChanged', {
          detail: { 
            contractAddress: event.detail.chatroom.contractAddress,
            tokenName: event.detail.chatroom.name 
          }
        }));
      }
    };

    window.addEventListener('chatroomCreated', handleChatroomCreated as EventListener);
    return () => window.removeEventListener('chatroomCreated', handleChatroomCreated as EventListener);
  }, [loadChatrooms, isPopupMode]);

  // Handle chatroom selection events from external sources
  useEffect(() => {
    const handleRoomSelected = (event: CustomEvent) => {
      // Ignore room changes in popup mode
      if (isPopupMode) return;
      
      const { roomId } = event.detail;
      if (roomId && roomId !== selectedRoom) {
        setSelectedRoom(roomId);
        
        // Token pair change event
        const room = chatRooms.find(r => r.id === roomId);
        if (room) {
          window.dispatchEvent(new CustomEvent('tokenPairChanged', {
            detail: { 
              contractAddress: room.contractAddress,
              tokenName: room.name 
            }
          }));
        }
      }
    };

    window.addEventListener('roomSelected', handleRoomSelected as EventListener);
    return () => window.removeEventListener('roomSelected', handleRoomSelected as EventListener);
  }, [selectedRoom, chatRooms, isPopupMode]);

  // Message scroll management
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Message sending is handled directly by ChatInput, so removed

  // Clipboard copy function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("CA address copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  // Render chatroom information
  const renderChatRoomInfo = () => {
    const currentRoom = chatRooms.find(room => room.id === selectedRoom);
    
    if (!currentRoom) return null;

    // 팝업 모드에서는 헤더를 숨겨 말풍선만 노출
    if (isPopupMode) {
      return null;
    }

    // 디버깅: 현재 선택된 방의 이미지 URL 콘솔에 출력
    console.log('🖼️ [ChatArea Header] Rendering room:', JSON.stringify({
      name: currentRoom.name,
      image: currentRoom.image,
      contractAddress: currentRoom.contractAddress
    }, null, 2));

    return (
      <div className="flex items-center justify-between p-3 bg-[oklch(25%_0_0)] border-b-2 border-[oklch(0%_0_0)] shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] relative z-10">
        <div className="flex items-center space-x-3">
          <TokenAvatar
            tokenAddress={currentRoom.contractAddress}
            tokenName={currentRoom.name}
            size="md"
            imageUrl={currentRoom.image}
          />
          <div className="flex flex-col flex-1">
            <h3 className="font-bold text-lg text-[oklch(0.9249_0_0)]">{currentRoom.name}</h3>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[oklch(0.9249_0_0)]">
                ({currentRoom.contractAddress.slice(0, 4)}...{currentRoom.contractAddress.slice(-4)})
              </span>
              <button 
                onClick={() => copyToClipboard(currentRoom.contractAddress)}
                className="p-1 hover:bg-[oklch(0.2393_0_0)] rounded-none transition-all bg-[oklch(0.2393_0_0)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
                title="Copy CA address"
              >
                <Copy size={12} className="text-white" />
              </button>
            </div>
          </div>
        </div>
        {/* 모바일에서만 표시되는 가격 정보 - 팝업 버튼 왼쪽 */}
        <div className="flex items-center space-x-3 lg:hidden">
          {currentPrice > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-white leading-none">
                ${currentPrice.toFixed(6)}
              </span>
              <span className={`text-xs font-medium leading-none mt-1 ${
                priceChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
                      <button 
              onClick={() => {
                const baseUrl = window.location.origin;
                const popupUrl = `${baseUrl}/trade?popup=true&room=${currentRoom.contractAddress}`;
                const width = 400;
                const height = 600;
                const left = window.screen.width - width - 50;
                const top = 50;
                window.open(
                  popupUrl, 
                  'ChatPopup', 
                  `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
                );
              }}
              className="p-2 hover:bg-[oklch(0.2393_0_0)] rounded-none transition-all bg-[oklch(0.2393_0_0)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
              title="OBS Chat Popup"
            >
              <MessageSquare size={16} className="text-white" />
            </button>
        </div>
      </div>
    );
  };

  // Render chat message area
  const renderChatMessages = () => {
    if (!selectedRoom) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <span>Please select a Buyve room</span>
        </div>
      );
    }

    return (
      <div 
        className={cn(
          "flex-1 overflow-y-scroll p-4 space-y-3",
          "[background-size:40px_40px]",
          "[background-image:linear-gradient(to_right,rgba(228,228,231,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(228,228,231,0.1)_1px,transparent_1px)]",
          "dark:[background-image:linear-gradient(to_right,rgba(38,38,38,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(38,38,38,0.1)_1px,transparent_1px)]",
          "[&::-webkit-scrollbar]:w-6",
          "[&::-webkit-scrollbar]:block",
          "[&::-webkit-scrollbar-track]:bg-[#1f1f1f]",
          "[&::-webkit-scrollbar-track]:border-l-4",
          "[&::-webkit-scrollbar-track]:border-l-black",
          "[&::-webkit-scrollbar-thumb]:bg-[#e6e6e6]",
          "[&::-webkit-scrollbar-thumb]:border-l-4",
          "[&::-webkit-scrollbar-thumb]:border-l-black"
        )}
        ref={chatContainerRef}
      >
        <div>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
                              <span>No messages yet. Send the first message!</span>
            </div>
          ) : (
            messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    );
  };

  // Chat input area
  const renderChatInput = () => {
    // Remove input area in popup mode (for OBS browser source)
    if (isPopupMode) {
      return null;
    }

    return (
      <div className="border-t-2 border-black bg-[oklch(23.93%_0_0)]">
        <ChatInput 
          roomId={selectedRoom || ''}
        />
      </div>
    );
  };

      // When in popup mode
  if (isPopupMode) {
    return (
      <div className="h-screen w-screen bg-transparent">
        <div className="flex flex-col h-full bg-[oklch(23.93%_0_0)] backdrop-blur-sm overflow-hidden">
          {/* Chatroom info - simplified */}
          {renderChatRoomInfo()}
          
          {/* Chat messages - style adjusted */}
          <div 
            className={cn(
              "flex-1 overflow-y-scroll p-3 space-y-2",
              "[background-size:40px_40px]",
              "[background-image:linear-gradient(to_right,rgba(228,228,231,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(228,228,231,0.05)_1px,transparent_1px)]",
              "dark:[background-image:linear-gradient(to_right,rgba(38,38,38,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(38,38,38,0.05)_1px,transparent_1px)]",
              "[&::-webkit-scrollbar]:w-6",
              "[&::-webkit-scrollbar]:block",
              "[&::-webkit-scrollbar-track]:bg-[#1f1f1f]",
              "[&::-webkit-scrollbar-track]:border-l-4",
              "[&::-webkit-scrollbar-track]:border-l-black",
              "[&::-webkit-scrollbar-thumb]:bg-[#e6e6e6]",
              "[&::-webkit-scrollbar-thumb]:border-l-4",
              "[&::-webkit-scrollbar-thumb]:border-l-black"
            )}
            ref={chatContainerRef}
          >
            <div>
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  <span>Waiting for messages...</span>
                </div>
              ) : (
                messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

      // Normal mode
  return (
    <div className="flex flex-col h-full flex-1 bg-[oklch(23.93%_0_0)] border-2 border-black rounded-base overflow-hidden" style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}>
              {/* Chatroom info */}
      {renderChatRoomInfo()}
      
              {/* Chat messages */}
      {renderChatMessages()}
      
              {/* Chat input */}
      {renderChatInput()}
    </div>
  );
} 
