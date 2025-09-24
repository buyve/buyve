'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/providers/WalletProvider';
// Removed useWalletModal - direct connection implementation
import ClientOnly from '@/components/ClientOnly'; // Prevent hydration errors
import TokenAvatar from '@/components/ui/TokenAvatar';
import CreateChatRoomDialog from './CreateChatRoomDialog';

// Mock chatroom data (actually fetched from API)
const mockRooms = [
  { id: 'sol-usdc', name: 'SOL/USDC', image: '💰', description: 'Solana USDC trading' },
  { id: 'bonk', name: 'BONK', image: '🐕', description: 'BONK memecoin trading' },
  { id: 'wif', name: 'WIF', image: '🧢', description: 'Dogwifhat trading' },
  { id: 'jup', name: 'JUP', image: '🪐', description: 'Jupiter trading' },
  { id: 'ray', name: 'RAY', image: '⚡', description: 'Raydium trading' },
  { id: 'samo', name: 'SAMO', image: '🐕‍🦺', description: 'Samoyed trading' },
];

interface ChatRoom {
  id: string;
  name: string;
  image: string;
  description: string;
}

// Chatroom type received from API
interface ApiChatRoom {
  id: string;
  contractAddress: string;
  name: string;
  creatorAddress: string;
  transactionSignature: string;
  createdAt: string;
  isActive: boolean;
  image?: string; // Image URL fetched from token metadata
}

interface ChatRoomSearchProps {
  onRoomSelect?: (roomId: string) => void;
  onCreateRoom?: () => void;
}

function ChatRoomSearch({ onRoomSelect, onCreateRoom }: ChatRoomSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [apiRooms, setApiRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load actual chatroom data
  const loadChatrooms = useCallback(async () => {
    setIsLoading(true);
    try {
      // 채팅방 목록 로드 시작
      const response = await fetch('/api/chatrooms');
      const data = await response.json();
      
      if (data.success) {
        // 채팅방 목록 로드 성공
        // Convert API data to UI format
        const formattedRooms = data.chatrooms.map((room: ApiChatRoom) => ({
          id: room.contractAddress,
          name: room.name,
                      image: room.image || '🪙', // Token image URL or default emoji
          description: `CA: ${room.contractAddress.slice(0, 8)}...`
        }));
        setApiRooms(formattedRooms);
                  // 포맷된 채팅방 목록
      }
        } catch {
      // 채팅방 로드 오류
              // Keep mock data on error
      setApiRooms(mockRooms);
    } finally {
      setIsLoading(false);
    }
  }, []);

      // Load data on component mount
  useEffect(() => {
    loadChatrooms();
  }, [loadChatrooms]);

      // Chatroom creation event listener
  useEffect(() => {
    const handleChatroomCreated = () => {
              loadChatrooms(); // Refresh list when new chatroom is created
    };

    window.addEventListener('chatroomCreated', handleChatroomCreated);
    return () => window.removeEventListener('chatroomCreated', handleChatroomCreated);
  }, [loadChatrooms]);

      // Searched chatroom list (API data first, fallback to mock data)
  const allRooms = apiRooms.length > 0 ? apiRooms : mockRooms;
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return allRooms.slice(0, 5);
    
    const query = searchQuery.toLowerCase();
    return allRooms
      .filter(room => 
        room.name.toLowerCase().includes(query) ||
        room.description.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [searchQuery, allRooms]);

      // Chatroom selection handler
  const handleRoomSelect = useCallback((room: typeof mockRooms[0]) => {
    setShowResults(false); // Hide results list
    onRoomSelect?.(room.id);
    // 채팅방 선택됨
  }, [onRoomSelect]);

  // Create room handler
  const handleCreateRoom = useCallback(() => {
    setShowResults(false); // Hide results list
    onCreateRoom?.();
  }, [onCreateRoom]);

  // Search input handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(true);
  }, []);

  // Input focus handler
  const handleFocus = useCallback(() => {
    setShowResults(true);
  }, []);

  // Hide results list on outside click
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      {/* Integrated search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search and select chatroom..."
          className="neobrutalism-input pl-10"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleFocus}
        />
      </div>

              {/* Search results dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div 
            className="w-full text-popover-foreground border rounded-md shadow-[var(--shadow)] flex flex-col"
            style={{ backgroundColor: 'oklch(72.27% 0.1894 50.19)' }}
          >
            {/* Header */}
                          <div className="px-2 py-1.5 text-sm font-semibold">Chatroom List</div>
            <div className="h-px bg-border mx-1"></div>
            
                          {/* Chatroom list area (up to 5, scrollable) */}
            <div className="max-h-[240px] overflow-y-auto">
              {isLoading ? (
                <div className="relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none">
                  <span className="text-sm text-muted-foreground">
                    Loading chatrooms...
                  </span>
                </div>
              ) : filteredRooms.length > 0 ? (
                filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleRoomSelect(room)}
                    className="relative flex cursor-pointer select-none items-center rounded-[5px] px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground hover:border-2 hover:border-black data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-3 border-2 border-transparent"
                  >
                    <TokenAvatar 
                      tokenAddress={room.id}
                      tokenName={room.name}
                      size="sm"
                      imageUrl={room.image}
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{room.name}</div>
                      <div className="text-sm text-muted-foreground">CA: {room.id.slice(0, 8)}...</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                  <span className="text-sm text-muted-foreground">
                    No chatrooms match &apos;{searchQuery}&apos;.
                  </span>
                </div>
              )}
            </div>
            
            {/* Separator */}
            <div className="h-px bg-border mx-1"></div>
            
                          {/* Create chat room option (always fixed) */}
            <div
              onClick={handleCreateRoom}
              className="relative flex cursor-pointer select-none items-center rounded-[5px] px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground hover:border-2 hover:border-black data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-3 border-2 border-transparent text-blue-600 font-medium"
            >
              <span className="text-lg">➕</span>
              <div className="flex-1">
                <div className="font-semibold">Add achat room</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wallet profile component
function WalletProfile(): React.ReactElement {
  const { 
    isConnected, 
    address, 
    nickname, 
    avatar, 
    profile,
    disconnectWallet, 
    updateProfile,
    connectWallet
  } = useWallet();
  
  console.log('[WALLET PROFILE] Component values:', {
    isConnected,
    address,
    nickname,
    avatar,
    profile
  });
  
  const DEFAULT_AVATARS = ['👤', '🧑', '👩', '🤵', '👩‍💼', '🧑‍💼', '👨‍💼', '🧙‍♂️', '🧙‍♀️', '🥷'];
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [tempAvatar, setTempAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with current values when Dialog opens
  useEffect(() => {
    if (isDialogOpen && isConnected) {
      setTempNickname(nickname || '');
      // Avatar setting (already handled in useWallet)
      setTempAvatar(avatar || DEFAULT_AVATARS[0]);
    }
  }, [isDialogOpen, nickname, avatar, isConnected]);

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        nickname: tempNickname,
        avatar: tempAvatar
      });
      setIsDialogOpen(false);
              // 프로필 저장 완료
          } catch {
        // 프로필 저장 오류
      alert('An error occurred while saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Image upload handling
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('wallet_address', address);

      const response = await fetch('/api/profiles/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setTempAvatar(result.avatar_url);
        // 이미지 업로드 완료
        
        // Update profile immediately after upload
        await updateProfile({
          nickname: tempNickname,
          avatar: result.avatar_url
        });
                  // 프로필 자동 업데이트 완료
              } else {
          // 이미지 업로드 실패
        alert('Image upload failed: ' + result.error);
      }
          } catch {
        // 이미지 업로드 오류
      alert('An error occurred during image upload.');
    } finally {
      setIsUploading(false);
    }
  };

  // Safe avatar fallback function
  const getDisplayAvatarFallback = () => {
    // Check if emoji (length 2 or less and Unicode emoji range)
    if (avatar && avatar.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(avatar)) {
      return avatar;
    }
    
    // Use first character of nickname if available
    if (nickname && nickname.trim()) {
      return nickname.charAt(0).toUpperCase();
    }
    
    // Wallet address-based fallback (added null check)
    if (address && address.length > 3) {
      return address.slice(2, 4).toUpperCase();
    }
    
    // Default avatar
    return '👤';
  };

      // If wallet is not connected
  if (!isConnected) {
    return (
      <ClientOnly fallback={
        <Button className="neobrutalism-button" disabled>
          Connect Wallet
        </Button>
      }>
        <Button 
          className="neobrutalism-button border-2 border-black rounded-none px-6 font-semibold shadow-[4px_4px_0px_0px_black] hover:shadow-none focus:shadow-none active:shadow-none"
          style={{ 
            backgroundColor: 'oklch(23.93% 0 0)',
            color: 'oklch(0.9249 0 0)'
          }}
          onClick={connectWallet}
        >
          Connect Wallet
        </Button>
      </ClientOnly>
    );
  }

  // If wallet is connected
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="neutral"
          className="neobrutalism-button border-2 border-black rounded-none shadow-[4px_4px_0px_0px_black] hover:shadow-none focus:shadow-none active:shadow-none flex items-center px-3 py-2"
          style={{ 
            backgroundColor: 'oklch(23.93% 0 0)',
            color: 'oklch(0.9249 0 0)'
          }}
          onClick={() => {
            setIsDialogOpen(true);
          }}
        >
          <div 
            className="relative flex shrink-0 overflow-hidden"
            style={{ 
              minWidth: '32px',
              minHeight: '32px',
              maxWidth: '32px',
              maxHeight: '32px',
              width: '32px',
              height: '32px',
              borderTopWidth: '0px',
              borderRightWidth: '0px',
              borderBottomWidth: '0px',
              borderLeftWidth: '0px',
              marginLeft: '0px',
              borderRadius: '0px',
              boxShadow: 'none'
            }}
          >
            {avatar?.startsWith('data:') || avatar?.startsWith('http') ? (
              <img 
                src={avatar} 
                alt="Avatar" 
                className="w-full h-full object-cover"
                style={{ borderRadius: '0px' }}
                onError={(e) => {
                  // Replace with default avatar on image load failure
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div 
                className="flex items-center justify-center bg-white text-black font-bold text-sm w-full h-full"
                style={{ borderRadius: '0px' }}
              >
                {getDisplayAvatarFallback()}
              </div>
            )}
          </div>
          <span className="text-sm font-medium flex-1 text-center">
            {(nickname && nickname.trim()) 
              ? nickname 
              : address 
                ? `${address.slice(0, 4)}...${address.slice(-4)}` 
                : 'Wallet Connected'
            }
          </span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Avatar selection */}
          <div className="space-y-2">
                          <Label>Avatar</Label>
            
                          {/* Current avatar preview */}
            <div className="flex items-center gap-4 mb-4">
              <div 
                className="relative group cursor-pointer"
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 border-2 border-border bg-gray-100 flex items-center justify-center overflow-hidden">
                  {tempAvatar.startsWith('data:') || tempAvatar.startsWith('http') ? (
                    <img 
                      src={tempAvatar} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{tempAvatar}</span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Upload className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                {isUploading ? (
                  <span className="text-blue-600">Uploading image...</span>
                ) : (
                  <>
                    Click to upload image or<br />
                    select a default avatar below
                  </>
                )}
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {/* Default avatar selection */}
            <div className="grid grid-cols-5 gap-2">
              {DEFAULT_AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => setTempAvatar(avatar)}
                  className={`p-2 rounded-base border-2 text-lg hover:bg-gray-100 transition-colors ${
                    tempAvatar === avatar 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-border'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Nickname input */}
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              value={tempNickname}
              onChange={(e) => setTempNickname(e.target.value)}
              placeholder={address ? `Default: ${address.slice(0, 4)}...${address.slice(-4)}` : 'Enter nickname'}
              className="neobrutalism-input"
            />
          </div>

          {/* Wallet address display */}
          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="p-2 bg-gray-100 rounded-base text-sm font-mono text-gray-600">
              {address}
            </div>
          </div>

          {/* Saved profile status */}
          {profile?.updated_at && (
            <div className="text-xs text-gray-500 border-l-2 border-blue-200 pl-2">
              💾 Last saved: {new Date(profile.updated_at).toLocaleString('en-US')}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-between space-x-2">
            <Button
              variant="reverse"
              onClick={disconnectWallet}
              className="neobrutalism-button"
              disabled={isSaving}
            >
              Disconnect Wallet
            </Button>

            <div className="flex space-x-2">
              <Button
                variant="neutral"
                onClick={() => setIsDialogOpen(false)}
                className="neobrutalism-button"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="neobrutalism-button"
                disabled={isSaving || isUploading}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </div>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Navbar() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleRoomSelect = useCallback((roomId: string) => {
    // Chatroom selection handler
    // 네비게이션에서 채팅방 선택됨
    
    // Send message to ChatArea to change to selected room
    window.dispatchEvent(new CustomEvent('roomSelected', { 
      detail: { roomId } 
    }));
  }, []);

  const handleCreateRoom = useCallback(() => {
    // Open chatroom creation dialog
    setIsCreateDialogOpen(true);
  }, []);

  const navContent = (
    <>
      {/* Logo */}
      <div className="navbar-logo">
        <img 
          src="/logo.svg" 
          alt="Logo" 
          className="h-10 w-auto"
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>

      {/* Chatroom search (Desktop center) */}
      <div className="navbar-center hidden lg:flex">
        <ChatRoomSearch 
          onRoomSelect={handleRoomSelect} 
          onCreateRoom={handleCreateRoom}
        />
      </div>

      {/* Right control area */}
      <div className="navbar-right hidden lg:flex items-center space-x-3">
        {/* Wallet connection */}
        <WalletProfile />
      </div>

      {/* Chatroom creation Dialog */}
      <CreateChatRoomDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
    </>
  );

  return (
    <>
      <nav className="mobile-navbar flex lg:hidden">
        {navContent}
      </nav>
    </>
  );
} 