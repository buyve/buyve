/**
 * 특정 토큰의 메타데이터를 조회하는 스크립트
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  findMetadataPda,
  fetchMetadata
} from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';

const tokenAddress = 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn';
const rpcUrl = 'https://solana-mainnet.g.alchemy.com/v2/***REMOVED_ALCHEMY_KEY***';

async function checkMetadata() {
  console.log(`🔍 Checking metadata for: ${tokenAddress}\n`);

  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const umi = createUmi(rpcUrl);
    const mintPublicKey = publicKey(tokenAddress);

    // 1. 온체인 계정 정보 확인
    const accountInfo = await connection.getAccountInfo(new PublicKey(tokenAddress));
    console.log('📦 Account Info:');
    console.log('   Owner:', accountInfo?.owner.toString());
    console.log('   Executable:', accountInfo?.executable);
    console.log('   Data length:', accountInfo?.data.length);
    console.log();

    // 2. Metaplex 메타데이터 PDA 확인
    const metadataAddress = findMetadataPda(umi, { mint: mintPublicKey });
    console.log('🔑 Metadata PDA:', metadataAddress[0]);
    console.log();

    // 3. 메타데이터 조회 시도
    try {
      const metadata = await fetchMetadata(umi, metadataAddress[0]);
      console.log('✅ Metaplex Metadata found:');
      console.log('   Name:', metadata.name);
      console.log('   Symbol:', metadata.symbol);
      console.log('   URI:', metadata.uri);
      console.log();

      // 4. JSON 메타데이터 조회
      if (metadata.uri) {
        const uri = metadata.uri.replace(/\0/g, '').trim();
        console.log(`📄 Fetching JSON metadata from: ${uri}`);
        const response = await fetch(uri);
        const jsonData = await response.json();
        console.log('   JSON Data:', JSON.stringify(jsonData, null, 2));
      }
    } catch (metadataError) {
      console.log('⚠️  Metaplex metadata not found:', metadataError);
    }

    // 5. Token-2022 Extensions 확인
    console.log('\n🔍 Checking Token-2022 Extensions...');
    const parsedAccount = await connection.getParsedAccountInfo(new PublicKey(tokenAddress));
    console.log('Parsed Account:', JSON.stringify(parsedAccount.value?.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMetadata().catch(console.error);
