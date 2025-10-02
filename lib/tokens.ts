import { PublicKey } from '@solana/web3.js';

// 🪙 토큰 정보 타입 정의
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
}

// 🌟 주요 토큰들
export const TOKENS = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    coingeckoId: 'solana',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    coingeckoId: 'usd-coin',
  },
} as const;

// 🔄 스왑 관련 상수
export const SWAP_CONFIG = {
  // Jupiter Aggregator API (2025 엔드포인트 업데이트)
  JUPITER_API_URL: 'https://lite-api.jup.ag/swap/v1',
  
  // 기본 슬리피지 (0.5%)
  DEFAULT_SLIPPAGE_BPS: 50,
  
  // 최대 슬리피지 (5%)
  MAX_SLIPPAGE_BPS: 500,
  
  // 기본 우선순위 수수료 (마이크로 램포트)
  DEFAULT_PRIORITY_FEE: 1000,
} as const;

// 🏷️ 토큰 PublicKey 객체들
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export const SOL_MINT = new PublicKey(TOKENS.SOL.address);
export const USDC_MINT = new PublicKey(TOKENS.USDC.address);

// 💰 금액 포맷팅 유틸리티
export function formatTokenAmount(amount: number | string, decimals: number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const divisor = Math.pow(10, decimals);
  return (num / divisor).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

// 🔢 토큰 원시 금액으로 변환
export function parseTokenAmount(amount: number | string, decimals: number): bigint {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const multiplier = Math.pow(10, decimals);
  return BigInt(Math.floor(num * multiplier));
}

// 🏪 토큰 주소로 토큰 정보 찾기
export function getTokenByAddress(address: string): TokenInfo | undefined {
  return Object.values(TOKENS).find(token => token.address === address);
}

export default {
  TOKENS,
  SWAP_CONFIG,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SOL_MINT,
  USDC_MINT,
  formatTokenAmount,
  parseTokenAmount,
  getTokenByAddress,
}; 