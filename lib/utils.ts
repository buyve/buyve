import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 이미지 프리로딩 유틸리티
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 여러 이미지를 병렬로 프리로딩
 */
export async function preloadImages(srcs: string[]): Promise<void> {
  const promises = srcs.map(src => preloadImage(src).catch(() => {
    // 이미지 프리로드 실패는 무시
  }));
  await Promise.all(promises);
}

/**
 * 이미지 캐시 관리자
 */
export class ImageCacheManager {
  private static cache = new Map<string, boolean>();
  
  static async preload(src: string): Promise<void> {
    if (this.cache.has(src)) return;
    
    try {
      await preloadImage(src);
      this.cache.set(src, true);
    } catch {
      // 이미지 캐시 실패는 무시
    }
  }
  
  static isLoaded(src: string): boolean {
    return this.cache.has(src);
  }
  
  static clear(): void {
    this.cache.clear();
  }
}
