const { Connection, clusterApiUrl } = require('@solana/web3.js');

async function checkRPC() {
  console.log('=== RPC Connection Check ===\n');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log('NEXT_PUBLIC_RPC_URL:', process.env.NEXT_PUBLIC_RPC_URL || 'Not set');
  console.log('NEXT_PUBLIC_SOLANA_RPC_URL:', process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'Not set');
  console.log('NEXT_PUBLIC_SOLANA_NETWORK:', process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'Not set');
  console.log('\n');
  
  const endpoints = [
    { name: 'Alchemy (from code)', url: 'https://solana-mainnet.g.alchemy.com/v2/***REMOVED_ALCHEMY_KEY***' },
    { name: 'Ankr', url: 'https://rpc.ankr.com/solana' },
    { name: 'RPC Pool', url: 'https://api.mainnet.rpcpool.com' },
    { name: 'Solana Official', url: clusterApiUrl('mainnet-beta') },
  ];
  
  if (process.env.NEXT_PUBLIC_RPC_URL) {
    endpoints.unshift({ name: 'From ENV', url: process.env.NEXT_PUBLIC_RPC_URL });
  }
  
  console.log('Testing RPC Endpoints:\n');
  
  for (const endpoint of endpoints) {
    try {
      const start = Date.now();
      const connection = new Connection(endpoint.url, 'confirmed');
      
      // Test connection with getVersion
      const version = await connection.getVersion();
      const latency = Date.now() - start;
      
      console.log(`✅ ${endpoint.name}:`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   Status: Connected`);
      console.log(`   Version: ${version['solana-core']}`);
      console.log(`   Latency: ${latency}ms`);
      
      // Test balance fetch capability
      try {
        const { PublicKey } = require('@solana/web3.js');
        const testPubkey = new PublicKey('So11111111111111111111111111111111111111112'); // System program
        const balance = await connection.getBalance(testPubkey);
        console.log(`   Balance test: Success (${balance} lamports)`);
      } catch (balanceError) {
        console.log(`   Balance test: Failed - ${balanceError.message}`);
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint.name}:`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   Status: Failed`);
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
  }
}

// Load .env.local if exists
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // ignore
}

checkRPC().catch(console.error);