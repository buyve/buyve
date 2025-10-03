/**
 * 특정 토큰의 DB 데이터 확인
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkToken() {
  const tokenAddress = '48yjoFSJ8m6jgDorrYvwfxoLCPAuML9sGz975ZAJtbBY';

  console.log(`🔍 Checking DB data for: ${tokenAddress}\n`);

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('token_address', tokenAddress)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📦 DB Data:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n🖼️  Image field:', data.image);
}

checkToken().catch(console.error);
