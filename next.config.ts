import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '' : '',
  
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['framer-motion', 'gsap'],
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  serverExternalPackages: ['pg', 'express', 'socket.io'],
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        'pg-native': false,
        pg: false,
        express: false,
        'socket.io': false,
        crypto: require.resolve('crypto-browserify'),
      };
      
      config.externals = config.externals || [];
      config.externals.push('pg', 'express', 'socket.io', 'cors');
      
      config.plugins = config.plugins || [];
      config.plugins.push(
        new (require('webpack')).ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }
    return config;
  },
  
  async rewrites() {
    return [
      {
        source: '/api/solana-proxy/:path*',
        destination: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com/:path*',
      },
      {
        source: '/api/serum-proxy/:path*',
        destination: 'https://solana-api.projectserum.com/:path*',
      },
    ];
  },
  
  env: {
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet',
    NEXT_PUBLIC_MEMO_PROGRAM_ID: process.env.NEXT_PUBLIC_MEMO_PROGRAM_ID || 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
    JWT_SECRET: process.env.JWT_SECRET,
  },
};

export default nextConfig;