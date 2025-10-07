'use client';

export type ChartDataPoint = {
  timestamp: number;
  price: number;
};

export type TimePeriod = '1H' | '1D' | '1W' | '1M' | 'All';

/**
 * Fetch token price chart data (using API route)
 */
export async function fetchTokenChart(
  tokenAddress: string,
  period: TimePeriod = '1D'
): Promise<ChartDataPoint[]> {
  try {
    
    const response = await fetch(
      `/api/chart?token=${encodeURIComponent(tokenAddress)}&period=${period}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Invalid API response');
    }

    return result.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch current token price (not implemented - add if needed)
 */
export async function fetchTokenPrice(tokenAddress: string): Promise<number> {
  // Current price can be retrieved from the last point of chart data
  try {
    const chartData = await fetchTokenChart(tokenAddress, '1D');
    if (chartData.length > 0) {
      return chartData[chartData.length - 1].price;
    }
    throw new Error('No price data available');
  } catch (error) {
    throw error;
  }
}

/**
 * Generate fallback dummy chart data
 */
export function generateFallbackChartData(
  period: TimePeriod = '1D',
  basePrice: number = 45
): ChartDataPoint[] {
  const dataPoints = period === '1H' ? 24 : period === '1D' ? 24 : 50;
  const data: ChartDataPoint[] = [];
  let price = basePrice;
  const now = Date.now();
  const interval = period === '1H' ? 60 * 1000 :
                  period === '1D' ? 60 * 60 * 1000 :
                  24 * 60 * 60 * 1000;

  for (let i = dataPoints - 1; i >= 0; i--) {
    // Random price fluctuation (-2% ~ +2%)
    const change = (Math.random() - 0.5) * 0.04;
    price = price * (1 + change);

    data.push({
      timestamp: now - (i * interval),
      price: price
    });
  }

  return data;
}

/**
 * Generate simple price-based chart data (using Jupiter API)
 */
export async function fetchSimpleTokenPrice(tokenAddress: string): Promise<number | null> {
  try {
    // Use Jupiter Price API v2
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && data.data[tokenAddress]) {
      const price = data.data[tokenAddress].price;
      return price;
    }

    throw new Error('Price data not found');
  } catch {
    return null;
  }
}

/**
 * Generate simulated chart data based on current price
 */
export function generateSimulatedChartData(
  currentPrice: number,
  period: TimePeriod = '1D'
): ChartDataPoint[] {
  const now = Date.now();
  let dataPoints = 24;
  let interval = 60 * 60 * 1000; // 1 hour
  let volatility = 0.015; // 1.5% volatility

  switch (period) {
    case '1H':
      dataPoints = 12;
      interval = 5 * 60 * 1000; // 5 minutes
      volatility = 0.005; // 0.5%
      break;
    case '1D':
      dataPoints = 24;
      interval = 60 * 60 * 1000; // 1 hour
      volatility = 0.015; // 1.5%
      break;
    case '1W':
      dataPoints = 28;
      interval = 6 * 60 * 60 * 1000; // 6 hours
      volatility = 0.03; // 3%
      break;
    case '1M':
      dataPoints = 30;
      interval = 24 * 60 * 60 * 1000; // 1 day
      volatility = 0.05; // 5%
      break;
    case 'All':
      dataPoints = 50;
      interval = 7 * 24 * 60 * 60 * 1000; // 1 week
      volatility = 0.08; // 8%
      break;
  }

  const data: ChartDataPoint[] = [];
  let price = currentPrice;

  // Simulate from past to present
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = now - (i * interval);

    if (i === 0) {
      // Last point is current price
      price = currentPrice;
    } else {
      // Simulate past price with random walk
      const randomChange = (Math.random() - 0.5) * volatility * 2;
      const trend = i / dataPoints * 0.02; // Slight upward trend
      price = price * (1 - randomChange - trend);

      // Keep price within 50%~150% of current price
      price = Math.max(price, currentPrice * 0.5);
      price = Math.min(price, currentPrice * 1.5);
    }

    data.push({
      timestamp,
      price: Math.max(price, 0.0001) // Ensure minimum value
    });
  }

  return data.reverse(); // Sort in chronological order
}

/**
 * Fetch token chart data with fallback (improved)
 */
export async function fetchTokenChartWithFallback(
  tokenAddress: string,
  period: TimePeriod = '1D'
): Promise<ChartDataPoint[]> {
  try {

    // 1st attempt: Try GeckoTerminal API
    try {
      const response = await fetchTokenChart(tokenAddress, period);
      if (response && response.length > 0) {
        return response;
      }
    } catch {
    }

    // 2nd attempt: Simulation based on Jupiter price
    const currentPrice = await fetchSimpleTokenPrice(tokenAddress);
    if (currentPrice) {
      return generateSimulatedChartData(currentPrice, period);
    }

    // 3rd attempt: Complete fallback (simulation with default price)
    const fallbackPrice = tokenAddress === 'So11111111111111111111111111111111111111112' ? 200 : 1;
    return generateSimulatedChartData(fallbackPrice, period);

  } catch (error) {
    throw error;
  }
}

export default {
  fetchTokenChart,
  fetchTokenPrice,
  generateFallbackChartData,
  fetchSimpleTokenPrice,
  generateSimulatedChartData,
  fetchTokenChartWithFallback,
}; 