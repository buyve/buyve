'use client';

import { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchTokenMetadataWithRetry } from '@/lib/tokenMetadata';
import { ImageCacheManager } from '@/lib/utils';
import {
  fetchTokenImageWithFallbacks,
  getOptimizedImageUrl,
  getProxiedImageUrl,
  getTokenAvatarFallback,
  jupiterTokenListCache
} from '@/lib/tokenImageFallback';

interface TokenAvatarProps {
  tokenAddress: string;
  tokenName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  // Image URL pre-fetched from chatroom (priority use)
  imageUrl?: string | null;
}

// Jupiter metadata type is imported from tokenImageFallback

export default function TokenAvatar({
  tokenAddress,
  tokenName = 'Token',
  size = 'md',
  className = '',
  imageUrl // Image URL passed from chatroom
}: TokenAvatarProps) {

  const [imageError, setImageError] = useState(false);
  const [metaplexMetadata, setMetaplexMetadata] = useState<{
    name: string;
    symbol: string;
    image?: string;
  } | null>(null);
  const [jupiterMetadata, setJupiterMetadata] = useState<{
    name: string;
    symbol: string;
    logoURI?: string;
  } | null>(null);
  const [imageSources, setImageSources] = useState<string[]>([]);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  // Size settings
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  const iconSizes = {
    sm: 32,
    md: 48,
    lg: 64
  };

  // 🎯 Fetch token metadata and image sources
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // 1. Fetch image sources (with caching)
        const sources = await fetchTokenImageWithFallbacks(tokenAddress, imageUrl);

        // 2. Try original URL first, then optimized/proxied only on failure
        const optimizedSources: string[] = [];
        sources.forEach(url => {
          optimizedSources.push(url); // Original first
          optimizedSources.push(getOptimizedImageUrl(url, iconSizes[size]));
          optimizedSources.push(getProxiedImageUrl(url));
        });

        setImageSources(optimizedSources);

        // 3. Preload first image
        if (optimizedSources[0]) {
          ImageCacheManager.preload(optimizedSources[0]);
        }

        // 4. Fetch metadata (cached)
        const [metaplexResult, jupiterToken] = await Promise.allSettled([
          fetchTokenMetadataWithRetry(tokenAddress, 2),
          jupiterTokenListCache.getToken(tokenAddress)
        ]);

        if (metaplexResult.status === 'fulfilled' && metaplexResult.value) {
          setMetaplexMetadata(metaplexResult.value);
        }

        if (jupiterToken.status === 'fulfilled' && jupiterToken.value) {
          setJupiterMetadata(jupiterToken.value);
        }
      } catch (error) {
        console.error('Failed to fetch token metadata:', error);
      }
    };

    if (tokenAddress) {
      fetchMetadata();
    }
  }, [tokenAddress, imageUrl, size]);

  // Reset index when image sources change
  useEffect(() => {
    setCurrentUrlIndex(0);
    setImageError(false);
  }, [imageSources]);

  const handleImageError = useCallback(() => {
    if (currentUrlIndex < imageSources.length - 1) {
      setCurrentUrlIndex(prev => prev + 1);
      // Preload next image
      const nextUrl = imageSources[currentUrlIndex + 1];
      if (nextUrl) {
        ImageCacheManager.preload(nextUrl);
      }
    } else {
      setImageError(true);
    }
  }, [currentUrlIndex, imageSources, tokenName]);

  // Use first letters of token name as fallback
  const avatarFallback = getTokenAvatarFallback(
    tokenName,
    imageUrl,
    metaplexMetadata,
    jupiterMetadata
  );

  // Determine current image URL to use
  const currentImageUrl = imageSources.length > 0 ? imageSources[currentUrlIndex] : undefined;


  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {currentImageUrl && !imageError && (
        <AvatarImage 
          src={currentImageUrl} 
          alt={tokenName}
          onError={handleImageError}
        />
      )}
      <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-400 to-purple-500 text-white">
        {avatarFallback}
      </AvatarFallback>
    </Avatar>
  );
} 