'use client';

import { TokenMetadata } from './tokenMetadata';

interface CachedTokenMetadata {
  metadata: TokenMetadata;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

interface TokenMetadataCacheConfig {
  maxSize: number;           // 최대 캐시 항목 수
  ttl: number;              // Time to Live (밀리초)
  staleWhileRevalidate: number; // 백그라운드 재검증 시간
}

class TokenMetadataCache {
  private cache: Map<string, CachedTokenMetadata>;
  private pendingRequests: Map<string, Promise<TokenMetadata | null>>;
  private config: TokenMetadataCacheConfig;
  private lruOrder: string[]; // LRU 캐시 관리를 위한 순서

  constructor(config?: Partial<TokenMetadataCacheConfig>) {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.lruOrder = [];
    this.config = {
      maxSize: 100,
      ttl: 24 * 60 * 60 * 1000, // 24시간
      staleWhileRevalidate: 60 * 60 * 1000, // 1시간
      ...config
    };

    // 브라우저 환경에서만 실행
    if (typeof window !== 'undefined') {
      this.loadFromLocalStorage();
      this.startPeriodicCleanup();
    }
  }

  /**
   * 캐시에서 메타데이터 가져오기
   */
  get(tokenAddress: string): TokenMetadata | null {
    const cached = this.cache.get(tokenAddress);
    
    if (!cached) {
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    // TTL 확인
    if (age > this.config.ttl) {
      this.delete(tokenAddress);
      return null;
    }

    // LRU 업데이트
    this.updateLRU(tokenAddress);
    
    // 접근 카운트 및 시간 업데이트
    cached.lastAccessed = now;
    cached.accessCount++;

    return cached.metadata;
  }

  /**
   * 캐시에 메타데이터 저장
   */
  set(tokenAddress: string, metadata: TokenMetadata): void {
    const now = Date.now();
    
    // 캐시 크기 제한 확인
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
   * 캐시에서 항목 삭제
   */
  delete(tokenAddress: string): void {
    this.cache.delete(tokenAddress);
    this.lruOrder = this.lruOrder.filter(addr => addr !== tokenAddress);
    this.saveToLocalStorage();
  }

  /**
   * 전체 캐시 클리어
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
   * 캐시 상태 확인
   */
  has(tokenAddress: string): boolean {
    const cached = this.cache.get(tokenAddress);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp;
    return age <= this.config.ttl;
  }

  /**
   * 캐시가 stale 상태인지 확인
   */
  isStale(tokenAddress: string): boolean {
    const cached = this.cache.get(tokenAddress);
    if (!cached) return true;
    
    const age = Date.now() - cached.timestamp;
    return age > this.config.staleWhileRevalidate;
  }

  /**
   * 진행 중인 요청 등록 (중복 요청 방지)
   */
  setPending(tokenAddress: string, promise: Promise<TokenMetadata | null>): void {
    this.pendingRequests.set(tokenAddress, promise);
    
    // 완료되면 제거
    promise.finally(() => {
      this.pendingRequests.delete(tokenAddress);
    });
  }

  /**
   * 진행 중인 요청 확인
   */
  getPending(tokenAddress: string): Promise<TokenMetadata | null> | undefined {
    return this.pendingRequests.get(tokenAddress);
  }

  /**
   * LRU 순서 업데이트
   */
  private updateLRU(tokenAddress: string): void {
    this.lruOrder = this.lruOrder.filter(addr => addr !== tokenAddress);
    this.lruOrder.push(tokenAddress);
  }

  /**
   * LRU 기반 캐시 제거
   */
  private evictLRU(): void {
    if (this.lruOrder.length === 0) return;
    
    const toEvict = this.lruOrder.shift();
    if (toEvict) {
      this.cache.delete(toEvict);
    }
  }

  /**
   * LocalStorage에 캐시 저장
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
   * LocalStorage에서 캐시 로드
   */
  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('tokenMetadataCache');
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (parsed.version !== 1) return;

      const now = Date.now();
      
      // 유효한 캐시 항목만 로드
      parsed.data.forEach((item: any) => {
        const age = now - item.value.timestamp;
        if (age <= this.config.ttl) {
          this.cache.set(item.key, item.value);
        }
      });

      // LRU 순서 복원
      this.lruOrder = parsed.lruOrder.filter((addr: string) => 
        this.cache.has(addr)
      );

    } catch (error) {
      console.error('Failed to load metadata cache from localStorage:', error);
    }
  }

  /**
   * 주기적 캐시 정리
   */
  private startPeriodicCleanup(): void {
    // 30분마다 만료된 캐시 정리
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
   * 캐시 통계
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
   * 캐시 예열 (자주 사용되는 토큰 미리 로드)
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

// 싱글톤 인스턴스
export const tokenMetadataCache = new TokenMetadataCache();

// 타입 내보내기
export type { TokenMetadataCache, TokenMetadataCacheConfig };