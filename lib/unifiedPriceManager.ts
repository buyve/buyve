import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { clientCache } from '@/lib/clientCache';

// 🎯 통일된 가격 데이터 타입 (Jupiter v6 기준)
export interface UnifiedPriceData {
  tokenAddress: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent: number;
  timestamp: string;
  source: 'jupiter' | 'database';
  hasHistory: boolean;
}

// 차트 데이터 포인트 (OHLCV 형식)
export interface UnifiedChartPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  price: number; // close와 동일하지만 호환성 유지
  time: string;
  fullTime: string;
}

// 구독자 콜백 타입
type PriceUpdateCallback = (data: UnifiedPriceData) => void;
type ChartUpdateCallback = (data: UnifiedChartPoint[]) => void;

// 🚀 통일된 가격 관리자 (모든 데이터 소스 통합)
class UnifiedPriceManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private priceSubscribers: Map<string, Set<PriceUpdateCallback>> = new Map();
  private chartSubscribers: Map<string, Set<ChartUpdateCallback>> = new Map();
  private priceCache: Map<string, UnifiedPriceData> = new Map();
  private chartCache: Map<string, UnifiedChartPoint[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  // 🎯 Jupiter v6 API를 사용한 통일된 가격 조회
  private async fetchUnifiedPrice(tokenAddress: string): Promise<UnifiedPriceData | null> {
    try {
      // 1. Jupiter v6 API 호출
      const response = await fetch(
        `https://price.jup.ag/v6/price?ids=${tokenAddress}&showExtraInfo=true`
      );
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }
      
      const data = await response.json();
      const priceInfo = data.data[tokenAddress];
      
      if (!priceInfo) {
        throw new Error('Token not found in Jupiter API');
      }

      // 2. 데이터베이스에서 히스토리 확인 (24시간 변화율 계산)
      const { data: history } = await supabase
        .from('token_price_history')
        .select('open_price, timestamp_1min')
        .eq('token_address', tokenAddress)
        .gte('timestamp_1min', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp_1min', { ascending: true })
        .limit(1);

      let priceChange24h = 0;
      let priceChangePercent = 0;
      let hasHistory = false;

      if (history && history.length > 0) {
        hasHistory = true;
        const price24hAgo = history[0].open_price;
        priceChange24h = priceInfo.price - price24hAgo;
        priceChangePercent = (priceChange24h / price24hAgo) * 100;
      }

      // 3. 토큰 심볼 조회 (캐시 또는 Jupiter API)
      const symbol = await this.getTokenSymbol(tokenAddress);

      const unifiedData: UnifiedPriceData = {
        tokenAddress,
        symbol,
        price: priceInfo.price,
        priceChange24h,
        priceChangePercent,
        timestamp: new Date().toISOString(),
        source: 'jupiter',
        hasHistory
      };

      return unifiedData;
    } catch (error) {
      console.error('통일된 가격 조회 실패:', error);
      
      // 4. 실패 시 데이터베이스 폴백
      return await this.fetchPriceFromDatabase(tokenAddress);
    }
  }

  // 데이터베이스에서 가격 조회 (폴백)
  private async fetchPriceFromDatabase(tokenAddress: string): Promise<UnifiedPriceData | null> {
    try {
      const { data, error } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', tokenAddress)
        .order('timestamp_1min', { ascending: false })
        .limit(2);

      if (error || !data || data.length === 0) {
        return null;
      }

      const latest = data[0];
      const previous = data[1];

      let priceChange24h = 0;
      let priceChangePercent = 0;

      if (previous) {
        priceChange24h = latest.price - previous.price;
        priceChangePercent = (priceChange24h / previous.price) * 100;
      }

      const symbol = await this.getTokenSymbol(tokenAddress);

      return {
        tokenAddress,
        symbol,
        price: latest.price,
        priceChange24h,
        priceChangePercent,
        timestamp: latest.timestamp_1min,
        source: 'database',
        hasHistory: true
      };
    } catch (error) {
      console.error('데이터베이스 가격 조회 실패:', error);
      return null;
    }
  }

  // 토큰 심볼 조회 (캐시 사용)
  private async getTokenSymbol(tokenAddress: string): Promise<string> {
    // 기본 토큰 심볼 매핑
    const knownTokens: Record<string, string> = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK'
    };

    return knownTokens[tokenAddress] || tokenAddress.slice(0, 8);
  }

  // 🎯 통일된 가격 구독
  async subscribeToPrice(tokenAddress: string, callback: PriceUpdateCallback) {
    if (!this.priceSubscribers.has(tokenAddress)) {
      this.priceSubscribers.set(tokenAddress, new Set());
      await this.setupPriceChannel(tokenAddress);
    }

    this.priceSubscribers.get(tokenAddress)!.add(callback);

    // 캐시된 데이터 즉시 전달
    const cached = this.priceCache.get(tokenAddress);
    if (cached) {
      callback(cached);
    } else {
      // 캐시가 없으면 즉시 가격 조회
      const priceData = await this.fetchUnifiedPrice(tokenAddress);
      if (priceData) {
        this.priceCache.set(tokenAddress, priceData);
        callback(priceData);
      }
    }

    // 구독 해제 함수 반환
    return () => {
      const subscribers = this.priceSubscribers.get(tokenAddress);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.cleanupPriceChannel(tokenAddress);
        }
      }
    };
  }

  // 🎯 통일된 차트 데이터 구독
  async subscribeToChart(tokenAddress: string, callback: ChartUpdateCallback) {
    if (!this.chartSubscribers.has(tokenAddress)) {
      this.chartSubscribers.set(tokenAddress, new Set());
    }

    this.chartSubscribers.get(tokenAddress)!.add(callback);

    // 캐시된 차트 데이터 즉시 전달
    const cached = this.chartCache.get(tokenAddress);
    if (cached) {
      callback(cached);
    }

    // 차트 데이터 로드
    await this.loadUnifiedChartData(tokenAddress);

    return () => {
      const subscribers = this.chartSubscribers.get(tokenAddress);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }

  // 가격 채널 설정
  private async setupPriceChannel(tokenAddress: string) {
    const channel = supabase
      .channel(`unified_price:${tokenAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_price_history',
          filter: `token_address=eq.${tokenAddress}`
        },
        (payload) => {
          this.handleDatabaseUpdate(tokenAddress, payload.new);
        }
      )
      .on(
        'broadcast',
        { event: 'price_update' },
        (payload) => {
          this.handleRealtimeUpdate(tokenAddress, payload.payload);
        }
      )
      .subscribe();

    this.channels.set(tokenAddress, channel);

    // 1분마다 실시간 가격 업데이트
    const interval = setInterval(async () => {
      const priceData = await this.fetchUnifiedPrice(tokenAddress);
      if (priceData) {
        this.priceCache.set(tokenAddress, priceData);
        this.notifyPriceSubscribers(tokenAddress, priceData);
      }
    }, 60 * 1000);

    this.updateIntervals.set(tokenAddress, interval);
  }

  // 데이터베이스 업데이트 처리
  private handleDatabaseUpdate(tokenAddress: string, data: Record<string, unknown>) {
    // 새로운 OHLCV 데이터가 추가되면 차트 업데이트
    this.appendToChart(tokenAddress, data);
    
    // 가격 데이터도 업데이트
    this.fetchUnifiedPrice(tokenAddress).then(priceData => {
      if (priceData) {
        this.priceCache.set(tokenAddress, priceData);
        this.notifyPriceSubscribers(tokenAddress, priceData);
      }
    });
  }

  // 실시간 업데이트 처리
  private handleRealtimeUpdate(tokenAddress: string, data: Record<string, unknown>) {
    const cached = this.priceCache.get(tokenAddress);
    if (cached) {
      const updated = { ...cached, ...data };
      this.priceCache.set(tokenAddress, updated);
      this.notifyPriceSubscribers(tokenAddress, updated);
    }
  }

  // 통일된 차트 데이터 로드
  private async loadUnifiedChartData(tokenAddress: string) {
    try {
      // 1. 클라이언트 캐시 확인
      await clientCache.init();
      const cached = await clientCache.get(tokenAddress);
      
      if (cached && cached.chartData.length > 0) {
        const chartData = this.convertToUnifiedFormat(cached.chartData);
        this.chartCache.set(tokenAddress, chartData);
        this.notifyChartSubscribers(tokenAddress, chartData);
        return;
      }

      // 2. 데이터베이스에서 OHLCV 데이터 조회
      const { data, error } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', tokenAddress)
        .order('timestamp_1min', { ascending: true })
        .limit(60); // 1시간 (1분 * 60 = 1시간)

      if (error) {
        throw error;
      }

      const chartData = this.convertDatabaseToChart(data || []);
      this.chartCache.set(tokenAddress, chartData);
      this.notifyChartSubscribers(tokenAddress, chartData);

      // 3. 클라이언트 캐시에 저장
      if (chartData.length > 0) {
        await clientCache.set(tokenAddress, chartData);
      }
    } catch (error) {
      console.error('통일된 차트 데이터 로드 실패:', error);
    }
  }

  // 데이터베이스 형식을 차트 형식으로 변환
  private convertDatabaseToChart(data: Record<string, unknown>[]): UnifiedChartPoint[] {
    return data.map(item => {
      const date = new Date(item.timestamp_1min);
      return {
        timestamp: date.getTime(),
        open: item.open_price,
        high: item.high_price,
        low: item.low_price,
        close: item.close_price,
        price: item.close_price,
        time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        fullTime: date.toLocaleString('ko-KR', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    });
  }

  // 기존 형식을 통일된 형식으로 변환
  private convertToUnifiedFormat(data: Record<string, unknown>[]): UnifiedChartPoint[] {
    return data.map(item => ({
      timestamp: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.price,
      price: item.price,
      time: item.time,
      fullTime: item.fullTime
    }));
  }

  // 차트에 새 데이터 추가
  private appendToChart(tokenAddress: string, newData: Record<string, unknown>) {
    const existing = this.chartCache.get(tokenAddress) || [];
    const newPoint = this.convertDatabaseToChart([newData])[0];
    
    // 중복 제거 및 최대 60개 유지 (1시간)
    const updated = [...existing, newPoint]
      .filter((item, index, self) => 
        index === self.findIndex(t => t.timestamp === item.timestamp)
      )
      .slice(-60);
    
    this.chartCache.set(tokenAddress, updated);
    this.notifyChartSubscribers(tokenAddress, updated);
  }

  // 구독자 알림
  private notifyPriceSubscribers(tokenAddress: string, data: UnifiedPriceData) {
    const subscribers = this.priceSubscribers.get(tokenAddress);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  private notifyChartSubscribers(tokenAddress: string, data: UnifiedChartPoint[]) {
    const subscribers = this.chartSubscribers.get(tokenAddress);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  // 채널 정리
  private cleanupPriceChannel(tokenAddress: string) {
    const channel = this.channels.get(tokenAddress);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(tokenAddress);
    }

    const interval = this.updateIntervals.get(tokenAddress);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(tokenAddress);
    }

    this.priceSubscribers.delete(tokenAddress);
    this.priceCache.delete(tokenAddress);
  }

  // 🎯 Jupiter API 기반 가격 데이터베이스 동기화
  async syncPriceToDatabase(tokenAddress: string): Promise<boolean> {
    try {
      const priceData = await this.fetchUnifiedPrice(tokenAddress);
      if (!priceData) {
        return false;
      }

      // 현재 시간을 1분 단위로 정규화
      const now = new Date();
      now.setSeconds(0, 0);
      const timestamp1min = now.toISOString();

      // 기존 데이터 확인
      const { data: existing } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', tokenAddress)
        .eq('timestamp_1min', timestamp1min)
        .single();

      if (existing) {
        // 기존 데이터 업데이트 (OHLC 업데이트)
        const updated = {
          price: priceData.price,
          close_price: priceData.price,
          high_price: Math.max(existing.high_price, priceData.price),
          low_price: Math.min(existing.low_price, priceData.price)
        };

        await supabase
          .from('token_price_history')
          .update(updated)
          .eq('id', existing.id);
      } else {
        // 새 데이터 삽입
        await supabase
          .from('token_price_history')
          .insert({
            token_address: tokenAddress,
            price: priceData.price,
            open_price: priceData.price,
            high_price: priceData.price,
            low_price: priceData.price,
            close_price: priceData.price,
            timestamp_1min,
            volume: 0
          });
      }

      return true;
    } catch (error) {
      console.error('가격 데이터베이스 동기화 실패:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const unifiedPriceManager = new UnifiedPriceManager();