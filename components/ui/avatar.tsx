"use client"

import * as AvatarPrimitive from "@radix-ui/react-avatar"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ImageCacheManager } from '@/lib/utils';

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-none border-2 border-black",
        className,
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex h-full w-full items-center justify-center rounded-none bg-white text-black font-bold",
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }

// Optimized Avatar component
interface OptimizedAvatarProps {
  src?: string | null;
  fallback: string;
  alt?: string;
  className?: string;
  priority?: boolean;
}

export function OptimizedAvatar({
  src,
  fallback,
  alt = 'Avatar',
  className = '',
  priority = false
}: OptimizedAvatarProps) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    if (src && src.startsWith('http')) {
      // Check if image is already cached
      if (ImageCacheManager.isLoaded(src)) {
        setIsLoaded(true);
      } else if (priority) {
        // Preload high-priority images immediately
        ImageCacheManager.preload(src).then(() => {
          setIsLoaded(true);
        });
      }
    }
  }, [src, priority]);

  const handleImageLoad = () => {
    setIsLoaded(true);
    if (src) {
      ImageCacheManager.preload(src);
    }
  };

  const handleImageError = () => {
    setHasError(true);
  };

  // If not a URL (emoji, etc.)
  if (!src || !src.startsWith('http')) {
    return (
      <Avatar className={className}>
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className={className}>
      {!hasError && (
        <AvatarImage 
          src={src} 
          alt={alt}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
        />
      )}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}
