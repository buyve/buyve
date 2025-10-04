/**
 * 🎯 unifiedPriceManager 사용 예시
 *
 * 이 파일은 참고용 예시입니다. 실제 구현 시 참고하세요.
 */

import { unifiedPriceManager } from '@/lib/unifiedPriceManager';
import type { UnifiedPriceData } from '@/lib/unifiedPriceManager';

// =======================================
// 예시 1: DB에 등록된 모든 코인 가격 구독
// =======================================
export function subscribeAllTokensExample() {
  const unsubscribe = unifiedPriceManager.subscribeToAllRegisteredTokens(
    (tokenAddress, priceData) => {
      // 여기서 UI 업데이트
      // 예: setTokenPrices(prev => ({ ...prev, [tokenAddress]: priceData }))
    }
  );

  // 컴포넌트 unmount 시 구독 해제
  return unsubscribe;
}

// =======================================
// 예시 2: 특정 토큰 목록만 구독
// =======================================
export function subscribeSelectedTokensExample() {
  const selectedTokens = [
    'So11111111111111111111111111111111111111112', // SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  ];

  const unsubscribe = unifiedPriceManager.subscribeToTokenList(
    selectedTokens,
    (tokenAddress, priceData) => {
      // Handle price updates
    }
  );

  return unsubscribe;
}

// =======================================
// 예시 3: 단일 토큰 구독
// =======================================
export async function subscribeSingleTokenExample() {
  const tokenAddress = 'So11111111111111111111111111111111111111112'; // SOL

  const unsubscribe = await unifiedPriceManager.subscribeToPrice(
    tokenAddress,
    (priceData) => {
      // Handle price updates
    }
  );

  return unsubscribe;
}

// =======================================
// 예시 4: 캐시된 데이터 조회 (즉시 반환)
// =======================================
export function getCachedPricesExample() {
  // 특정 토큰의 캐시된 가격
  const solPrice = unifiedPriceManager.getCachedPrice(
    'So11111111111111111111111111111111111111112'
  );

  // 모든 캐시된 가격
  const allPrices = unifiedPriceManager.getAllCachedPrices();
}

// =======================================
// 예시 5: 현재 구독 중인 토큰 목록 조회
// =======================================
export function getSubscribedTokensExample() {
  const subscribedTokens = unifiedPriceManager.getSubscribedTokens();
}

// =======================================
// 예시 6: React Hook으로 사용
// =======================================
import { useEffect, useState } from 'react';

export function useAllTokenPrices() {
  const [prices, setPrices] = useState<Map<string, UnifiedPriceData>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const subscribe = async () => {
      const unsubscribe = await unifiedPriceManager.subscribeToAllRegisteredTokens(
        (tokenAddress, priceData) => {
          if (mounted) {
            setPrices(prev => new Map(prev).set(tokenAddress, priceData));
          }
        }
      );

      if (mounted) {
        setLoading(false);
      }

      return unsubscribe;
    };

    const unsubscribePromise = subscribe();

    return () => {
      mounted = false;
      unsubscribePromise.then(unsubscribe => unsubscribe());
    };
  }, []);

  return { prices, loading };
}

// =======================================
// 예시 7: 차트 데이터도 함께 구독
// =======================================
import type { UnifiedChartPoint } from '@/lib/unifiedPriceManager';

export async function subscribeWithChartExample() {
  const tokenAddress = 'So11111111111111111111111111111111111111112';

  // 가격 구독
  const unsubscribePrice = await unifiedPriceManager.subscribeToPrice(
    tokenAddress,
    (priceData) => {
      // Handle real-time price updates
    }
  );

  // 차트 구독
  const unsubscribeChart = await unifiedPriceManager.subscribeToChart(
    tokenAddress,
    (chartData) => {
      // Handle chart data updates
      const latest = chartData[chartData.length - 1];
    }
  );

  // 구독 해제
  return () => {
    unsubscribePrice();
    unsubscribeChart();
  };
}

// =======================================
// 예시 8: 실시간 가격 목록 컴포넌트
// =======================================
export function TokenPriceList() {
  const { prices, loading } = useAllTokenPrices();

  if (loading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div>
      <h2>실시간 토큰 가격 ({prices.size}개)</h2>
      {Array.from(prices.entries()).map(([address, data]) => (
        <div key={address}>
          <span>{data.symbol}</span>
          <span>${data.price.toFixed(6)}</span>
          <span className={data.priceChangePercent >= 0 ? 'text-green' : 'text-red'}>
            {data.priceChangePercent.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
