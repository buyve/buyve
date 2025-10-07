'use client';

import { Connection, Transaction, TransactionInstruction, PublicKey, SendOptions } from '@solana/web3.js';
import { MEMO_PROGRAM_ID } from './solana';

// Supported protocol types
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

// Message type
export type MessageType = 'BUY' | 'SELL' | 'CHAT';

// Memo message interface
export interface MemoMessage {
  type: MessageType;
  tokenSymbol?: string;
  quantity?: number;
  price?: number;
  protocol?: SupportedProtocol;
  content: string;
  timestamp: Date;
}

// Memo transaction options
export interface MemoTransactionOptions {
  message: string;
  protocol?: SupportedProtocol;
  maxRetries?: number;
  retryDelay?: number;
  sendOptions?: SendOptions;
}

// Transaction result
export interface MemoTransactionResult {
  signature: string;
  message: string;
  protocol?: SupportedProtocol;
  timestamp: Date;
  blockTime?: number;
}

// Supported protocol list
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
 * Create memo message format
 * @param type Message type (BUY/SELL/CHAT)
 * @param content Message content
 * @param tokenSymbol Token symbol (optional)
 * @param quantity Quantity (optional)
 * @param price Price (optional)
 * @param protocol Protocol (optional)
 * @returns Formatted memo string
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

  // Trade message format: BUY:SOL:100@1.5:RAYDIUM or BUY:SOL:100@1.5
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
 * Parse memo message
 * @param memoText Memo text
 * @returns Parsed memo message
 */
export function parseMemoMessage(memoText: string): MemoMessage {
  const timestamp = new Date();

  // Check if it's a CHAT message (not starting with BUY/SELL)
  if (!memoText.startsWith('BUY:') && !memoText.startsWith('SELL:')) {
    return {
      type: 'CHAT',
      content: memoText,
      timestamp,
    };
  }

  // Parse trade message: BUY:SOL:100@1.5:RAYDIUM
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

  // Parse quantity and price (format: 100@1.5)
  if (parts.length >= 3 && parts[2].includes('@')) {
    const [quantityStr, priceStr] = parts[2].split('@');
    quantity = parseFloat(quantityStr);
    price = parseFloat(priceStr);
  }

  // Parse protocol
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
 * Create memo transaction
 * @param message Memo message
 * @param feePayer Fee payer address
 * @returns Memo transaction
 */
export function createMemoTransaction(message: string, feePayer: PublicKey): Transaction {
  const transaction = new Transaction();

  // Create memo instruction
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
 * Send memo transaction
 * @param connection Solana connection object
 * @param transaction Signed transaction
 * @param options Send options
 * @returns Transaction signature
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

  // Wait for transaction confirmation
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Memo transaction failed: ${confirmation.value.err}`);
  }

  return signature;
}

/**
 * Send memo transaction with retry mechanism
 * @param connection Solana connection object
 * @param transaction Signed transaction
 * @param maxRetries Maximum number of retries
 * @param retryDelay Retry interval (ms)
 * @returns Transaction signature
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
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Wait briefly if not the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  throw new Error(`All ${maxRetries + 1} memo transaction attempts failed: ${lastError!.message}`);
}

/**
 * Extract message from memo transaction
 * @param connection Solana connection object
 * @param signature Transaction signature
 * @returns Memo message or null
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

    // Find memo program instruction
    const memoInstruction = transaction.transaction.message.compiledInstructions.find(
      instruction => {
        const programId = transaction.transaction.message.staticAccountKeys[instruction.programIdIndex];
        return programId.equals(MEMO_PROGRAM_ID);
      }
    );

    if (!memoInstruction || !memoInstruction.data) {
      return null;
    }

    // Decode memo data
    const memoData = Buffer.from(memoInstruction.data);
    return memoData.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Validate protocol
 * @param protocol Protocol string
 * @returns Whether protocol is valid
 */
export function isValidProtocol(protocol: string): protocol is SupportedProtocol {
  return protocol in SUPPORTED_PROTOCOLS;
}

/**
 * Validate message type
 * @param type Message type string
 * @returns Whether message type is valid
 */
export function isValidMessageType(type: string): type is MessageType {
  return ['BUY', 'SELL', 'CHAT'].includes(type);
}

/**
 * Validate memo message
 * @param message Memo message
 * @returns Validation result
 */
export function validateMemoMessage(message: string): {
  isValid: boolean;
  errors: string[];
  parsed?: MemoMessage;
} {
  const errors: string[] = [];

  if (!message || message.trim().length === 0) {
    errors.push('Message is empty');
    return { isValid: false, errors };
  }

  if (message.length > 566) { // Solana memo maximum size
    errors.push('Message is too long (maximum 566 bytes)');
  }

  try {
    const parsed = parseMemoMessage(message);

    if (parsed.type !== 'CHAT') {
      if (!parsed.tokenSymbol) {
        errors.push('Trade message requires token symbol');
      }

      if (parsed.quantity !== undefined && (isNaN(parsed.quantity) || parsed.quantity <= 0)) {
        errors.push('Invalid quantity');
      }

      if (parsed.price !== undefined && (isNaN(parsed.price) || parsed.price <= 0)) {
        errors.push('Invalid price');
      }

      if (parsed.protocol && !isValidProtocol(parsed.protocol)) {
        errors.push('Unsupported protocol');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsed: errors.length === 0 ? parsed : undefined,
    };
  } catch {
    errors.push('Message parsing failed');
    return { isValid: false, errors };
  }
} 