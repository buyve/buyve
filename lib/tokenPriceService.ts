import { supabase } from './supabase';
import type { Database } from './supabase';

type TokenPriceHistoryRow = Database['public']['Tables']['token_price_history']['Row'];
type TokenPriceHistoryInsert = Database['public']['Tables']['token_price_history']['Insert'];

// Token price history management service
export class TokenPriceService {

  /**
   * Normalize time to 1-minute intervals
   */
  private normalize1MinTimestamp(date: Date): string {
    const normalized = new Date(date);
    normalized.setSeconds(0, 0); // Set seconds and milliseconds to 0
    return normalized.toISOString();
  }

  /**
   * Fetch real-time price from Jupiter API
   */
  private async fetchJupiterPrice(tokenAddress: string): Promise<number | null> {
    try {
      const response = await fetch(
        `https://lite-api.jup.ag/price/v3?ids=${tokenAddress}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const tokenData = data[tokenAddress];

      if (tokenData && tokenData.usdPrice) {
        return parseFloat(tokenData.usdPrice);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Save or update token's current price in database
   */
  async updateTokenPrice(tokenAddress: string): Promise<boolean> {
    try {

      // Jupiter API에서 현재 가격 조회
      const currentPrice = await this.fetchJupiterPrice(tokenAddress);
      if (!currentPrice) {
        return false;
      }

      // 현재 시간을 1분 단위로 정규화
      const timestamp1min = this.normalize1MinTimestamp(new Date());

      // 기존 데이터가 있는지 확인
      const { data: existingData } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', tokenAddress)
        .eq('timestamp_1min', timestamp1min)
        .single();

      if (existingData) {
        // 기존 데이터가 있으면 OHLC 업데이트
        const updatedData = {
          price: currentPrice,
          close_price: currentPrice,
          high_price: Math.max(existingData.high_price, currentPrice),
          low_price: Math.min(existingData.low_price, currentPrice),
        };

        const { error } = await supabase
          .from('token_price_history')
          .update(updatedData)
          .eq('id', existingData.id);

        if (error) {
          return false;
        }

      } else {
        // 새로운 데이터 삽입
        const newData: TokenPriceHistoryInsert = {
          token_address: tokenAddress,
          price: currentPrice,
          open_price: currentPrice,
          high_price: currentPrice,
          low_price: currentPrice,
          close_price: currentPrice,
          timestamp_1min: timestamp1min,
          volume: 0,
        };

        const { error } = await supabase
          .from('token_price_history')
          .insert(newData);

        if (error) {
          return false;
        }

      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve token price history (maximum 60 entries)
   */
  async getTokenPriceHistory(tokenAddress: string): Promise<TokenPriceHistoryRow[]> {
    try {
      const { data, error } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_address', tokenAddress)
        .order('timestamp_1min', { ascending: false })
        .limit(60);

      if (error) {
        return [];
      }

      // Sort chronologically (oldest first)
      return (data || []).reverse();
    } catch {
      return [];
    }
  }

  /**
   * Retrieve token's latest price
   */
  async getLatestTokenPrice(tokenAddress: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('token_price_history')
        .select('price')
        .eq('token_address', tokenAddress)
        .order('timestamp_1min', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // Call real-time API if no data in DB
        return await this.fetchJupiterPrice(tokenAddress);
      }

      return data.price;
    } catch {
      return null;
    }
  }

  /**
   * Fetch prices for multiple tokens in batch
   */
  private async fetchBatchPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    try {
      const response = await fetch(
        `https://lite-api.jup.ag/price/v3?ids=${tokenAddresses.join(',')}`
      );

      if (!response.ok) {
        return priceMap;
      }

      const data = await response.json();

      for (const [address, tokenData] of Object.entries(data || {})) {
        if (tokenData && typeof tokenData === 'object' && 'usdPrice' in tokenData) {
          const price = parseFloat(String(tokenData.usdPrice));
          if (!isNaN(price)) {
            priceMap.set(address, price);
          }
        }
      }

      return priceMap;
    } catch {
      return priceMap;
    }
  }

  /**
   * Update prices for multiple tokens using batch UPSERT (using Supabase built-in feature)
   * Improvement: Minimize Jupiter API calls with DB-based cache (30s TTL)
   */
  async updateMultipleTokenPricesBatch(tokenAddresses: string[]): Promise<boolean> {
    if (tokenAddresses.length === 0) return true;

    try {
      // 0. Check DB cache (verify data within last 30 seconds)
      const { data: recentData } = await supabase
        .from('token_price_history')
        .select('token_address, price, timestamp_1min')
        .in('token_address', tokenAddresses)
        .gte('timestamp_1min', new Date(Date.now() - 30000).toISOString()) // Within 30 seconds
        .order('timestamp_1min', { ascending: false });

      // Exclude tokens with recent data
      const recentTokens = new Set(recentData?.map(d => d.token_address) || []);
      const needUpdateTokens = tokenAddresses.filter(t => !recentTokens.has(t));

      // Skip Jupiter call if all tokens are up-to-date
      if (needUpdateTokens.length === 0) {
        return true;
      }

      // 1. Fetch price data in batch for cache-missed tokens only
      const priceMap = await this.fetchBatchPrices(needUpdateTokens);
      if (priceMap.size === 0) {
        return false;
      }

      // 2. Normalize current time to 1-minute intervals
      const timestamp1min = this.normalize1MinTimestamp(new Date());

      // 3. Check existing data (only for cache-missed tokens)
      const { data: existingData } = await supabase
        .from('token_price_history')
        .select('*')
        .in('token_address', needUpdateTokens)
        .eq('timestamp_1min', timestamp1min);

      const existingMap = new Map(
        (existingData || []).map(item => [item.token_address, item])
      );

      // 4. Prepare batch UPSERT data
      const upsertData: TokenPriceHistoryInsert[] = [];

      for (const [tokenAddress, currentPrice] of priceMap) {
        const existing = existingMap.get(tokenAddress);

        if (existing) {
          // For updating existing data - calculate OHLC
          const highPrice = Math.max(existing.high_price, currentPrice);
          const lowPrice = Math.min(existing.low_price, currentPrice);

          upsertData.push({
            token_address: tokenAddress,
            price: currentPrice,
            open_price: existing.open_price,
            high_price: highPrice,
            low_price: lowPrice,
            close_price: currentPrice,
            timestamp_1min: timestamp1min,
            volume: 0,
          });
        } else {
          // For inserting new data - all OHLC values are current price
          upsertData.push({
            token_address: tokenAddress,
            price: currentPrice,
            open_price: currentPrice,
            high_price: currentPrice,
            low_price: currentPrice,
            close_price: currentPrice,
            timestamp_1min: timestamp1min,
            volume: 0,
          });
        }
      }

      if (upsertData.length === 0) return true;

      // 5. Execute Supabase array upsert
      const { error } = await supabase
        .from('token_price_history')
        .upsert(upsertData, {
          onConflict: 'token_address,timestamp_1min',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Batch upsert error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Batch update error:', error);
      return false;
    }
  }

  /**
   * Update prices for multiple tokens in bulk (legacy approach - maintaining compatibility)
   */
  async updateMultipleTokenPrices(tokenAddresses: string[]): Promise<void> {
    const promises = tokenAddresses.map(address => this.updateTokenPrice(address));
    await Promise.allSettled(promises);
  }

  /**
   * Clean up old price data (auto-delete when exceeding 60 entries)
   */
  async cleanupOldPriceData(tokenAddress: string): Promise<void> {
    try {
      // Delete old data except latest 60 entries
      const { data: latestRecords } = await supabase
        .from('token_price_history')
        .select('id')
        .eq('token_address', tokenAddress)
        .order('timestamp_1min', { ascending: false })
        .limit(60);

      if (!latestRecords || latestRecords.length <= 60) {
        return; // No data to clean up
      }

      const keepIds = latestRecords.map(record => record.id);
      
      const { error } = await supabase
        .from('token_price_history')
        .delete()
        .eq('token_address', tokenAddress)
        .not('id', 'in', `(${keepIds.map(id => `'${id}'`).join(',')})`);

      if (error) {
      } else {
      }
    } catch {
    }
  }

  /**
   * Convert to chart data format
   */
  formatForChart(priceHistory: TokenPriceHistoryRow[]): Array<{
    timestamp: number;
    price: number;
    open: number;
    high: number;
    low: number;
    time: string;
    fullTime: string;
  }> {
    return priceHistory.map((record, index) => {
      const date = new Date(record.timestamp_1min);
      const timeLabel = date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });

      return {
        timestamp: date.getTime(),
        price: record.close_price,
        open: record.open_price,
        high: record.high_price,
        low: record.low_price,
        time: index % 10 === 0 ? timeLabel : '', // Display every 10 minutes
        fullTime: timeLabel,
      };
    });
  }
}

// Singleton instance
export const tokenPriceService = new TokenPriceService();

// Default token list
export const DEFAULT_TOKENS = [
  'So11111111111111111111111111111111111111112', // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
];

export default tokenPriceService; 