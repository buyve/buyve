import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Edge Function URL
const COLLECT_PRICES_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/collect-prices';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || 'your-secret-key';

// 1분마다 실행되는 Cron Job
serve(async (req) => {
  try {
    // 마지막 실행 시간 확인 (중복 실행 방지)
    const lastRun = parseInt(Deno.env.get('LAST_RUN') || '0');
    const now = Date.now();
    
    // 50초 이내에 실행된 적이 있으면 스킵
    if (now - lastRun < 50000) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Already ran recently' 
      }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // collect-prices Edge Function 호출
    const response = await fetch(COLLECT_PRICES_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    return new Response(JSON.stringify({
      success: true,
      result,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});