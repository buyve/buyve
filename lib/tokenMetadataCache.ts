'use client';

import { TokenMetadata } from './tokenMetadata';

interface CachedTokenMetadata {
  metadata: TokenMetadata;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

interface TokenMetadataCacheConfig {
  maxSize: number;           // Maximum cache entries
  ttl: number;              // Time to Live (milliseconds)
  staleWhileRevalidate: number; // Background revalidation time
}

class TokenMetadataCache {
  private cache: Map<string, CachedTokenMetadata>;
  private pendingRequests: Map<string, Promise<TokenMetadata | null>>;
  private config: TokenMetadataCacheConfig;
  private lruOrder: string[]; // Order for LRU cache management

  constructor(config?: Partial<TokenMetadataCacheConfig>) {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.lruOrder = [];
    this.config = {
      maxSize: 100,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      staleWhileRevalidate: 60 * 60 * 1000, // 1 hour
      ...config
    };

    // Execute only in browser environment
    if (typeof window !== 'undefined') {
      this.loadFromLocalStorage();
      this.startPeriodicCleanup();
    }
  }

  /**
   * Get metadata from cache
   */
  get(tokenAddress: string): TokenMetadata | null {
    const cached = this.cache.get(tokenAddress);

    if (!cached) {
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    // Check TTL
    if (age > this.config.ttl) {
      this.delete(tokenAddress);
      return null;
    }

    // Update LRU
    this.updateLRU(tokenAddress);

    // Update access count and time
    cached.lastAccessed = now;
    cached.accessCount++;

    return cached.metadata;
  }

  /**
   * Save metadata to cache
   */
  set(tokenAddress: string, metadata: TokenMetadata): void {
    const now = Date.now();

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(tokenAddress)) {
      this.evictLRU();
    }

    this.cache.set(tokenAddress, {
      metadata,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1
    });

    this.updateLRU(tokenAddress);
    this.saveToLocalStorage();
  }

  /**
   * Delete entry from cache
   */
  delete(tokenAddress: string): void {
    this.cache.delete(tokenAddress);
    this.lruOrder = this.lruOrder.filter(addr => addr !== tokenAddress);
    this.saveToLocalStorage();
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.lruOrder = [];
    this.pendingRequests.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tokenMetadataCache');
    }
  }

  /**
   * Check cache status
   */
  has(tokenAddress: string): boolean {
    const cached = this.cache.get(tokenAddress);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age <= this.config.ttl;
  }

  /**
   * Check if cache is stale
   */
  isStale(tokenAddress: string): boolean {
    const cached = this.cache.get(tokenAddress);
    if (!cached) return true;

    const age = Date.now() - cached.timestamp;
    return age > this.config.staleWhileRevalidate;
  }

  /**
   * Register pending request (prevent duplicate requests)
   */
  setPending(tokenAddress: string, promise: Promise<TokenMetadata | null>): void {
    this.pendingRequests.set(tokenAddress, promise);

    // Remove when completed
    promise.finally(() => {
      this.pendingRequests.delete(tokenAddress);
    });
  }

  /**
   * Check pending request
   */
  getPending(tokenAddress: string): Promise<TokenMetadata | null> | undefined {
    return this.pendingRequests.get(tokenAddress);
  }

  /**
   * Update LRU order
   */
  private updateLRU(tokenAddress: string): void {
    this.lruOrder = this.lruOrder.filter(addr => addr !== tokenAddress);
    this.lruOrder.push(tokenAddress);
  }

  /**
   * Evict cache based on LRU
   */
  private evictLRU(): void {
    if (this.lruOrder.length === 0) return;

    const toEvict = this.lruOrder.shift();
    if (toEvict) {
      this.cache.delete(toEvict);
    }
  }

  /**
   * Save cache to LocalStorage
   */
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        value: {
          metadata: value.metadata,
          timestamp: value.timestamp,
          lastAccessed: value.lastAccessed,
          accessCount: value.accessCount
        }
      }));

      localStorage.setItem('tokenMetadataCache', JSON.stringify({
        version: 1,
        data,
        lruOrder: this.lruOrder
      }));
    } catch (error) {
      console.error('Failed to save metadata cache to localStorage:', error);
    }
  }

  /**
   * Load cache from LocalStorage
   */
  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('tokenMetadataCache');
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (parsed.version !== 1) return;

      const now = Date.now();

      // Load only valid cache entries
      parsed.data.forEach((item: any) => {
        const age = now - item.value.timestamp;
        if (age <= this.config.ttl) {
          this.cache.set(item.key, item.value);
        }
      });

      // Restore LRU order
      this.lruOrder = parsed.lruOrder.filter((addr: string) =>
        this.cache.has(addr)
      );

    } catch (error) {
      console.error('Failed to load metadata cache from localStorage:', error);
    }
  }

  /**
   * Periodic cache cleanup
   */
  private startPeriodicCleanup(): void {
    // Clean up expired cache every 30 minutes
    setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];

      this.cache.forEach((value, key) => {
        if (now - value.timestamp > this.config.ttl) {
          toDelete.push(key);
        }
      });

      toDelete.forEach(key => this.delete(key));
    }, 30 * 60 * 1000);
  }

  /**
   * Cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    mostAccessed: Array<{ address: string; count: number }>;
  } {
    const entries = Array.from(this.cache.entries());
    const totalAccess = entries.reduce((sum, [_, value]) => sum + value.accessCount, 0);

    const mostAccessed = entries
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([address, value]) => ({
        address,
        count: value.accessCount
      }));

    return {
      size: this.cache.size,
      hitRate: totalAccess > 0 ? (totalAccess - entries.length) / totalAccess : 0,
      mostAccessed
    };
  }

  /**
   * Preheat cache (preload frequently used tokens)
   */
  async preheat(tokenAddresses: string[], fetchFn: (address: string) => Promise<TokenMetadata | null>): Promise<void> {
    const promises = tokenAddresses.map(async (address) => {
      if (!this.has(address)) {
        try {
          const metadata = await fetchFn(address);
          if (metadata) {
            this.set(address, metadata);
          }
        } catch (error) {
          console.error(`Failed to preheat ${address}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }
}

// Singleton instance
export const tokenMetadataCache = new TokenMetadataCache();

// Export types
export type { TokenMetadataCache, TokenMetadataCacheConfig };