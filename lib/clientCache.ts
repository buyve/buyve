// IndexedDB를 활용한 클라이언트 사이드 캐싱
// 차트 데이터를 로컬에 저장하여 네트워크 요청 최소화

interface CachedData {
  tokenAddress: string;
  chartData: unknown[];
  lastUpdated: number;
  version: number;
}

const DB_NAME = 'TradeChatCache';
const DB_VERSION = 1;
const STORE_NAME = 'priceData';
const CACHE_DURATION = 5 * 60 * 1000; // 5분
const MAX_CACHE_SIZE = 50; // 최대 50개 토큰 캐시

class ClientCache {
  private db: IDBDatabase | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  }

  // DB 초기화
  async init(): Promise<void> {
    if (!this.isSupported || this.db) return;

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 초기화 실패');
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

      // 초기화 완료 대기
      await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(undefined);
        request.onerror = () => reject(new Error('IndexedDB init failed'));
      });

      // 오래된 캐시 정리
      await this.cleanupOldCache();
    } catch (error) {
      console.error('Cache 초기화 실패:', error);
      this.isSupported = false;
    }
  }

  // 캐시 데이터 가져오기
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

      // 캐시 만료 확인
      if (Date.now() - data.lastUpdated > CACHE_DURATION) {
        await this.delete(tokenAddress);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache 조회 실패:', error);
      return null;
    }
  }

  // 캐시 데이터 저장
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

      // 캐시 크기 관리
      await this.maintainCacheSize();
    } catch (error) {
      console.error('Cache 저장 실패:', error);
    }
  }

  // 캐시 삭제
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
      console.error('Cache 삭제 실패:', error);
    }
  }

  // 모든 캐시 삭제
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
      console.error('Cache 전체 삭제 실패:', error);
    }
  }

  // 오래된 캐시 정리
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
      console.error('오래된 캐시 정리 실패:', error);
    }
  }

  // 캐시 크기 유지
  private async maintainCacheSize(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = async () => {
        const count = countRequest.result;
        
        if (count > MAX_CACHE_SIZE) {
          // 가장 오래된 항목 삭제
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
      console.error('캐시 크기 관리 실패:', error);
    }
  }

  // 캐시 통계
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

      // 대략적인 크기 계산 (실제 크기는 브라우저마다 다름)
      const totalSize = count * 10 * 1024; // 토큰당 약 10KB 추정

      return { count, totalSize };
    } catch (error) {
      console.error('캐시 통계 조회 실패:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}

// 싱글톤 인스턴스
export const clientCache = new ClientCache();