import { NextResponse } from 'next/server';
import { Connection, clusterApiUrl } from '@solana/web3.js';

const RPC_ENDPOINTS = [
  { name: 'Alchemy (Custom)', url: 'https://solana-mainnet.g.alchemy.com/v2/***REMOVED_ALCHEMY_KEY***' },
  { name: 'Env Variable', url: process.env.NEXT_PUBLIC_RPC_URL || 'Not Set' },
  { name: 'Ankr', url: 'https://rpc.ankr.com/solana' },
  { name: 'RPC Pool', url: 'https://api.mainnet.rpcpool.com' },
  { name: 'Solana Official', url: clusterApiUrl('mainnet-beta') },
];

async function testRpcEndpoint(endpoint: { name: string; url: string }) {
  if (endpoint.url === 'Not Set') {
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: 'Not Configured',
      latency: null,
      error: 'Environment variable not set'
    };
  }

  const startTime = Date.now();
  
  try {
    const connection = new Connection(endpoint.url, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
    });
    
    // Test getRecentBlockhash with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
    );
    
    await Promise.race([
      connection.getRecentBlockhash(),
      timeoutPromise
    ]);
    
    const latency = Date.now() - startTime;
    
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: 'OK',
      latency: `${latency}ms`,
      error: null
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: 'Failed',
      latency: `${latency}ms`,
      error: error.message || 'Unknown error'
    };
  }
}

export async function GET() {
  try {
    console.log('[RPC Health] Starting health check for all endpoints...');
    
    // Test all endpoints in parallel
    const results = await Promise.all(
      RPC_ENDPOINTS.map(endpoint => testRpcEndpoint(endpoint))
    );
    
    // Check API proxy endpoint
    const proxyResult = await testProxyEndpoint();
    
    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      endpoints: results,
      proxy: proxyResult,
      recommendation: getRecommendation(results, proxyResult)
    };
    
    console.log('[RPC Health] Health check complete:', summary);
    
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[RPC Health] Health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed', details: error.message },
      { status: 500 }
    );
  }
}

async function testProxyEndpoint() {
  const startTime = Date.now();
  
  try {
    const response = await fetch('/api/solana-rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth'
      })
    });
    
    const data = await response.json();
    const latency = Date.now() - startTime;
    
    if (response.ok && data.result === 'ok') {
      return {
        status: 'OK',
        latency: `${latency}ms`,
        error: null
      };
    } else {
      return {
        status: 'Failed',
        latency: `${latency}ms`,
        error: data.error || 'Unknown error'
      };
    }
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return {
      status: 'Failed',
      latency: `${latency}ms`,
      error: error.message
    };
  }
}

function getRecommendation(results: any[], proxyResult: any) {
  const workingEndpoints = results.filter(r => r.status === 'OK');
  
  if (proxyResult.status === 'OK') {
    return 'API Proxy is working. This is the recommended approach.';
  }
  
  if (workingEndpoints.length === 0) {
    return 'CRITICAL: No RPC endpoints are working. Check network connectivity and RPC service status.';
  }
  
  if (workingEndpoints.length < 3) {
    return 'WARNING: Limited RPC endpoints available. Consider adding more reliable endpoints.';
  }
  
  const fastestEndpoint = workingEndpoints.reduce((prev, current) => 
    parseInt(prev.latency) < parseInt(current.latency) ? prev : current
  );
  
  return `Use ${fastestEndpoint.name} for best performance (${fastestEndpoint.latency}).`;
}