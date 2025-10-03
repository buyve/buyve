/**
 * 기존 채팅방의 이미지 URL을 수정하는 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/fix-chatroom-images.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixChatroomImages() {
  console.log('🔧 Starting chatroom image fix...\n');

  // 1. 모든 채팅방 조회
  const { data: chatrooms, error } = await supabase
    .from('chat_rooms')
    .select('id, token_address, name, image');

  if (error) {
    console.error('❌ Failed to fetch chatrooms:', error);
    return;
  }

  console.log(`📊 Found ${chatrooms.length} chatrooms\n`);

  // 2. 각 채팅방의 이미지 수정
  for (const room of chatrooms) {
    console.log(`\n🔍 Processing: ${room.name} (${room.token_address})`);
    console.log(`   Current image: ${room.image}`);

    // 이미지가 이모지이거나 null인 경우
    if (!room.image || !room.image.startsWith('http')) {
      const newImageUrl = `https://static.jup.ag/images/${room.token_address}.png`;

      console.log(`   ➡️  New image: ${newImageUrl}`);

      // 업데이트
      const { error: updateError } = await supabase
        .from('chat_rooms')
        .update({ image: newImageUrl })
        .eq('id', room.id);

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Updated successfully`);
      }
    } else {
      console.log(`   ✅ Already has valid URL, skipping`);
    }
  }

  console.log('\n\n🎉 Image fix completed!');
}

fixChatroomImages().catch(console.error);
