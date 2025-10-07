// Client-side caching using IndexedDB
// Store chart data locally to minimize network requests

interface CachedData {
  tokenAddress: string;
  chartData: unknown[];
  lastUpdated: number;
  version: number;
}

const DB_NAME = 'TradeChatCache';
const DB_VERSION = 1;
const STORE_NAME = 'priceData';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50; // Maximum 50 tokens cached

class ClientCache {
  private db: IDBDatabase | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  }

  // Initialize DB
  async init(): Promise<void> {
    if (!this.isSupported || this.db) return;

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB initialization failed');
        this.isSupported = false;
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'tokenAddress' });
          store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
      };

      // Wait for initialization to complete
      await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(undefined);
        request.onerror = () => reject(new Error('IndexedDB init failed'));
      });

      // Clean up old cache
      await this.cleanupOldCache();
    } catch (error) {
      console.error('Cache initialization failed:', error);
      this.isSupported = false;
    }
  }

  // Get cached data
  async get(tokenAddress: string): Promise<CachedData | null> {
    if (!this.isSupported || !this.db) return null;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(tokenAddress);

      const data = await new Promise<CachedData | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!data) return null;

      // Check cache expiration
      if (Date.now() - data.lastUpdated > CACHE_DURATION) {
        await this.delete(tokenAddress);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache lookup failed:', error);
      return null;
    }
  }

  // Store cached data
  async set(tokenAddress: string, chartData: unknown[]): Promise<void> {
    if (!this.isSupported || !this.db) return;

    try {
      const data: CachedData = {
        tokenAddress,
        chartData,
        lastUpdated: Date.now(),
        version: DB_VERSION
      };

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Maintain cache size
      await this.maintainCacheSize();
    } catch (error) {
      console.error('Cache save failed:', error);
    }
  }

  // Delete cache
  async delete(tokenAddress: string): Promise<void> {
    if (!this.isSupported || !this.db) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(tokenAddress);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache deletion failed:', error);
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    if (!this.isSupported || !this.db) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache clear failed:', error);
    }
  }

  // Clean up old cache
  private async cleanupOldCache(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('lastUpdated');

      const cutoffTime = Date.now() - CACHE_DURATION;
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    } catch (error) {
      console.error('Old cache cleanup failed:', error);
    }
  }

  // Maintain cache size
  private async maintainCacheSize(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = async () => {
        const count = countRequest.result;

        if (count > MAX_CACHE_SIZE) {
          // Delete oldest entries
          const index = store.index('lastUpdated');
          const cursor = index.openCursor();
          let deleted = 0;
          const toDelete = count - MAX_CACHE_SIZE;

          cursor.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor && deleted < toDelete) {
              store.delete(cursor.primaryKey);
              deleted++;
              cursor.continue();
            }
          };
        }
      };
    } catch (error) {
      console.error('Cache size management failed:', error);
    }
  }

  // Cache statistics
  async getStats(): Promise<{ count: number; totalSize: number }> {
    if (!this.isSupported || !this.db) {
      return { count: 0, totalSize: 0 };
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const count = await new Promise<number>((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Approximate size calculation (actual size varies by browser)
      const totalSize = count * 10 * 1024; // Estimated ~10KB per token

      return { count, totalSize };
    } catch (error) {
      console.error('Cache stats lookup failed:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}

// Singleton instance
export const clientCache = new ClientCache();