import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseSupabaseRealtimeOptions {
  channel: string;
  event?: string;
  table?: string;
  filter?: string;
  onMessage?: (payload: any) => void;
}

export function useSupabaseRealtime({
  channel,
  event = '*',
  table,
  filter,
  onMessage
}: UseSupabaseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    const channelInstance = supabase.channel(channel);

    if (table) {
      // Database changes
      channelInstance.on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          filter
        },
        (payload) => {
          onMessage?.(payload);
        }
      );
    } else {
      // Broadcast messages
      channelInstance.on('broadcast', { event }, (payload) => {
        onMessage?.(payload);
      });
    }

    channelInstance.subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED');
    });

    setRealtimeChannel(channelInstance);

    return () => {
      channelInstance.unsubscribe();
    };
  }, [channel, event, table, filter]);

  const broadcast = async (event: string, payload: any) => {
    if (realtimeChannel) {
      await realtimeChannel.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  };

  return {
    isConnected,
    broadcast,
    channel: realtimeChannel
  };
}