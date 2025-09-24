'use client';

import { Connection, Transaction, TransactionInstruction, PublicKey, SendOptions } from '@solana/web3.js';
import { MEMO_PROGRAM_ID } from './solana';

// 지원하는 프로토콜 타입
export type SupportedProtocol = 
  | 'PUMP' 
  | 'LAUNCHLAB' 
  | 'LAUNCH_A_COIN' 
  | 'BOOP' 
  | 'MOONSHOT' 
  | 'RAYDIUM' 
  | 'PUMP_AMM' 
  | 'METEORA_AMM' 
  | 'METEORA_AMM_V2' 
  | 'BONK' 
  | 'DYNAMIC_BC';

// 메시지 타입
export type MessageType = 'BUY' | 'SELL' | 'CHAT';

// 메모 메시지 인터페이스
export interface MemoMessage {
  type: MessageType;
  tokenSymbol?: string;
  quantity?: number;
  price?: number;
  protocol?: SupportedProtocol;
  content: string;
  timestamp: Date;
}

// 메모 트랜잭션 옵션
export interface MemoTransactionOptions {
  message: string;
  protocol?: SupportedProtocol;
  maxRetries?: number;
  retryDelay?: number;
  sendOptions?: SendOptions;
}

// 트랜잭션 결과
export interface MemoTransactionResult {
  signature: string;
  message: string;
  protocol?: SupportedProtocol;
  timestamp: Date;
  blockTime?: number;
}

// 지원 프로토콜 목록
export const SUPPORTED_PROTOCOLS: Record<SupportedProtocol, string> = {
  PUMP: 'Pump',
  LAUNCHLAB: 'LaunchLab',
  LAUNCH_A_COIN: 'Launch a Coin',
  BOOP: 'Boop',
  MOONSHOT: 'Moonshot',
  RAYDIUM: 'Raydium',
  PUMP_AMM: 'Pump AMM',
  METEORA_AMM: 'Meteora AMM',
  METEORA_AMM_V2: 'Meteora AMM V2',
  BONK: 'Bonk',
  DYNAMIC_BC: 'Dynamic BC',
};

/**
 * 메모 메시지 포맷 생성
 * @param type 메시지 타입 (BUY/SELL/CHAT)
 * @param content 메시지 내용
 * @param tokenSymbol 토큰 심볼 (선택적)
 * @param quantity 수량 (선택적)
 * @param price 가격 (선택적)
 * @param protocol 프로토콜 (선택적)
 * @returns 포맷된 메모 문자열
 */
export function formatMemoMessage(
  type: MessageType,
  content: string,
  tokenSymbol?: string,
  quantity?: number,
  price?: number,
  protocol?: SupportedProtocol
): string {
  if (type === 'CHAT') {
    return content;
  }

  // 거래 메시지 포맷: BUY:SOL:100@1.5:RAYDIUM 또는 BUY:SOL:100@1.5
  let message = `${type}:${tokenSymbol || 'UNKNOWN'}`;
  
  if (quantity !== undefined && price !== undefined) {
    message += `:${quantity}@${price}`;
  }
  
  if (protocol) {
    message += `:${protocol}`;
  }
  
  return message;
}

/**
 * 메모 메시지 파싱
 * @param memoText 메모 텍스트
 * @returns 파싱된 메모 메시지
 */
export function parseMemoMessage(memoText: string): MemoMessage {
  const timestamp = new Date();
  
  // CHAT 메시지인지 확인 (BUY/SELL로 시작하지 않는 경우)
  if (!memoText.startsWith('BUY:') && !memoText.startsWith('SELL:')) {
    return {
      type: 'CHAT',
      content: memoText,
      timestamp,
    };
  }

  // 거래 메시지 파싱: BUY:SOL:100@1.5:RAYDIUM
  const parts = memoText.split(':');
  
  if (parts.length < 2) {
    return {
      type: 'CHAT',
      content: memoText,
      timestamp,
    };
  }

  const type = parts[0] as MessageType;
  const tokenSymbol = parts[1];
  
  let quantity: number | undefined;
  let price: number | undefined;
  let protocol: SupportedProtocol | undefined;

  // 수량과 가격 파싱 (100@1.5 형태)
  if (parts.length >= 3 && parts[2].includes('@')) {
    const [quantityStr, priceStr] = parts[2].split('@');
    quantity = parseFloat(quantityStr);
    price = parseFloat(priceStr);
  }

  // 프로토콜 파싱
  if (parts.length >= 4 && parts[3] in SUPPORTED_PROTOCOLS) {
    protocol = parts[3] as SupportedProtocol;
  }

  return {
    type,
    tokenSymbol,
    quantity,
    price,
    protocol,
    content: memoText,
    timestamp,
  };
}

/**
 * 메모 트랜잭션 생성
 * @param message 메모 메시지
 * @param feePayer 수수료 지불자 주소
 * @returns 메모 트랜잭션
 */
export function createMemoTransaction(message: string, feePayer: PublicKey): Transaction {
  const transaction = new Transaction();
  
  // 메모 인스트럭션 생성
  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(message, 'utf8'),
  });
  
  transaction.add(memoInstruction);
  transaction.feePayer = feePayer;
  
  return transaction;
}

/**
 * 메모 트랜잭션 전송
 * @param connection Solana 연결 객체
 * @param transaction 서명된 트랜잭션
 * @param options 전송 옵션
 * @returns 트랜잭션 서명
 */
export async function sendMemoTransaction(
  connection: Connection,
  transaction: Transaction,
  options: SendOptions = {}
): Promise<string> {
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    ...options,
  });

  // 트랜잭션 확인 대기
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  
  if (confirmation.value.err) {
    throw new Error(`메모 트랜잭션 실패: ${confirmation.value.err}`);
  }

  return signature;
}

/**
 * 재시도 메커니즘이 포함된 메모 트랜잭션 전송
 * @param connection Solana 연결 객체
 * @param transaction 서명된 트랜잭션
 * @param maxRetries 최대 재시도 횟수
 * @param retryDelay 재시도 간격 (ms)
 * @returns 트랜잭션 서명
 */
export async function sendMemoTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<string> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const signature = await sendMemoTransaction(connection, transaction);
      return signature;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('알 수 없는 오류');
      
      // 마지막 시도가 아니면 잠시 대기
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  throw new Error(`메모 트랜잭션 ${maxRetries + 1}회 시도 모두 실패: ${lastError!.message}`);
}

/**
 * 메모 트랜잭션에서 메시지 추출
 * @param connection Solana 연결 객체
 * @param signature 트랜잭션 서명
 * @returns 메모 메시지 또는 null
 */
export async function extractMemoFromTransaction(
  connection: Connection,
  signature: string
): Promise<string | null> {
  try {
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction || !transaction.meta) {
      return null;
    }

    // 메모 프로그램 인스트럭션 찾기
    const memoInstruction = transaction.transaction.message.compiledInstructions.find(
      instruction => {
        const programId = transaction.transaction.message.staticAccountKeys[instruction.programIdIndex];
        return programId.equals(MEMO_PROGRAM_ID);
      }
    );

    if (!memoInstruction || !memoInstruction.data) {
      return null;
    }

    // 메모 데이터 디코딩
    const memoData = Buffer.from(memoInstruction.data);
    return memoData.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * 프로토콜 유효성 검증
 * @param protocol 프로토콜 문자열
 * @returns 유효한 프로토콜 여부
 */
export function isValidProtocol(protocol: string): protocol is SupportedProtocol {
  return protocol in SUPPORTED_PROTOCOLS;
}

/**
 * 메시지 타입 유효성 검증
 * @param type 메시지 타입 문자열
 * @returns 유효한 메시지 타입 여부
 */
export function isValidMessageType(type: string): type is MessageType {
  return ['BUY', 'SELL', 'CHAT'].includes(type);
}

/**
 * 메모 메시지 유효성 검증
 * @param message 메모 메시지
 * @returns 유효성 검증 결과
 */
export function validateMemoMessage(message: string): {
  isValid: boolean;
  errors: string[];
  parsed?: MemoMessage;
} {
  const errors: string[] = [];
  
  if (!message || message.trim().length === 0) {
    errors.push('메시지가 비어있습니다');
    return { isValid: false, errors };
  }

  if (message.length > 566) { // Solana 메모 최대 크기
    errors.push('메시지가 너무 깁니다 (최대 566바이트)');
  }

  try {
    const parsed = parseMemoMessage(message);
    
    if (parsed.type !== 'CHAT') {
      if (!parsed.tokenSymbol) {
        errors.push('거래 메시지에는 토큰 심볼이 필요합니다');
      }
      
      if (parsed.quantity !== undefined && (isNaN(parsed.quantity) || parsed.quantity <= 0)) {
        errors.push('유효하지 않은 수량입니다');
      }
      
      if (parsed.price !== undefined && (isNaN(parsed.price) || parsed.price <= 0)) {
        errors.push('유효하지 않은 가격입니다');
      }
      
      if (parsed.protocol && !isValidProtocol(parsed.protocol)) {
        errors.push('지원하지 않는 프로토콜입니다');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsed: errors.length === 0 ? parsed : undefined,
    };
  } catch {
    errors.push('메시지 파싱 실패');
    return { isValid: false, errors };
  }
} 