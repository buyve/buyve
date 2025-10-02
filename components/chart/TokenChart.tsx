'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { unifiedPriceManager } from '@/lib/unifiedPriceManager';
import type { UnifiedChartPoint, UnifiedPriceData } from '@/lib/unifiedPriceManager';

interface TokenChartProps {
  tokenAddress?: string;
  className?: string;
}

export default function TokenChart({ tokenAddress, className = '' }: TokenChartProps) {
  const [chartData, setChartData] = useState<UnifiedChartPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // SOL 토큰 주소 (기본값)
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const targetToken = tokenAddress || SOL_MINT;

  useEffect(() => {
    if (!tokenAddress || targetToken === SOL_MINT) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // 🎯 unifiedPriceManager를 사용한 실시간 가격 구독
    const unsubscribePrice = unifiedPriceManager.subscribeToPrice(
      targetToken,
      (priceData: UnifiedPriceData) => {
        setCurrentPrice(priceData.price);
        setPriceChange(priceData.priceChangePercent);
      }
    );

    // 🎯 unifiedPriceManager를 사용한 차트 데이터 구독
    const unsubscribeChart = unifiedPriceManager.subscribeToChart(
      targetToken,
      (chartPoints: UnifiedChartPoint[]) => {
        setChartData(chartPoints);
        setIsLoading(false);
      }
    );

    // Cleanup
    return () => {
      Promise.resolve(unsubscribePrice).then(unsub => unsub());
      Promise.resolve(unsubscribeChart).then(unsub => unsub());
    };
  }, [targetToken, tokenAddress]);

  // 차트 Y축 도메인 계산
  const getYAxisDomain = () => {
    if (chartData.length === 0) return ['auto', 'auto'];

    const prices = chartData.map(d => d.open);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (chartData.length <= 2) {
      const priceRange = maxPrice - minPrice;
      const expandedPadding = priceRange > 0 ? priceRange * 0.5 : maxPrice * 0.1;

      return [
        Math.max(0, minPrice - expandedPadding).toFixed(8),
        (maxPrice + expandedPadding).toFixed(8)
      ];
    }

    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.01;

    return [
      (minPrice - padding).toFixed(6),
      (maxPrice + padding).toFixed(6)
    ];
  };

  const isPositive = priceChange >= 0;

  return (
    <div className={`rounded-lg px-3 pt-3 ${className}`} style={{ backgroundColor: 'oklch(0.2393 0 0)' }}>
      {/* 가격 정보 - 실시간 업데이트 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">
            {chartData.length > 0 && tokenAddress && targetToken !== SOL_MINT ? `$${currentPrice.toFixed(6)}` : '--'}
          </span>
          <span className={`text-sm font-medium ${
            chartData.length > 0 && tokenAddress && targetToken !== SOL_MINT ? (isPositive ? 'text-green-400' : 'text-red-400') : 'text-gray-400'
          }`}>
            {chartData.length > 0 && tokenAddress && targetToken !== SOL_MINT ? `${isPositive ? '+' : ''}${priceChange.toFixed(2)}%` : '--'}
          </span>
        </div>
      </div>

      {/* Recharts 차트 */}
      {chartData.length > 0 && !isLoading && tokenAddress && targetToken !== SOL_MINT ? (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 5, bottom: 20 }}
            >
              <XAxis
                dataKey="time"
                hide={true}
                type="category"
                axisLine={false}
                tickLine={false}
                tick={false}
                interval={chartData.length <= 2 ? 0 : "preserveStartEnd"}
              />
              <YAxis
                domain={getYAxisDomain()}
                hide={true}
              />
              <Line
                type="monotone"
                dataKey="open"
                stroke="oklch(0.75 0.183 55.934)"
                strokeWidth={chartData.length <= 2 ? 3 : 2}
                dot={chartData.length <= 2 ? { r: 6, stroke: 'oklch(0.75 0.183 55.934)', strokeWidth: 2, fill: '#ffffff' } : false}
                activeDot={{ r: 4, stroke: 'oklch(0.75 0.183 55.934)', strokeWidth: 2, fill: '#ffffff' }}
                connectNulls={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as UnifiedChartPoint;
                    const openPrice = data.open;

                    return (
                      <div className="bg-black/90 text-white border border-gray-600 rounded-lg shadow-xl p-3 text-xs backdrop-blur-sm">
                        <p className="font-medium text-gray-200 mb-1">TIME: {data.fullTime}</p>
                        <div className="space-y-1">
                          <p className="font-bold text-white text-sm">
                            Open: ${openPrice.toFixed(6)}
                          </p>
                          <p className="text-green-400 text-xs">
                            High: ${data.high.toFixed(6)}
                          </p>
                          <p className="text-red-400 text-xs">
                            Low: ${data.low.toFixed(6)}
                          </p>
                          <p className="text-blue-400 text-xs">
                            Close: ${data.close.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, strokeDasharray: '2,2' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
