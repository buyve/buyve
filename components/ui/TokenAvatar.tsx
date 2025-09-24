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
  // 채팅방에서 미리 조회한 이미지 URL (우선사용)
  imageUrl?: string | null;
}

// Jupiter 메타데이터 타입은 tokenImageFallback에서 가져옴

export default function TokenAvatar({ 
  tokenAddress, 
  tokenName = 'Token', 
  size = 'md',
  className = '',
  imageUrl // 채팅방에서 전달받은 이미지 URL
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
  
  // 크기 설정
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

  // 🎯 토큰 메타데이터 및 이미지 소스 조회
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // 1. 이미지 소스들 조회 (캐싱 적용)
        const sources = await fetchTokenImageWithFallbacks(tokenAddress, imageUrl);
        
        // 2. 최적화된 URL과 프록시 URL 추가
        const optimizedSources: string[] = [];
        sources.forEach(url => {
          optimizedSources.push(getOptimizedImageUrl(url, iconSizes[size]));
          optimizedSources.push(getProxiedImageUrl(url));
          optimizedSources.push(url); // 원본도 폴백으로
        });
        
        setImageSources(optimizedSources);
        
        // 3. 첫 번째 이미지 프리로딩
        if (optimizedSources[0]) {
          ImageCacheManager.preload(optimizedSources[0]);
        }

        // 4. 메타데이터 조회 (캐싱됨)
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

  // 이미지 소스가 변경될 때 인덱스 리셋
  useEffect(() => {
    setCurrentUrlIndex(0);
    setImageError(false);
  }, [imageSources]);

  const handleImageError = useCallback(() => {
    if (currentUrlIndex < imageSources.length - 1) {
      setCurrentUrlIndex(prev => prev + 1);
      // 다음 이미지 프리로딩
      const nextUrl = imageSources[currentUrlIndex + 1];
      if (nextUrl) {
        ImageCacheManager.preload(nextUrl);
      }
    } else {
      setImageError(true);
    }
  }, [currentUrlIndex, imageSources]);

  // 토큰 이름의 첫 글자들을 폴백으로 사용
  const avatarFallback = getTokenAvatarFallback(
    tokenName,
    imageUrl,
    metaplexMetadata,
    jupiterMetadata
  );

  // 현재 사용할 이미지 URL 결정
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