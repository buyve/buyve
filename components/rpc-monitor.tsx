'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Activity, Zap, Clock, TrendingDown } from 'lucide-react';

interface RpcStats {
  stats: {
    total: number;
    websocket: {
      count: number;
      successRate: number;
      avgTime: number;
      avgAttempts: number;
    };
    polling: {
      count: number;
      successRate: number;
      avgTime: number;
      avgAttempts: number;
    };
  };
  insights: {
    preferredMethod: string;
    websocketReliability: string;
    pollingReliability: string;
    avgConfirmationTime: {
      websocket: string;
      polling: string;
    };
    rpcCallReduction: string;
  };
  recommendation: string;
}

export function RpcMonitor() {
  const [stats, setStats] = useState<RpcStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/rpc-stats');
        const data = await response.json();
        if (data.success && data.stats) {
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch RPC stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            RPC Performance Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {loading ? 'Loading stats...' : 'No data available yet'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { stats: s, insights, recommendation } = stats;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          RPC Performance Monitor
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Total confirmations: {s.total}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WebSocket Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">WebSocket</span>
              <Badge variant="outline" className="text-xs">
                {s.websocket.count} requests
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {insights.websocketReliability} success
            </span>
          </div>
          <Progress value={s.websocket.successRate * 100} className="h-2" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Avg Time:</span>{' '}
              {insights.avgConfirmationTime.websocket}
            </div>
            <div>
              <span className="text-muted-foreground">Avg Attempts:</span>{' '}
              {s.websocket.avgAttempts.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Polling Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="font-medium">Polling</span>
              <Badge variant="outline" className="text-xs">
                {s.polling.count} requests
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {insights.pollingReliability} success
            </span>
          </div>
          <Progress value={s.polling.successRate * 100} className="h-2" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Avg Time:</span>{' '}
              {insights.avgConfirmationTime.polling}
            </div>
            <div>
              <span className="text-muted-foreground">Avg Attempts:</span>{' '}
              {s.polling.avgAttempts.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Preferred Method:</span>
            <Badge>{insights.preferredMethod}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">RPC Call Reduction:</span>
            <span className="flex items-center gap-1">
              {insights.rpcCallReduction !== 'N/A' && (
                <TrendingDown className="w-3 h-3 text-green-500" />
              )}
              {insights.rpcCallReduction}
            </span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground">{recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}