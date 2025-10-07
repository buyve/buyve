import { OptimizedAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ChatMessage } from '@/types';
import { useState, useEffect } from 'react';

type Props = {
  message: ChatMessage;
};

interface UserProfile {
  nickname?: string;
  avatar_url?: string;
}

export default function ChatBubble({ message }: Props) {
  const { avatar, tradeAmount, content, userAddress, nickname, tradeType } = message;
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileFetchTime, setProfileFetchTime] = useState<number>(Date.now());

  // Profile information lookup
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userAddress) {
        return;
      }

      setIsLoadingProfile(true);

      try {
        // Add timestamp for cache invalidation
        const cacheBuster = Date.now();
        const response = await fetch(`/api/profiles?wallet_address=${encodeURIComponent(userAddress)}&_=${cacheBuster}`, {
          cache: 'no-cache' // Also ignore browser cache
        });
        
        if (!response.ok) {
          return;
        }

        const result = await response.json();
        
        if (result.success && result.profile) {
          setUserProfile(result.profile);
        } else {
          setUserProfile(null);
        }
      } catch {
        setUserProfile(null);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [userAddress, profileFetchTime]);

  // Add event listener to detect profile updates
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      const updatedWalletAddress = event.detail?.walletAddress;

      // Refresh if the current message user's profile was updated
      if (updatedWalletAddress === userAddress) {
        setProfileFetchTime(Date.now());
      }
    };

    // Global profile update event listener
    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener);
    };
  }, [userAddress]);

  const amount = tradeAmount || '0';
  
  // Remove emojis and other auto-added phrases from message content
  const cleanContent = (text: string): string => {
    if (!text) return '';

    // Remove all trade-related auto-generated text patterns
    return text
      // 1. Remove start/end emojis
      .replace(/^(🚀|📈|📉|💰|⚡|🎯|🔥|💎|🌙|🟢|🔴|💸|📊|🎉|🎯|🦄|⭐|✨)\s*/g, '')
      .replace(/\s*(🚀|📈|📉|💰|⚡|🎯|🔥|💎|🌙|🟢|🔴|💸|📊|🎉|🎯|🦄|⭐|✨)$/g, '')

      // 2. Remove "BUY/SELL quantity completed!" patterns
      .replace(/\s*(BUY|SELL|買入|賣出|매수|매도)\s*quantity\s*completed!?\s*/gi, '')
      .replace(/\s*(BUY|SELL)\s*\w+\s*0\.001\s*SOL\s*→\s*[\d,]+\.?\d*\s*\w+/gi, '')

      // 3. Remove "±number SOL" patterns
      .replace(/(\+|-|＋|－)?\s*\d+(\.\d+)?\s*SOL/gi, '')

      // 4. Remove "number SOL → number token" patterns
      .replace(/\d+(\.\d+)?\s*SOL\s*→\s*[\d,]+\.?\d*\s*\w+/gi, '')

      // 5. Remove trade-related auto text
      .replace(/(bought|sold|매수|매도|구매|판매|purchased|acquired)\s*\d+(\.\d+)?\s*(SOL|sol)/gi, '')

      // 6. Remove "quantity guide" text
      .replace(/\s*quantity\s*guide\s*/gi, '')

      // 7. Remove arrow and token conversion info
      .replace(/\s*→\s*[\d,]+\.?\d*\s*\w+/g, '')

      // 8. Remove colons and numbers (transaction IDs etc.)
      .replace(/:\s*[\d,]+\.?\d*/g, '')

      // 9. Clean up duplicate spaces and special characters
      .replace(/\s+/g, ' ')
      .replace(/[:\-_=]+/g, '')
      .trim();
  };

  // Improved avatar display logic (prioritize profile from DB)
  const displayAvatar = () => {
    // 1. Prioritize profile avatar from DB
    if (userProfile?.avatar_url) {
      // emoji: remove prefix if present
      const profileAvatar = userProfile.avatar_url.startsWith('emoji:')
        ? userProfile.avatar_url.replace('emoji:', '')
        : userProfile.avatar_url;

      // Don't display emojis with AvatarImage
      if (profileAvatar.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(profileAvatar)) {
        return null;
      }
      return profileAvatar;
    }

    // 2. Use avatar included in message (fallback)
    if (avatar) {
      return avatar.startsWith('emoji:') ? avatar.replace('emoji:', '') : avatar;
    }

    // 3. Default value
    return null;
  };

  // Display nickname (prioritize profile from DB)
  const displayName = userProfile?.nickname ||
    nickname ||
    (userAddress ? `${userAddress.slice(0, 4)}...${userAddress.slice(-4)}` : 'Anonymous');

  // Avatar fallback handling (for emojis)
  const displayAvatarFallback = () => {
    // 1. Prioritize profile avatar from DB
    if (userProfile?.avatar_url) {
      const profileAvatar = userProfile.avatar_url.startsWith('emoji:')
        ? userProfile.avatar_url.replace('emoji:', '')
        : userProfile.avatar_url;

      if (profileAvatar.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(profileAvatar)) {
        return profileAvatar;
      }
    }

    // 2. Use message avatar
    if (avatar && avatar.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(avatar)) {
      return avatar;
    }

    // 3. Wallet address-based fallback
    const fallback = userAddress ? userAddress.slice(2, 4).toUpperCase() : '?';
    return fallback;
  };
  
  return (
    <Card className="max-w-md mb-4 border-2 border-[oklch(0_0_0)] rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[oklch(67.56%_0.1796_49.61)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0 hover:translate-y-0 transition-none p-0 min-h-fit h-auto">
      <CardContent className="p-4 min-h-fit h-auto w-full">
        <div className="flex items-start gap-3">
          {/* Profile avatar */}
          <div className="relative">
            <OptimizedAvatar
              src={displayAvatar()}
              fallback={displayAvatarFallback()}
              alt={displayName}
              className="w-12 h-12 border-2 border-[oklch(0_0_0)]"
              priority={true}
            />
            {/* Loading indicator */}
            {isLoadingProfile && (
              <div className="absolute inset-0 bg-black bg-opacity-20 rounded flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between flex-1 h-12">
            {/* User name */}
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-[oklch(0%_0_0)] text-base">
                {displayName}
                {isLoadingProfile && <span className="text-xs opacity-50"> (Loading...)</span>}
              </h4>
              {amount && amount !== '0' && (
                <Badge
                  variant="neutral"
                  className={`w-fit h-5 px-2 py-0 text-xs font-semibold rounded-none border cursor-default transition-none flex items-center ${
                    tradeType === 'sell'
                      ? 'bg-red-100 text-red-700 border-[oklch(0_0_0)]'
                      : 'bg-green-100 text-green-700 border-[oklch(0_0_0)]'
                  }`}
                  style={{ boxShadow: 'none' }}
                >
                  {tradeType === 'sell' ? 'SELL' : 'BUY'} {amount} SOL
                </Badge>
              )}
            </div>

            {/* Display only user input text */}
            {cleanContent(content) && (
              <div className="w-full overflow-hidden">
                <p className="text-sm text-[oklch(0%_0_0)] leading-tight break-all line-clamp-1" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                  {cleanContent(content)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 