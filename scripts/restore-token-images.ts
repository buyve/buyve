/**
 * 토큰의 실제 메타데이터에서 이미지를 가져와서 업데이트하는 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/restore-token-images.ts
 */

import { createClient } from '@supabase/supabase-js';
import {
  findMetadataPda,
  fetchMetadata
} from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { Connection, PublicKey } from '@solana/web3.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/***REMOVED_ALCHEMY_KEY***';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function sanitizeString(value?: string | null): string {
  return value ? value.replace(/\0/g, '').trim() : '';
}

async function fetchJsonMetadata(uri: string) {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`   ⚠️  Failed to fetch JSON metadata: ${error}`);
    return null;
  }
}

async function getTokenImageFromMetadata(tokenAddress: string): Promise<string | null> {
  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const umi = createUmi(rpcUrl);
    const mintPublicKey = publicKey(tokenAddress);
    const mintPublicKeySolana = new PublicKey(tokenAddress);

    // 🔥 1. Token-2022 Extensions 먼저 확인
    try {
      const parsedAccount = await connection.getParsedAccountInfo(mintPublicKeySolana);
      const accountData = parsedAccount.value?.data;

      if (accountData && typeof accountData === 'object' && 'parsed' in accountData) {
        const parsed = accountData.parsed as any;
        const extensions = parsed?.info?.extensions;

        if (Array.isArray(extensions)) {
          const metadataExtension = extensions.find((ext: any) => ext.extension === 'tokenMetadata');
          if (metadataExtension?.state?.uri) {
            const uri = sanitizeString(metadataExtension.state.uri);
            console.log(`   📄 Token-2022 Metadata URI: ${uri}`);

            const jsonMetadata = await fetchJsonMetadata(uri);
            if (jsonMetadata?.image) {
              console.log(`   ✅ Found image from Token-2022: ${jsonMetadata.image}`);
              return jsonMetadata.image;
            }
          }
        }
      }
    } catch (token2022Error) {
      console.log(`   ⚠️  Token-2022 check failed, trying Metaplex...`);
    }

    // 🔥 2. Metaplex 메타데이터 시도
    try {
      const metadataAddress = findMetadataPda(umi, { mint: mintPublicKey });
      const metadata = await fetchMetadata(umi, metadataAddress[0]);

      const uri = sanitizeString(metadata.uri);
      if (!uri) {
        console.log(`   ⚠️  No URI found in Metaplex metadata`);
        return null;
      }

      console.log(`   📄 Metaplex Metadata URI: ${uri}`);

      const jsonMetadata = await fetchJsonMetadata(uri);
      if (jsonMetadata?.image) {
        console.log(`   ✅ Found image from Metaplex: ${jsonMetadata.image}`);
        return jsonMetadata.image;
      }

      console.log(`   ⚠️  No image found in JSON metadata`);
      return null;
    } catch (metaplexError) {
      console.log(`   ⚠️  Metaplex metadata not found`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Error fetching metadata:`, error);
    return null;
  }
}

async function restoreTokenImages() {
  console.log('🔧 Starting token image restoration from metadata...\n');

  // 1. 모든 채팅방 조회
  const { data: chatrooms, error } = await supabase
    .from('chat_rooms')
    .select('id, token_address, name, image');

  if (error) {
    console.error('❌ Failed to fetch chatrooms:', error);
    return;
  }

  console.log(`📊 Found ${chatrooms.length} chatrooms\n`);

  // 2. 각 채팅방의 실제 메타데이터에서 이미지 가져오기
  for (const room of chatrooms) {
    console.log(`\n🔍 Processing: ${room.name}`);
    console.log(`   Token Address: ${room.token_address}`);
    console.log(`   Current image: ${room.image}`);

    // 토큰 주소가 있는 경우에만 처리
    if (room.token_address) {
      const realImageUrl = await getTokenImageFromMetadata(room.token_address);

      if (realImageUrl) {
        // 업데이트
        const { error: updateError } = await supabase
          .from('chat_rooms')
          .update({ image: realImageUrl })
          .eq('id', room.id);

        if (updateError) {
          console.error(`   ❌ Failed to update: ${updateError.message}`);
        } else {
          console.log(`   ✅ Updated to real metadata image`);
        }
      } else {
        // 메타데이터에서 이미지를 못 찾으면 static CDN 사용
        const fallbackUrl = `https://static.jup.ag/images/${room.token_address}.png`;
        console.log(`   🎯 Using fallback: ${fallbackUrl}`);

        const { error: updateError } = await supabase
          .from('chat_rooms')
          .update({ image: fallbackUrl })
          .eq('id', room.id);

        if (updateError) {
          console.error(`   ❌ Failed to update: ${updateError.message}`);
        } else {
          console.log(`   ✅ Updated to fallback image`);
        }
      }
    } else {
      console.log(`   ⏭️  No token address, skipping`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n🎉 Image restoration completed!');
}

restoreTokenImages().catch(console.error);
