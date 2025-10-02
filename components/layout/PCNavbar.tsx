'use client';

import { useCallback, useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Search, RefreshCw } from 'lucide-react';
import { useRef, useEffect, useMemo } from 'react';
import CreateChatRoomDialog from './CreateChatRoomDialog';
import TokenAvatar from '@/components/ui/TokenAvatar';
import Link from 'next/link';

// Mock chat room data
const mockRooms = [
  { id: 'sol-usdc', name: 'SOL/USDC', image: '💰', description: 'Solana USDC Trading' },
  { id: 'bonk', name: 'BONK', image: '🐕', description: 'BONK Memecoin Trading' },
  { id: 'wif', name: 'WIF', image: '🧢', description: 'Dogwifhat Trading' },
  { id: 'jup', name: 'JUP', image: '🪐', description: 'Jupiter Trading' },
  { id: 'ray', name: 'RAY', image: '⚡', description: 'Raydium Trading' },
  { id: 'samo', name: 'SAMO', image: '🐕‍🦺', description: 'Samoyed Trading' },
];

interface ChatRoom {
  id: string;
  name: string;
  image: string;
  description: string;
}

interface ApiChatRoom {
  id: string;
  contractAddress: string;
  name: string;
  creatorAddress: string;
  transactionSignature: string;
  createdAt: string;
  isActive: boolean;
  image?: string;
}

interface ChatRoomSearchProps {
  onRoomSelect?: (roomId: string) => void;
  onCreateRoom?: () => void;
}

function PCChatRoomSearch({ onRoomSelect, onCreateRoom }: ChatRoomSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [apiRooms, setApiRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadChatrooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chatrooms');
      const data = await response.json();
      
      if (data.success) {
        const formattedRooms = data.chatrooms.map((room: ApiChatRoom) => ({
          id: room.contractAddress,
          name: room.name,
          image: room.image || '🪙',
          description: `CA: ${room.contractAddress.slice(0, 8)}...`
        }));
        setApiRooms(formattedRooms);
      }
    } catch {
      setApiRooms(mockRooms);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChatrooms();
  }, [loadChatrooms]);

  useEffect(() => {
    const handleChatroomCreated = () => {
      loadChatrooms();
    };

    window.addEventListener('chatroomCreated', handleChatroomCreated);
    return () => window.removeEventListener('chatroomCreated', handleChatroomCreated);
  }, [loadChatrooms]);

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

  const handleRoomSelect = useCallback((room: typeof mockRooms[0]) => {
    setShowResults(false);
    onRoomSelect?.(room.id);
  }, [onRoomSelect]);

  const handleCreateRoom = useCallback(() => {
    setShowResults(false);
    onCreateRoom?.();
  }, [onCreateRoom]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(true);
  }, []);

  const handleFocus = useCallback(() => {
    setShowResults(true);
  }, []);

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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-300" />
        <Input 
          placeholder="Search and select Buyve room..."
          className="pl-10 border-2 border-black focus:border-black focus:ring-0 rounded-none bg-[oklch(0.2393_0_0)] text-white placeholder:text-gray-300"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleFocus}
        />
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div 
            className="w-full text-white border-2 border-black rounded-none shadow-[var(--shadow)] flex flex-col"
            style={{ backgroundColor: 'oklch(0.2393 0 0)' }}
          >
            <div className="px-2 py-1.5 text-sm font-semibold">Buyve Room List</div>
            <div className="h-px bg-black mx-1"></div>
            
            <div className="max-h-[240px] overflow-y-auto">
              {isLoading ? (
                <div className="relative flex select-none items-center rounded-none px-2 py-1.5 text-sm outline-none">
                  <span className="text-sm text-gray-300">
                    Loading Buyve rooms...
                  </span>
                </div>
              ) : filteredRooms.length > 0 ? (
                filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleRoomSelect(room)}
                    className="relative flex cursor-pointer select-none items-center rounded-none px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[oklch(0.3_0_0)] hover:text-white hover:border-2 hover:border-black data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-3 border-2 border-transparent"
                  >
                    <TokenAvatar 
                      tokenAddress={room.id}
                      tokenName={room.name}
                      size="sm"
                      imageUrl={room.image}
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{room.name}</div>
                      <div className="text-sm text-gray-300">CA: {room.id.slice(0, 8)}...</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="relative flex select-none items-center rounded-none px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                  <span className="text-sm text-gray-300">
                    No Buyve rooms match &apos;{searchQuery}&apos;.
                  </span>
                </div>
              )}
            </div>
            
            <div className="h-px bg-black mx-1"></div>
            
            <div
              onClick={handleCreateRoom}
              className="relative flex cursor-pointer select-none items-center rounded-none px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[oklch(0.3_0_0)] hover:text-white hover:border-2 hover:border-black data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-3 border-2 border-transparent text-white font-medium"
            >
              <span className="text-lg">➕</span>
              <div className="flex-1">
                <div className="font-semibold">Add Buyve room</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PCWalletProfile() {
  const { 
    isConnected,
    isConnecting,
    address,
    nickname,
    avatar,
    balance,
    isLoadingBalance,
    error,
    connectWallet, 
    disconnectWallet, 
    updateProfile,
    fetchBalance,
    clearError
  } = useWallet();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [tempAvatar, setTempAvatar] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);


  // Update with latest profile info whenever dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      setTempNickname(nickname || '');
      setTempAvatar(avatar || '👤');
    }
  }, [isDialogOpen, nickname, avatar]);



  const handleDialogOpen = useCallback(() => {
    setTempNickname(nickname || '');
    setTempAvatar(avatar || '👤');
    setIsDialogOpen(true);
  }, [avatar, nickname]);

  const handleSave = useCallback(async () => {
    
    try {
      await updateProfile({
        nickname: tempNickname,
        avatar: tempAvatar
      });
      setIsDialogOpen(false);
    } catch {
      // Close popup even if error occurs
      setIsDialogOpen(false);
    }
  }, [tempNickname, tempAvatar, updateProfile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
              alert('Only image files can be uploaded.');
      // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be 5MB or less.');
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
              // Upload to Supabase Storage
      handleSupabaseUpload(file);
      
              // Reset file input (to allow selecting the same file again)
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSupabaseUpload = async (file: File) => {
    if (!address) return;
    
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
        
                  // Immediately update profile after upload
        await updateProfile({
          nickname: tempNickname,
          avatar: result.avatar_url
        });
      } else {
        alert('Image upload failed: ' + result.error);
      }
    } catch {
      alert('An error occurred during image upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConnectWallet = async () => {
    clearError();
    await connectWallet();
  };

  const handleDisconnectWallet = async () => {
    clearError();
    await disconnectWallet();
    setIsDialogOpen(false);
  };

  const handleRefreshBalance = async () => {
    await fetchBalance();
  };

  const formatBalance = (balance: number | null) => {
    if (balance === null) return 'N/A';
    return `${balance.toFixed(4)} SOL`;
  };

  // Safe avatar fallback function
  const getDisplayAvatarFallback = () => {
    // Check if it's an emoji (length 2 or less and within Unicode emoji range)
    if (avatar && avatar.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(avatar)) {
      return avatar;
    }
    
          // Use first character if nickname exists
    if (nickname && nickname.trim()) {
      return nickname.charAt(0).toUpperCase();
    }
    
          // Wallet address based fallback
    if (address) {
      return address.slice(2, 4).toUpperCase();
    }
    
          // Default avatar
    return '👤';
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button 
          className="border-2 border-black rounded-none h-[36px] px-3 sm:px-6 font-semibold shadow-[4px_4px_0px_0px_black] hover:shadow-none focus:shadow-none active:shadow-none text-xs sm:text-sm"
          style={{ 
            backgroundColor: 'oklch(23.93% 0 0)',
            color: 'oklch(0.9249 0 0)'
          }}
          onClick={handleConnectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="neutral"
          className="border-2 border-black rounded-none h-[36px] pl-0 pr-3 sm:pr-6 flex items-center justify-start shadow-[4px_4px_0px_0px_black] hover:shadow-none active:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-x-1 active:translate-y-1 transition-all"
          style={{ 
            backgroundColor: 'oklch(23.93% 0 0)',
            color: 'oklch(0.9249 0 0)'
          }}
          onClick={handleDialogOpen}
          disabled={isConnecting}
        >
          <Avatar className="w-8 h-8" style={{ minWidth: '32px', minHeight: '32px', maxWidth: '32px', maxHeight: '32px', width: '32px', height: '32px', borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px', marginLeft: '0px' }}>
            {avatar?.startsWith('data:') || avatar?.startsWith('http') ? (
              <img 
                src={avatar} 
                alt="Avatar" 
                className="w-full h-full object-cover"
                style={{ borderRadius: '0px' }}
              />
            ) : (
              <AvatarFallback className="text-sm">
                {getDisplayAvatarFallback()}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="text-xs sm:text-sm font-medium flex-1 text-center">
            {nickname || `${address?.slice(0, 4)}...${address?.slice(-4)}`}
          </span>
        </Button>
      </DialogTrigger>
      
      <DialogContent 
        className="sm:max-w-md bg-[oklch(0.2393_0_0)] border-2 border-black text-white [&>button]:border-2 [&>button]:border-black [&>button]:bg-[oklch(0.75_0.183_55.934)] [&>button]:hover:bg-[oklch(0.65_0.183_55.934)] [&>button]:shadow-[4px_4px_0px_0px_black] [&>button]:hover:shadow-none [&>button]:hover:translate-x-1 [&>button]:hover:translate-y-1 [&>button]:transition-all [&>button]:rounded-none" 
        style={{ borderRadius: '0px' }}
      >
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-900 border-2 border-black rounded-none p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Avatar</Label>
            
            <div className="flex items-center gap-4 mb-4">
              <div 
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div 
                  className="w-16 h-16 border-2 border-black flex items-center justify-center overflow-hidden relative"
                  style={{ 
                    backgroundColor: 'oklch(0.2393 0 0)',
                    minWidth: '64px',
                    minHeight: '64px',
                    maxWidth: '64px',
                    maxHeight: '64px'
                  }}
                >
                  {tempAvatar && (tempAvatar.startsWith('data:') || tempAvatar.startsWith('http')) ? (
                    <img 
                      src={tempAvatar} 
                      alt="Avatar preview" 
                      style={{ 
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '0px',
                        display: 'block'
                      }}
                      onLoad={() => {
                        
                        
                      }}
                      onError={() => {
                        
                        
                      }}
                    />
                  ) : (
                    <span className="text-2xl text-white" style={{ display: 'block' }}>
                      {tempAvatar || '👤'}
                    </span>
                  )}
                </div>
                <div 
                  className="absolute inset-0 flex items-center justify-center transition-all duration-200"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0)',
                    zIndex: 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                    const upload = e.currentTarget.querySelector('.upload-icon');
                    if (upload) (upload as HTMLElement).style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0)';
                    const upload = e.currentTarget.querySelector('.upload-icon');
                    if (upload) (upload as HTMLElement).style.opacity = '0';
                  }}
                >
                  <Upload 
                    className="upload-icon h-4 w-4 text-white transition-opacity" 
                    style={{ opacity: 0 }}
                  />
                </div>
              </div>
              
              <div className="text-sm text-gray-300">
                {isUploading ? (
                  <span className="text-blue-400">Uploading image...</span>
                ) : (
                  'Click to upload an image'
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            

          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname" className="text-white">Nickname</Label>
            <Input
              id="nickname"
              value={tempNickname}
              onChange={(e) => setTempNickname(e.target.value)}
              placeholder={address ? `Default: ${address.slice(0, 4)}...${address.slice(-4)}` : 'Enter your nickname'}
              className="border-2 border-black focus:border-black focus:ring-0 rounded-none bg-[oklch(0.2393_0_0)] text-white placeholder:text-gray-300"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Wallet Address</Label>
            <div className="p-2 bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-sm font-mono text-gray-300 break-all">
              {address}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white">SOL Balance</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2 bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-sm font-mono text-gray-300">
                {isLoadingBalance ? 'Loading...' : formatBalance(balance)}
              </div>
              <Button
                variant="neutral"
                size="sm"
                onClick={handleRefreshBalance}
                disabled={isLoadingBalance}
                className="shrink-0 bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-white hover:bg-[oklch(0.3_0_0)]"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex justify-between space-x-2">
            <Button
              variant="reverse"
              onClick={handleDisconnectWallet}
              className="bg-red-600 border-2 border-black rounded-none text-white hover:bg-red-700"
              disabled={isConnecting}
            >
              {isConnecting ? 'Disconnecting...' : 'Disconnect Wallet'}
            </Button>

            <div className="flex space-x-2">
              <Button
                variant="neutral"
                onClick={() => setIsDialogOpen(false)}
                className="bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-white hover:bg-[oklch(0.3_0_0)]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-green-600 border-2 border-black rounded-none text-white hover:bg-green-700"
                disabled={isConnecting}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PCNavbarProps {
  showOnAllScreens?: boolean;
}

export default function PCNavbar({ showOnAllScreens = false }: PCNavbarProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleRoomSelect = useCallback((roomId: string) => {
    
    window.dispatchEvent(new CustomEvent('roomSelected', { 
      detail: { roomId } 
    }));
  }, []);

  const handleCreateRoom = useCallback(() => {
    setIsCreateDialogOpen(true);
  }, []);

  return (
    <>
      {/* PC-only Navbar - 70px height, no padding */}
      <nav className={`${showOnAllScreens ? 'flex' : 'hidden lg:flex'} fixed top-0 left-0 right-0 z-50 h-[70px] w-full bg-[oklch(23.93%_0_0)] border-b-4 border-black items-center justify-between px-3 sm:px-6`}>
                  {/* Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center">
            <img 
              src="/landingpage/images/buyve.svg" 
              alt="Logo" 
              className={`${showOnAllScreens ? 'h-[40px] sm:h-[50px]' : 'h-[50px]'} w-auto hover:opacity-80 transition-opacity`}
              style={{ imageRendering: 'crisp-edges' }}
            />
          </Link>
        </div>

                  {/* Central chatroom search */}
        <div className={`flex-1 max-w-md mx-8 ${showOnAllScreens ? 'hidden sm:block' : 'block'}`}>
          <PCChatRoomSearch 
            onRoomSelect={handleRoomSelect} 
            onCreateRoom={handleCreateRoom}
          />
        </div>

                  {/* Right wallet connection */}
        <div className="flex items-center">
          <PCWalletProfile />
        </div>
      </nav>

              {/* Chatroom creation Dialog */}
      <CreateChatRoomDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
    </>
  );
} 
