import { SWAP_CONFIG } from './tokens';

// 🔄 Jupiter Quote 응답 타입
export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

// 🔄 Jupiter Swap 응답 타입
export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  prioritizationType?: {
    computeBudget?: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport?: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
  };
  simulationError?: {
    error: string;
    message?: string;
    logs?: string[];
  };
}

// 🔄 스왑 파라미터 타입 (수수료 포함)
export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  slippageBps?: number;
  userPublicKey: string;
  platformFeeBps?: number; // 플랫폼 수수료 (basis points)
  feeAccount?: string; // 수수료를 받을 토큰 계정
}

// 🔄 고급 스왑 파라미터 타입
export interface AdvancedSwapParams extends SwapParams {
  dynamicComputeUnitLimit?: boolean;
  dynamicSlippage?: boolean | { maxBps?: number };
  prioritizationFeeLamports?: 
    | 'auto' 
    | number 
    | {
        priorityLevelWithMaxLamports?: {
          maxLamports: number;
          priorityLevel: 'low' | 'medium' | 'high' | 'veryHigh';
          global?: boolean;
        };
        jitoTipLamports?: number;
      };
  wrapAndUnwrapSol?: boolean;
  destinationTokenAccount?: string;
}

// 🌟 Jupiter Aggregator Service
export class JupiterService {
  private baseUrl: string;
  private quoteUrl: string;
  private swapUrl: string;

  constructor() {
    // 최신 API 엔드포인트 사용
    this.baseUrl = 'https://lite-api.jup.ag';
    this.quoteUrl = `${this.baseUrl}/swap/v1/quote`;
    this.swapUrl = `${this.baseUrl}/swap/v1/swap`;
  }

  // 💰 스왑 견적 가져오기 (수수료 포함)
  async getQuote(params: SwapParams): Promise<JupiterQuote> {
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = SWAP_CONFIG.DEFAULT_SLIPPAGE_BPS,
      platformFeeBps,
    } = params;

    const url = new URL(this.quoteUrl);
    url.searchParams.append('inputMint', inputMint);
    url.searchParams.append('outputMint', outputMint);
    url.searchParams.append('amount', amount.toString());
    url.searchParams.append('slippageBps', slippageBps.toString());
    url.searchParams.append('onlyDirectRoutes', 'false');
    url.searchParams.append('asLegacyTransaction', 'false');
    url.searchParams.append('restrictIntermediateTokens', 'true');

    // 🎯 플랫폼 수수료 추가 (2025년 1월 업데이트)
    if (platformFeeBps && platformFeeBps > 0) {
      url.searchParams.append('platformFeeBps', platformFeeBps.toString());
    }


    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter Quote API error: ${response.status} - ${errorText}`);
      }

      const quote = await response.json() as JupiterQuote;

      return quote;
      
    } catch (error) {
      throw error;
    }
  }

  // 🔄 스왑 트랜잭션 생성 (수수료 포함, 최적화된 버전)
  async getSwapTransaction(
    quote: JupiterQuote,
    params: AdvancedSwapParams
  ): Promise<JupiterSwapResponse> {
    const {
      userPublicKey,
      feeAccount,
      dynamicComputeUnitLimit = true,
      dynamicSlippage = true,
      prioritizationFeeLamports = {
        priorityLevelWithMaxLamports: {
          maxLamports: SWAP_CONFIG.DEFAULT_PRIORITY_FEE,
          priorityLevel: 'high'
        }
      },
      wrapAndUnwrapSol = true,
      destinationTokenAccount,
    } = params;

    const requestBody: {
      quoteResponse: JupiterQuote;
      userPublicKey: string;
      wrapAndUnwrapSol: boolean;
      dynamicComputeUnitLimit: boolean;
      dynamicSlippage: boolean | { maxBps?: number };
      prioritizationFeeLamports: 'auto' | number | {
        priorityLevelWithMaxLamports?: {
          maxLamports: number;
          priorityLevel: 'low' | 'medium' | 'high' | 'veryHigh';
          global?: boolean;
        };
        jitoTipLamports?: number;
      };
      feeAccount?: string;
      destinationTokenAccount?: string;
    } = {
      quoteResponse: quote,
      userPublicKey: userPublicKey,
      wrapAndUnwrapSol,
      dynamicComputeUnitLimit,
      dynamicSlippage,
      prioritizationFeeLamports,
    };

    // 🎯 수수료 계정 추가 (2025년 1월 업데이트 - Referral Program 불필요)
    if (feeAccount) {
      requestBody.feeAccount = feeAccount;
    }

    // 🎯 목적지 토큰 계정 (결제용)
    if (destinationTokenAccount) {
      requestBody.destinationTokenAccount = destinationTokenAccount;
    }


    try {
      const response = await fetch(this.swapUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter Swap API 오류: ${response.status} - ${errorText}`);
      }

      const swapResponse = await response.json() as JupiterSwapResponse;
      

      return swapResponse;
      
    } catch (error) {
      throw error;
    }
  }

  // 🔄 기존 메서드 (하위 호환성)
  async getSwapTransactionLegacy(
    quote: JupiterQuote,
    userPublicKey: string,
    wrapAndUnwrapSol: boolean = true
  ): Promise<JupiterSwapResponse> {
    return this.getSwapTransaction(quote, {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      amount: quote.inAmount,
      userPublicKey,
      wrapAndUnwrapSol,
    });
  }

  // 📊 스왑 시뮬레이션 (수수료 포함)
  async simulateSwap(params: SwapParams): Promise<{
    quote: JupiterQuote;
    inputAmount: string;
    outputAmount: string;
    priceImpact: string;
    minimumReceived: string;
    platformFee?: string;
    routes: string[];
  }> {
    try {
      const quote = await this.getQuote(params);
      
      return {
        quote,
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct,
        minimumReceived: quote.otherAmountThreshold,
        platformFee: quote.platformFee ? `${quote.platformFee.amount} (${quote.platformFee.feeBps} bps)` : undefined,
        routes: quote.routePlan.map(route => route.swapInfo.label),
      };
      
    } catch (error) {
      throw error;
    }
  }

  // 💲 가격 정보 가져오기
  async getPrice(inputMint: string, outputMint: string): Promise<number> {
    try {
      // 1 단위로 견적 요청
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount: Math.pow(10, 6), // 1 토큰 (6 decimals 기준)
        userPublicKey: 'placeholder', // 가격 조회에는 실제 주소 불필요
      });

      const inputAmount = parseFloat(quote.inAmount);
      const outputAmount = parseFloat(quote.outAmount);
      
      return outputAmount / inputAmount;
      
    } catch {
      return 0;
    }
  }

  // 🎯 수수료가 포함된 완전한 스왑 실행
  async executeSwapWithFee(params: {
    inputMint: string;
    outputMint: string;
    amount: string | number;
    userPublicKey: string;
    feeAccount: string;
    platformFeeBps: number;
    slippageBps?: number;
    priorityLevel?: 'low' | 'medium' | 'high' | 'veryHigh';
  }): Promise<{
    quote: JupiterQuote;
    swapTransaction: JupiterSwapResponse;
  }> {
    const {
      inputMint,
      outputMint,
      amount,
      userPublicKey,
      feeAccount,
      platformFeeBps,
      slippageBps = SWAP_CONFIG.DEFAULT_SLIPPAGE_BPS,
      priorityLevel = 'high',
    } = params;


    try {
      // 1. 수수료 포함 견적 요청
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount,
        userPublicKey,
        slippageBps,
        platformFeeBps,
      });

      // 2. 수수료 포함 트랜잭션 생성
      const swapTransaction = await this.getSwapTransaction(quote, {
        inputMint,
        outputMint,
        amount,
        userPublicKey,
        feeAccount,
        slippageBps,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: SWAP_CONFIG.DEFAULT_PRIORITY_FEE,
            priorityLevel,
          }
        },
      });


      return { quote, swapTransaction };

    } catch (error) {
      throw error;
    }
  }
}

// 🌟 글로벌 Jupiter 서비스 인스턴스
export const jupiterService = new JupiterService();

// 🔄 편의 함수들 (수수료 포함 버전)
export async function getSOLtoUSDCQuoteWithFee(
  solAmount: number, 
  userPublicKey: string,
  feeAccount?: string,
  platformFeeBps?: number
) {
  return jupiterService.getQuote({
    inputMint: 'So11111111111111111111111111111111111111112', // SOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount: Math.floor(solAmount * Math.pow(10, 9)), // SOL은 9 decimals
    userPublicKey,
    platformFeeBps,
  });
}

export async function getUSDCtoSOLQuoteWithFee(
  usdcAmount: number, 
  userPublicKey: string,
  feeAccount?: string,
  platformFeeBps?: number
) {
  return jupiterService.getQuote({
    inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    outputMint: 'So11111111111111111111111111111111111111112', // SOL
    amount: Math.floor(usdcAmount * Math.pow(10, 6)), // USDC는 6 decimals
    userPublicKey,
    platformFeeBps,
  });
}

// 🔄 기존 편의 함수들 (하위 호환성)
export async function getSOLtoUSDCQuote(solAmount: number, userPublicKey: string) {
  return getSOLtoUSDCQuoteWithFee(solAmount, userPublicKey);
}

export async function getUSDCtoSOLQuote(usdcAmount: number, userPublicKey: string) {
  return getUSDCtoSOLQuoteWithFee(usdcAmount, userPublicKey);
}

export default {
  JupiterService,
  jupiterService,
  getSOLtoUSDCQuote,
  getUSDCtoSOLQuote,
  getSOLtoUSDCQuoteWithFee,
  getUSDCtoSOLQuoteWithFee,
}; 