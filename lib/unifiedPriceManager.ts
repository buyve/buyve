import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { clientCache } from '@/lib/clientCache';
import { chatRoomTokenCollector } from '@/lib/chatRoomTokenCollector';
import { DEFAULT_TOKENS } from '@/lib/tokenPriceService';

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

  // 🎯 Jupiter API를 사용한 통일된 가격 조회
  // Jupiter Lite API v3 엔드포인트에서 실시간 시세를 받아오고,
  // 24시간 전 히스토리를 Supabase에서 끌어와 상승·하락률을 계산한 뒤
  // 실패 시 DB 데이터로 폴백합니다.
  private async fetchUnifiedPrice(tokenAddress: string): Promise<UnifiedPriceData | null> {
    try {
      // 1. Jupiter Lite API v3에서 실시간 시세 조회
      const response = await fetch(
        `https://lite-api.jup.ag/price/v3?ids=${tokenAddress}`
      );

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const data = await response.json();
      const priceInfo = data[tokenAddress];

      if (!priceInfo || !priceInfo.usdPrice) {
        throw new Error('Token not found in Jupiter API');
      }

      // 2. Supabase에서 24시간 전 히스토리를 끌어와 상승·하락률 계산
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

      const currentPrice = parseFloat(priceInfo.usdPrice);

      if (history && history.length > 0) {
        hasHistory = true;
        const price24hAgo = history[0].open_price;
        priceChange24h = currentPrice - price24hAgo;
        priceChangePercent = (priceChange24h / price24hAgo) * 100;
      }

      // 3. 토큰 심볼 조회 (캐시 또는 Jupiter API)
      const symbol = await this.getTokenSymbol(tokenAddress);

      const unifiedData: UnifiedPriceData = {
        tokenAddress,
        symbol,
        price: currentPrice,
        priceChange24h,
        priceChangePercent,
        timestamp: new Date().toISOString(),
        source: 'jupiter',
        hasHistory
      };

      return unifiedData;
    } catch (error) {
      console.error('통일된 가격 조회 실패:', error);

      // 4. 실패 시 DB 데이터로 폴백
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
  // 클라이언트가 subscribeToPrice를 호출하면 Supabase 채널 연결과
  // 캐시된 최신 데이터 전달이 이뤄지고, 캐시가 비어 있으면 즉시 Jupiter 호출로 채웁니다.
  // 🚀 개선: 토큰당 하나의 채널만 생성하고 여러 구독자가 공유 (싱글톤 패턴)
  async subscribeToPrice(tokenAddress: string, callback: PriceUpdateCallback) {
    // 🎯 구독자 Set이 없으면 생성 (채널도 함께 생성)
    if (!this.priceSubscribers.has(tokenAddress)) {
      this.priceSubscribers.set(tokenAddress, new Set());
      // 첫 구독자만 채널 생성 (이후 구독자는 기존 채널 재사용)
      await this.setupPriceChannel(tokenAddress);
      console.log(`✅ [Singleton] First subscriber for ${tokenAddress} - Channel created`);
    } else {
      console.log(`♻️ [Singleton] Reusing existing channel for ${tokenAddress} (${this.priceSubscribers.get(tokenAddress)!.size} subscribers)`);
    }

    // 구독자 추가
    this.priceSubscribers.get(tokenAddress)!.add(callback);

    // 캐시된 최신 데이터 전달
    const cached = this.priceCache.get(tokenAddress);
    if (cached) {
      callback(cached);
    } else {
      // 캐시가 비어 있으면 즉시 Jupiter 호출로 채움
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
        console.log(`🔕 [Unsubscribe] ${tokenAddress}: ${subscribers.size} subscribers remaining`);

        // 🎯 마지막 구독자가 떠날 때만 채널 정리 (30초 딜레이로 재구독 대비)
        if (subscribers.size === 0) {
          console.log(`⏳ [Cleanup Scheduled] ${tokenAddress} - Will cleanup in 30s if no new subscribers`);
          setTimeout(() => {
            // 30초 후에도 여전히 구독자가 없으면 정리
            const currentSubscribers = this.priceSubscribers.get(tokenAddress);
            if (currentSubscribers && currentSubscribers.size === 0) {
              console.log(`🧹 [Cleanup] ${tokenAddress} - No subscribers, cleaning up channel`);
              this.cleanupPriceChannel(tokenAddress);
            } else {
              console.log(`↩️ [Cleanup Cancelled] ${tokenAddress} - New subscribers joined`);
            }
          }, 30000);
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

  // Supabase Realtime 채널 설정
  // Supabase Realtime 채널을 구독하면서 1분 주기로 fetchUnifiedPrice를 재호출하여
  // 캐시를 갱신하고, 프런트 구독자에게 브로드캐스트합니다.
  // 🚀 개선: 이미 채널이 존재하면 생성하지 않음 (중복 방지)
  private async setupPriceChannel(tokenAddress: string) {
    // 🎯 중복 방지: 이미 채널이 있으면 생성하지 않음
    if (this.channels.has(tokenAddress)) {
      console.log(`♻️ [Channel Reuse] ${tokenAddress} - Channel already exists`);
      return;
    }

    console.log(`🔔 [Channel Create] Setting up Realtime channel for ${tokenAddress}`);

    const channel = supabase
      .channel(`unified_price:${tokenAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT와 UPDATE 모두 감지
          schema: 'public',
          table: 'token_price_history',
          filter: `token_address=eq.${tokenAddress}`
        },
        (payload: any) => {
          console.log(`🔥 DB Update detected for ${tokenAddress}:`, payload.eventType);
          // Supabase INSERT/UPDATE 이벤트가 발생하면 차트와 가격 업데이트
          this.handleDatabaseUpdate(tokenAddress, payload.new);
        }
      )
      .on(
        'broadcast',
        { event: 'price_update' },
        (payload: any) => {
          console.log(`📡 Broadcast received for ${tokenAddress}`);
          this.handleRealtimeUpdate(tokenAddress, payload.payload);
        }
      )
      .subscribe((status) => {
        console.log(`✅ Channel subscription status for ${tokenAddress}:`, status);
      });

    this.channels.set(tokenAddress, channel);

    // 1분 주기로 fetchUnifiedPrice를 재호출하여 캐시를 갱신하고, 프런트 구독자에게 브로드캐스트
    const interval = setInterval(async () => {
      console.log(`⏰ [Interval] 1-minute update for ${tokenAddress} (${this.priceSubscribers.get(tokenAddress)?.size || 0} subscribers)`);
      const priceData = await this.fetchUnifiedPrice(tokenAddress);
      if (priceData) {
        this.priceCache.set(tokenAddress, priceData);
        this.notifyPriceSubscribers(tokenAddress, priceData);

        // 브로드캐스트로 다른 클라이언트에도 전파
        await channel.send({
          type: 'broadcast',
          event: 'price_update',
          payload: priceData
        });
      }
    }, 60 * 1000);

    this.updateIntervals.set(tokenAddress, interval);
    console.log(`✅ [Channel Ready] ${tokenAddress} - Channel and interval created`);
  }

  // 데이터베이스 업데이트 처리
  // Supabase INSERT 이벤트가 발생하면 다시 Jupiter 쿼리로 값을 확정한 뒤 모든 구독자에게 재전파
  private handleDatabaseUpdate(tokenAddress: string, data: Record<string, unknown>) {
    console.log(`💾 handleDatabaseUpdate called for ${tokenAddress}:`, data);

    // 새로운 OHLCV 데이터가 추가되면 차트 업데이트
    this.appendToChart(tokenAddress, data);

    // 가격 데이터도 Jupiter 쿼리로 재확정하여 업데이트
    this.fetchUnifiedPrice(tokenAddress).then(priceData => {
      if (priceData) {
        console.log(`✅ Price updated for ${tokenAddress}:`, priceData.price);
        this.priceCache.set(tokenAddress, priceData);
        this.notifyPriceSubscribers(tokenAddress, priceData);
      }
    });
  }

  // 실시간 브로드캐스트 업데이트 처리
  // 서버가 브로드캐스트한 값이 있을 때 캐시와 구독자에게 즉시 반영해 사용자 화면을 갱신합니다.
  private handleRealtimeUpdate(tokenAddress: string, data: Record<string, unknown>) {
    const cached = this.priceCache.get(tokenAddress);
    if (cached) {
      const updated = { ...cached, ...data };
      this.priceCache.set(tokenAddress, updated);
      // 구독자에게 즉시 반영해 사용자 화면을 갱신
      this.notifyPriceSubscribers(tokenAddress, updated);
    }
  }

  // 통일된 차트 데이터 로드
  // 차트 데이터 역시 clientCache 조회 후 없으면 Supabase에서 60분치를 읽어 변환해 전달하며,
  // 새 레코드가 들어오면 appendToChart로 최신 봉만 유지합니다.
  private async loadUnifiedChartData(tokenAddress: string) {
    try {
      // 1. clientCache 조회
      await clientCache.init();
      const cached = await clientCache.get(tokenAddress);

      if (cached && cached.chartData && cached.chartData.length > 0) {
        const chartData = this.convertToUnifiedFormat(cached.chartData as any[]);
        this.chartCache.set(tokenAddress, chartData);
        this.notifyChartSubscribers(tokenAddress, chartData);
        return;
      }

      // 2. 없으면 Supabase에서 60분치를 읽어 변환해 전달
      const { data, error } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', tokenAddress)
        .order('timestamp_1min', { ascending: true })
        .limit(60); // 60분치 (1분 * 60 = 1시간)

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
  private convertDatabaseToChart(data: any[]): UnifiedChartPoint[] {
    return data.map(item => {
      const date = new Date(item.timestamp_1min);
      return {
        timestamp: date.getTime(),
        open: item.open_price as number,
        high: item.high_price as number,
        low: item.low_price as number,
        close: item.close_price as number,
        price: item.close_price as number,
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
  private convertToUnifiedFormat(data: any[]): UnifiedChartPoint[] {
    return data.map(item => ({
      timestamp: item.timestamp as number,
      open: item.open as number,
      high: item.high as number,
      low: item.low as number,
      close: item.price as number,
      price: item.price as number,
      time: item.time as string,
      fullTime: item.fullTime as string
    }));
  }

  // 차트에 새 데이터 추가
  // 새 레코드가 들어오면 appendToChart로 최신 봉만 유지합니다.
  private appendToChart(tokenAddress: string, newData: Record<string, unknown>) {
    console.log(`📊 appendToChart called for ${tokenAddress}`);
    const existing = this.chartCache.get(tokenAddress) || [];
    const newPoint = this.convertDatabaseToChart([newData])[0];

    // 중복 제거 및 최대 60개 유지하여 최신 봉만 유지
    const updated = [...existing, newPoint]
      .filter((item, index, self) =>
        index === self.findIndex(t => t.timestamp === item.timestamp)
      )
      .slice(-60);

    console.log(`📈 Chart updated: ${existing.length} -> ${updated.length} points`);
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
  // 🚀 개선: 정리 전에 구독자 수 확인 (안전장치)
  private cleanupPriceChannel(tokenAddress: string) {
    // 🎯 안전장치: 구독자가 있으면 정리하지 않음
    const subscribers = this.priceSubscribers.get(tokenAddress);
    if (subscribers && subscribers.size > 0) {
      console.log(`⚠️ [Cleanup Aborted] ${tokenAddress} - Still has ${subscribers.size} subscribers`);
      return;
    }

    console.log(`🧹 [Cleanup Start] ${tokenAddress}`);

    const channel = this.channels.get(tokenAddress);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(tokenAddress);
      console.log(`  ✓ Channel unsubscribed`);
    }

    const interval = this.updateIntervals.get(tokenAddress);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(tokenAddress);
      console.log(`  ✓ Interval cleared`);
    }

    this.priceSubscribers.delete(tokenAddress);
    this.priceCache.delete(tokenAddress);
    console.log(`✅ [Cleanup Complete] ${tokenAddress} - All resources freed`);
  }

  // 🎯 DB에 등록된 모든 코인 가격을 일괄 구독
  async subscribeToAllRegisteredTokens(callback: (tokenAddress: string, data: UnifiedPriceData) => void) {
    try {
      // 1. DB에 등록된 모든 토큰 주소 수집
      const chatRoomTokens = await chatRoomTokenCollector.getAllChatRoomTokens();
      const allTokens = [...DEFAULT_TOKENS, ...chatRoomTokens.filter(token => !DEFAULT_TOKENS.includes(token))];

      console.log(`🔔 ${allTokens.length}개 토큰 일괄 구독 시작:`, allTokens.slice(0, 5), '...');

      // 2. 각 토큰에 대해 구독 설정
      const unsubscribeFunctions = await Promise.all(
        allTokens.map(tokenAddress =>
          this.subscribeToPrice(tokenAddress, (data) => callback(tokenAddress, data))
        )
      );

      // 3. 전체 구독 해제 함수 반환
      return () => {
        console.log('🔕 모든 토큰 구독 해제');
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      };
    } catch (error) {
      console.error('모든 토큰 구독 실패:', error);
      return () => {};
    }
  }

  // 🎯 특정 토큰 목록만 일괄 구독
  async subscribeToTokenList(
    tokenAddresses: string[],
    callback: (tokenAddress: string, data: UnifiedPriceData) => void
  ) {
    try {
      console.log(`🔔 ${tokenAddresses.length}개 토큰 구독 시작`);

      // 각 토큰에 대해 구독 설정
      const unsubscribeFunctions = await Promise.all(
        tokenAddresses.map(tokenAddress =>
          this.subscribeToPrice(tokenAddress, (data) => callback(tokenAddress, data))
        )
      );

      // 전체 구독 해제 함수 반환
      return () => {
        console.log('🔕 토큰 목록 구독 해제');
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      };
    } catch (error) {
      console.error('토큰 목록 구독 실패:', error);
      return () => {};
    }
  }

  // 🎯 현재 구독 중인 모든 토큰 목록 조회
  getSubscribedTokens(): string[] {
    return Array.from(this.priceSubscribers.keys());
  }

  // 🎯 특정 토큰의 캐시된 가격 데이터 조회
  getCachedPrice(tokenAddress: string): UnifiedPriceData | null {
    return this.priceCache.get(tokenAddress) || null;
  }

  // 🎯 모든 캐시된 가격 데이터 조회
  getAllCachedPrices(): Map<string, UnifiedPriceData> {
    return new Map(this.priceCache);
  }

  // 🎯 Jupiter API 기반 가격 데이터베이스 동기화
  // PostgreSQL 함수를 사용하여 원자적으로 처리합니다.
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

      // PostgreSQL 함수를 사용한 원자적 UPSERT
      const { error } = await supabase.rpc('upsert_token_price_ohlc', {
        p_token_address: tokenAddress,
        p_price: priceData.price,
        p_timestamp_1min: timestamp1min,
        p_volume: 0
      });

      if (error) {
        console.error('가격 데이터베이스 동기화 실패:', error);
        return false;
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