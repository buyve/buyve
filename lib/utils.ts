import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Image preloading utility
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
 * Preload multiple images in parallel
 */
export async function preloadImages(srcs: string[]): Promise<void> {
  const promises = srcs.map(src => preloadImage(src).catch(() => {
    // Ignore image preload failures
  }));
  await Promise.all(promises);
}

/**
 * Image cache manager
 */
export class ImageCacheManager {
  private static cache = new Map<string, boolean>();

  static async preload(src: string): Promise<void> {
    if (this.cache.has(src)) return;

    try {
      await preloadImage(src);
      this.cache.set(src, true);
    } catch {
      // Ignore image cache failures
    }
  }

  static isLoaded(src: string): boolean {
    return this.cache.has(src);
  }

  static clear(): void {
    this.cache.clear();
  }
}
