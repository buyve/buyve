import { NextResponse } from 'next/server';
import { getConfirmationStats } from '@/lib/transaction-confirmation';

export async function GET() {
  try {
    const stats = getConfirmationStats();
    
    if (!stats) {
      return NextResponse.json({
        success: true,
        message: 'No confirmation data available yet',
        stats: null
      });
    }
    
    // Calculate additional insights
    const insights = {
      preferredMethod: stats.websocket.successRate > stats.polling.successRate ? 'websocket' : 'polling',
      websocketReliability: (stats.websocket.successRate * 100).toFixed(1) + '%',
      pollingReliability: (stats.polling.successRate * 100).toFixed(1) + '%',
      avgConfirmationTime: {
        websocket: (stats.websocket.avgTime / 1000).toFixed(1) + 's',
        polling: (stats.polling.avgTime / 1000).toFixed(1) + 's'
      },
      rpcCallReduction: stats.websocket.count > 0 
        ? Math.round((1 - stats.websocket.avgAttempts / stats.polling.avgAttempts) * 100) + '%'
        : 'N/A'
    };
    
    return NextResponse.json({
      success: true,
      stats,
      insights,
      recommendation: stats.websocket.successRate > 0.8 
        ? 'WebSocket performing well, continue using hybrid approach'
        : 'WebSocket reliability low, consider increasing polling weight'
    });
  } catch (error) {
    console.error('Error fetching RPC stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RPC statistics' },
      { status: 500 }
    );
  }
}