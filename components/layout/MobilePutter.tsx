'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Compass, Search, User, X, Upload, RefreshCw } from 'lucide-react';
import { useWallet } from '@/providers/WalletProvider';
import TokenAvatar from '@/components/ui/TokenAvatar';
import CreateChatRoomDialog from './CreateChatRoomDialog';

// Mock chatroom data (fallback)
const mockRooms = [
  { id: 'sol-usdc', name: 'SOL/USDC', image: '💰', description: 'Solana USDC trading' },
  { id: 'bonk', name: 'BONK', image: '🐕', description: 'BONK memecoin trading' },
  { id: 'wif', name: 'WIF', image: '🧢', description: 'Dogwifhat trading' },
  { id: 'jup', name: 'JUP', image: '🪐', description: 'Jupiter trading' },
  { id: 'ray', name: 'RAY', image: '⚡', description: 'Raydium trading' },
  { id: 'samo', name: 'SAMO', image: '🐕‍🦺', description: 'Samoyed trading' },
];

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

// Chatroom type for UI
interface ChatRoom {
  id: string;
  name: string;
  image: string;
  description: string;
}

// Mobile wallet profile component
function MobileWalletProfile() {
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
  
  console.log('[MOBILE WALLET PROFILE] Component values:', {
    isConnected,
    address,
    nickname,
    avatar,
    balance,
    error
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [tempAvatar, setTempAvatar] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Default avatar array
  const DEFAULT_AVATARS = ['👤', '🧑', '👩', '🤵', '👩‍💼', '🧑‍💼', '👨‍💼', '🧙‍♂️', '🧙‍♀️', '🥷'];

  // Update with latest profile info whenever dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      setTempNickname(nickname || '');
      setTempAvatar(avatar || DEFAULT_AVATARS[0]);
    }
  }, [isDialogOpen, nickname, avatar]);

  // Initialize with current values when dialog opens
  const handleDialogOpen = useCallback(() => {
    setTempNickname(nickname || '');
    setTempAvatar(avatar || DEFAULT_AVATARS[0]);
    setIsDialogOpen(true);
  }, [avatar, nickname]);

  // Save changes
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

  // Image file upload handler
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
        
        // Update profile immediately after upload
        await updateProfile({
          nickname: tempNickname,
          avatar: result.avatar_url
        });
      } else {
        alert('Image upload failed: ' + result.error);
      }
    } catch {
      alert('An error occurred while uploading the image.');
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger file selection
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
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
    // Check if it's an emoji (length 2 or less and in Unicode emoji range)
    if (avatar && avatar.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(avatar)) {
      return avatar;
    }
    
    // Use first character if nickname exists
    if (nickname && nickname.trim()) {
      return nickname.charAt(0).toUpperCase();
    }
    
    // Wallet address-based fallback
    if (address) {
      return address.slice(2, 4).toUpperCase();
    }
    
    // Default avatar
    return '👤';
  };

  // When wallet is not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center">
        <button 
          className="group relative flex flex-col items-center justify-center gap-1 bg-transparent hover:bg-blue-400 text-white hover:text-black transition-colors duration-150 font-bold h-full px-3 py-2 border-none outline-none"
          style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}
          onClick={handleConnectWallet}
          disabled={isConnecting}
        >
          <User className="w-5 h-5 group-hover:scale-110 transition-transform duration-200 text-white group-hover:text-black" />
          <span className="text-xs uppercase tracking-wide leading-none">
            {isConnecting ? 'connecting' : 'account'}
          </span>
        </button>
        {error && (
          <span className="text-xs text-red-300 mt-1 text-center px-2">{error}</span>
        )}
      </div>
    );
  }

  // When wallet is connected
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <button
          className="group relative flex flex-col items-center justify-center gap-1 bg-transparent hover:bg-green-400 text-white hover:text-black transition-colors duration-150 font-bold h-full px-3 py-2 border-none outline-none"
          style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}
          onClick={handleDialogOpen}
          disabled={isConnecting}
        >
          <div className="relative group-hover:scale-110 transition-transform duration-200">
            <Avatar className="w-8 h-8" style={{ minWidth: '32px', minHeight: '32px', maxWidth: '32px', maxHeight: '32px', width: '32px', height: '32px', borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px', marginLeft: '0px' }}>
              {avatar?.startsWith('data:') || avatar?.startsWith('http') ? (
                <img 
                  src={avatar} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  style={{ borderRadius: '0px' }}
                />
              ) : (
                <AvatarFallback className="text-xs bg-white text-black">
                  {getDisplayAvatarFallback()}
                </AvatarFallback>
              )}
            </Avatar>
          </div>
          {nickname ? (
            <span className="text-xs uppercase tracking-wide leading-none">
              {nickname}
            </span>
          ) : (
            <span className="text-xs tracking-wide leading-none">
              {`${address?.slice(0, 4)}...${address?.slice(-4)}`}
            </span>
          )}
        </button>
      </DialogTrigger>

      <DialogContent 
        className="max-w-[95vw] w-full mx-2 sm:max-w-md sm:mx-0 bg-[oklch(0.2393_0_0)] border-2 border-black text-white [&>button]:border-2 [&>button]:border-black [&>button]:bg-[oklch(0.75_0.183_55.934)] [&>button]:hover:bg-[oklch(0.65_0.183_55.934)] [&>button]:shadow-[4px_4px_0px_0px_black] [&>button]:hover:shadow-none [&>button]:hover:translate-x-1 [&>button]:hover:translate-y-1 [&>button]:transition-all [&>button]:rounded-none"
        style={{ borderRadius: '0px' }}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-white">Edit Profile</DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-900 border-2 border-black rounded-none p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        
        <div className="space-y-3">
          {/* Avatar selection */}
          <div className="space-y-2">
                            <Label className="text-sm text-white">Avatar</Label>
            
                          {/* Current avatar preview */}
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="relative group cursor-pointer"
                onClick={triggerFileUpload}
              >
                <div 
                  className="w-12 h-12 border-2 border-black flex items-center justify-center overflow-hidden relative"
                  style={{ 
                    backgroundColor: 'oklch(0.2393 0 0)',
                    minWidth: '48px',
                    minHeight: '48px',
                    maxWidth: '48px',
                    maxHeight: '48px'
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
                    <span className="text-lg text-white" style={{ display: 'block' }}>
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
                    className="upload-icon h-3 w-3 text-white transition-opacity" 
                    style={{ opacity: 0 }}
                  />
                </div>
              </div>
              
              <div className="text-xs text-gray-300">
                {isUploading ? (
                  <span className="text-blue-400">Uploading...</span>
                ) : (
                                      'Click to upload image'
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
          </div>

                      {/* Nickname input */}
          <div className="space-y-2">
                          <Label htmlFor="nickname" className="text-sm text-white">Nickname</Label>
            <Input
              id="nickname"
              value={tempNickname}
              onChange={(e) => setTempNickname(e.target.value)}
                              placeholder={address ? `Default: ${address.slice(0, 4)}...${address.slice(-4)}` : 'Enter nickname'}
              className="border-2 border-black focus:border-black focus:ring-0 rounded-none bg-[oklch(0.2393_0_0)] text-white placeholder:text-gray-300 text-sm"
            />
          </div>

                      {/* Wallet address display - allow line break on mobile */}
          <div className="space-y-2">
                          <Label className="text-sm text-white">Wallet Address</Label>
            <div className="p-2 bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-xs font-mono text-gray-300 break-all">
              {address}
            </div>
          </div>

                      {/* SOL balance display */}
          <div className="space-y-2">
                          <Label className="text-sm text-white">SOL Balance</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2 bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-xs font-mono text-gray-300">
                                  {isLoadingBalance ? 'Loading...' : formatBalance(balance)}
              </div>
              <Button
                variant="neutral"
                size="sm"
                onClick={handleRefreshBalance}
                disabled={isLoadingBalance}
                className="shrink-0 bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-white hover:bg-[oklch(0.3_0_0)] p-2"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Buttons - vertical layout on mobile */}
          <div className="flex flex-col space-y-2 pt-2">
            <Button
              onClick={handleSave}
              className="bg-green-600 border-2 border-black rounded-none text-white hover:bg-green-700 w-full text-sm py-2"
              disabled={isConnecting}
            >
                              Save
            </Button>
            
            <div className="flex space-x-2">
              <Button
                variant="neutral"
                onClick={() => setIsDialogOpen(false)}
                className="bg-[oklch(0.2393_0_0)] border-2 border-black rounded-none text-white hover:bg-[oklch(0.3_0_0)] flex-1 text-sm py-2"
              >
                Cancel
              </Button>
              <Button
                variant="reverse"
                onClick={handleDisconnectWallet}
                className="bg-red-600 border-2 border-black rounded-none text-white hover:bg-red-700 flex-1 text-sm py-2"
                disabled={isConnecting}
              >
                {isConnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MobilePutter() {
  const [showSearchSidebar, setShowSearchSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [apiRooms, setApiRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fix scroll position when sidebar opens/closes
  useEffect(() => {
    if (showSearchSidebar) {
              // Save current scroll position
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
              // Fix both HTML and body
      const html = document.documentElement;
      const body = document.body;
      
              // Save existing styles
      const originalHtmlStyle = html.style.cssText;
      const originalBodyStyle = body.style.cssText;
      
              // Fix HTML
      html.style.position = 'fixed';
      html.style.top = `-${scrollY}px`;
      html.style.left = `-${scrollX}px`;
      html.style.width = '100%';
      html.style.height = '100%';
      html.style.overflow = 'hidden';
      
              // Fix body
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.width = '100%';
      body.style.height = '100%';
      body.style.overflow = 'hidden';
      
      return () => {
        // Restore original styles
        html.style.cssText = originalHtmlStyle;
        body.style.cssText = originalBodyStyle;
        
        // Restore scroll position
        window.scrollTo(scrollX, scrollY);
      };
    }
  }, [showSearchSidebar]);

  // Load actual chatroom data
  const loadChatrooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chatrooms');
      const data = await response.json();
      
      if (data.success) {
        // Convert API data to UI format
        const formattedRooms = data.chatrooms.map((room: ApiChatRoom) => ({
          id: room.contractAddress,
          name: room.name,
          image: room.image || '🪙', // Token image URL or default emoji
          description: `CA: ${room.contractAddress.slice(0, 8)}...`
        }));
        setApiRooms(formattedRooms);
      }
    } catch {
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
    if (!searchQuery.trim()) return allRooms;
    
    const query = searchQuery.toLowerCase();
    return allRooms.filter(room => 
      room.name.toLowerCase().includes(query) ||
      room.description.toLowerCase().includes(query)
    );
  }, [searchQuery, allRooms]);

  // Chatroom selection handler
  const handleRoomSelect = useCallback((room: ChatRoom) => {
    // Send message to chat area to change to selected room
    window.dispatchEvent(new CustomEvent('roomSelected', { 
      detail: { roomId: room.id } 
    }));
    
    // Close sidebar
    setShowSearchSidebar(false);
    setSearchQuery('');
  }, []);

  // Create room handler
  const handleCreateRoom = useCallback(() => {
    // Open chatroom creation dialog
    
    // Close sidebar
    setShowSearchSidebar(false);
    setSearchQuery('');
    
    // Open dialog
    setIsCreateDialogOpen(true);
  }, []);

  // Open search sidebar
  const openSearchSidebar = useCallback(() => {
    setShowSearchSidebar(true);
  }, []);

  // Close search sidebar
  const closeSearchSidebar = useCallback(() => {
    setShowSearchSidebar(false);
    setSearchQuery('');
  }, []);

  return (
    <>
      <footer className="mobile-putter">
        {/* Logo */}
        <button 
          className="relative flex items-center justify-center bg-transparent h-full px-3 py-2 border-none outline-none"
          style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}
        >
          <img 
            src="/logo.svg" 
            alt="Logo" 
            className="w-8 h-8"
            style={{ 
              imageRendering: 'crisp-edges'
            }}
          />
        </button>

        {/* Search */}
        <button 
          className="group relative flex flex-col items-center justify-center gap-1 bg-transparent hover:bg-pink-400 text-white hover:text-black transition-colors duration-150 font-bold h-full px-3 py-2 border-none outline-none"
          style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}
          onClick={openSearchSidebar}
        >
          <Search className="w-5 h-5 group-hover:scale-110 transition-transform duration-200 text-white group-hover:text-black" />
          <span className="text-xs uppercase tracking-wide leading-none">search</span>
        </button>

        {/* Account - Wallet connection functionality */}
        <div className="relative">
          <MobileWalletProfile />
        </div>
      </footer>

      {/* Search sidebar */}
      {showSearchSidebar && (
        <>
          {/* Background overlay */}
          <div 
            className="search-sidebar-overlay"
            onClick={closeSearchSidebar}
          />
          
          {/* Sidebar */}
          <div className="w-80 max-w-[85vw] bg-[oklch(0.2393_0_0)] border-l-2 border-black flex flex-col search-sidebar">
            {/* Sidebar header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-black bg-[oklch(0.2393_0_0)] text-white">
              <h2 className="text-lg font-bold">Search Chatrooms</h2>
              <Button 
                onClick={closeSearchSidebar}
                size="sm"
                className="neobrutalism-button p-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search input */}
            <div className="p-4 border-b border-black">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-300" />
                <Input 
                  placeholder="Search chatroom names..."
                  className="pl-10 border-2 border-black focus:border-black focus:ring-0 rounded-none bg-[oklch(0.2393_0_0)] text-white placeholder:text-gray-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Search results list area (scrollable) */}
            <div className="flex-1 p-4 search-sidebar-content">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-gray-300">
                  <div className="text-center">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
                    <p className="text-sm">Loading chatrooms...</p>
                  </div>
                </div>
              ) : filteredRooms.length > 0 ? (
                <div className="space-y-2">
                  {filteredRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleRoomSelect(room)}
                      className="w-full p-3 text-left bg-[oklch(0.2393_0_0)] hover:bg-[oklch(0.3_0_0)] transition-colors border-2 border-black rounded-none flex items-center gap-3"
                    >
                      <TokenAvatar 
                        tokenAddress={room.id}
                        tokenName={room.name}
                        size="md"
                        imageUrl={room.image}
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-white">{room.name}</div>
                        <div className="text-sm text-gray-300">CA: {room.id.slice(0, 8)}...</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-300">
                  <div className="text-center">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery.trim() 
                        ? `No chatrooms match '${searchQuery}'.`
                        : 'Enter a search term.'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Create chat room fixed area */}
            <div className="p-4 border-t-2 border-black bg-[oklch(0.2393_0_0)]">
              <button
                onClick={handleCreateRoom}
                className="w-full p-3 text-left bg-[oklch(0.2393_0_0)] hover:bg-[oklch(0.3_0_0)] transition-colors border-2 border-black rounded-none flex items-center gap-3 text-white font-medium"
              >
                <span className="text-xl">➕</span>
                                  <div className="flex-1">
                    <div className="font-semibold">Add chat room</div>
                  </div>
              </button>
              
              {/* Total chatroom count */}
              <p className="text-xs text-gray-300 text-center mt-2">
                Total {filteredRooms.length} chatrooms
              </p>
            </div>
          </div>
        </>
      )}

      {/* Chatroom creation Dialog */}
      <CreateChatRoomDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
    </>
  );
} 