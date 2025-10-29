'use client';

import { useState, useMemo as useReactMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useChatMessages, addMessage } from '@/hooks/useChatMessages';
import { useMemo } from '@/hooks/useMemoTransaction';
import { useTradeSettings } from '@/contexts/TradeSettingsContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TOKENS, formatTokenAmount } from '@/lib/tokens';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { confirmTransactionHybrid } from '@/lib/transaction-confirmation';

// 🎯 Fee settings
const FEE_RECIPIENT_ADDRESS = 'AmDH1y39wJGjmnUqijMuui3nvYq2E2m2WHU6Ssnc2hYL';
const FEE_RATE = 0.0069; // 0.69%
const PLATFORM_FEE_BPS = Math.round(FEE_RATE * 10000); // 69 bps

const FEE_RECIPIENT_PUBKEY = new PublicKey(FEE_RECIPIENT_ADDRESS);
const PLATFORM_FEE_ACCOUNT_CACHE = new Map<string, string | null>();

type Props = {
  roomId: string;
};

const MEMO_BYTE_LIMIT = 120;
const PACKET_DATA_SIZE_LIMIT = 1232; // Solana message size soft limit for packets

function truncateMemoByBytes(memo: string, limit = MEMO_BYTE_LIMIT) {
  const encoder = new TextEncoder();
  const memoBytes = encoder.encode(memo);

  if (memoBytes.byteLength <= limit) {
    return memo;
  }

  const ellipsis = '...';
  const ellipsisBytes = encoder.encode(ellipsis);
  const allowedBytes = Math.max(limit - ellipsisBytes.byteLength, 0);

  let truncated = '';
  let usedBytes = 0;

  for (const char of memo) {
    const charBytes = encoder.encode(char);
    if (usedBytes + charBytes.byteLength > allowedBytes) {
      break;
    }
    truncated += char;
    usedBytes += charBytes.byteLength;
  }

  return `${truncated}${ellipsis}`;
}

// Memo instruction creation function
function createMemoInstruction(memo: string, signer: PublicKey) {
  // Limit memo to byte units to prevent transaction size increase
  const truncatedMemo = truncateMemoByBytes(memo);

  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    data: Buffer.from(truncatedMemo, 'utf8'),
  });
}

// 🎯 Fee instruction factory
function createFeeInstruction(fromPubkey: PublicKey, feeAmount: number) {
  if (feeAmount <= 0) {
    return null;
  }

  return SystemProgram.transfer({
    fromPubkey,
    toPubkey: new PublicKey(FEE_RECIPIENT_ADDRESS),
    lamports: feeAmount,
  });
}

async function resolvePlatformFeeAccount(
  connection: Connection,
  mintAddress: string
): Promise<string | null> {
  const cached = PLATFORM_FEE_ACCOUNT_CACHE.get(mintAddress);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const mintKey = new PublicKey(mintAddress);
    const ata = getAssociatedTokenAddressSync(mintKey, FEE_RECIPIENT_PUBKEY);
    const accountInfo = await connection.getParsedAccountInfo(ata);
    const data = accountInfo.value?.data as
      | { program: string; parsed?: { info?: { mint?: string; owner?: string } } }
      | undefined;

    if (
      accountInfo.value &&
      data?.program === 'spl-token' &&
      data.parsed?.info?.mint === mintAddress &&
      data.parsed?.info?.owner === FEE_RECIPIENT_ADDRESS
    ) {
      const ataAddress = ata.toBase58();
      PLATFORM_FEE_ACCOUNT_CACHE.set(mintAddress, ataAddress);
      return ataAddress;
    }
  } catch (resolveError) {
    console.warn('Platform fee account resolution failed', resolveError);
  }

  PLATFORM_FEE_ACCOUNT_CACHE.set(mintAddress, null);
  return null;
}

export default function ChatInput({ roomId }: Props) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { sendMessage } = useChatMessages(roomId);
  const { settings } = useTradeSettings();
  const { connected, publicKey, signTransaction } = useWallet();
  const {
    sendChatMessage,
    error,
    clearError,
  } = useMemo();

  // 🎯 Solana connection settings (automatic Connection Pool usage via proxy)
  const connection = useReactMemo(() => {
    // Browser environment: use Connection Pool automatically via proxy
    if (typeof window !== 'undefined') {
      return new Connection(
        `${window.location.origin}/api/solana-rpc`,
        {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 90000,
          disableRetryOnRateLimit: true,
          wsEndpoint: undefined, // WebSocket disabled
        }
      );
    }

    // Server environment (fallback)
    return new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/CLIspK_3J2GVAuweafRIUoHzWjyn07rz',
      {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 90000,
        wsEndpoint: undefined,
        disableRetryOnRateLimit: true,
      }
    );
  }, []);

  // Default token address constants
  const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';
  const USDC_TOKEN_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  // 🚀 Token pair information calculation (utilizing selectedToken from TradeSettingsContext)
  const getTokenPairInfo = () => {
    const selectedToken = settings.selectedToken;
    
    if (!selectedToken) {
      // Default: SOL ↔ USDC
      return {
        inputMint: settings.mode === 'buy' ? SOL_TOKEN_ADDRESS : USDC_TOKEN_ADDRESS,
        outputMint: settings.mode === 'buy' ? USDC_TOKEN_ADDRESS : SOL_TOKEN_ADDRESS,
        inputTokenInfo: TOKENS[settings.mode === 'buy' ? 'SOL' : 'USDC'],
        outputTokenInfo: TOKENS[settings.mode === 'buy' ? 'USDC' : 'SOL'],
        inputDecimals: settings.mode === 'buy' ? 9 : 6,
        buttonText: settings.mode === 'buy' ? 'BUY USDC' : 'SELL SOL'
      };
    }

          // Using selected token: SOL ↔ selected token

          // 🚀 Token symbol extraction (separating actual token symbol from chat room name)
    const extractTokenSymbol = (name: string) => {
      // "USDC Trading Room" → "USDC"
      // "BONK Coin Chat" → "BONK"
              // "SOL/USDC Room" → "USDC" (last token)
      const words = name.split(' ');
      const firstWord = words[0];

              // Common token symbols are 2-10 uppercase characters
      if (firstWord && firstWord.length <= 10 && /^[A-Z0-9]+$/.test(firstWord)) {
        return firstWord;
      }

              // Use last 4 characters of contractAddress if failed
      return selectedToken.contractAddress.slice(-4).toUpperCase();
    };

    const tokenSymbol = selectedToken.symbol || extractTokenSymbol(selectedToken.name);

    // 🔧 Default to 6 decimals (will be updated from chain data in Sell mode)
    const customTokenInfo = {
      address: selectedToken.contractAddress,
      symbol: tokenSymbol,
      name: selectedToken.name,
      decimals: 6, // Default, will be overridden with actual value from chain
    };

    return {
      inputMint: settings.mode === 'buy' ? SOL_TOKEN_ADDRESS : selectedToken.contractAddress,
      outputMint: settings.mode === 'buy' ? selectedToken.contractAddress : SOL_TOKEN_ADDRESS,
      inputTokenInfo: settings.mode === 'buy' ? TOKENS.SOL : customTokenInfo,
      outputTokenInfo: settings.mode === 'buy' ? customTokenInfo : TOKENS.SOL,
      inputDecimals: settings.mode === 'buy' ? 9 : 6, // Default 6, will be updated from chain
      buttonText: settings.mode === 'buy' ? `BUY ${tokenSymbol}` : `SELL ${tokenSymbol}`
    };
  };

  // 📝 Chat message sending
      const handleChatSubmit = async () => {
      if (!message.trim() || isLoading) return;
  
      // Wallet connection check
      if (!connected) {
        toast.error('Please connect your wallet first');
        return;
      }

    setIsLoading(true);
    clearError();
    
    try {
              // Send chat message via actual memo transaction
      const result = await sendChatMessage(message);
      
              // Also add to local chat state
      sendMessage(message);
      
              // ✅ Extract real-time memo based on signature
      if (result.signature) {
      }
      
      setMessage('');
      clearError();
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 Execute actual swap (using selected token pair)
  const handleTradeSubmit = async () => {
    if (!settings.quantity || isLoading || !connected || !publicKey || !signTransaction) return;

          // Wallet connection check
      if (!connected) {
        toast.error('Please connect your wallet first');
        return;
      }

          // 🔑 Save memo content at swap start (before clearing input field)
      const memoText = message.trim();

    setIsLoading(true);

    try {
      // Parse quantity (units are displayed separately, so quantity is just the number)
      let quantity = parseFloat(settings.quantity);

      if (isNaN(quantity) || quantity <= 0) {
        toast.error('Please enter a valid quantity');
        setIsLoading(false);
        return;
      }

              // 🚀 Get dynamic token pair information
      const tokenPairInfo = getTokenPairInfo();
      
              // 🔄 Convert percentage to actual token quantity in Sell mode
      if (settings.mode === 'sell') {
        if (quantity > 100) {
          toast.error('Percentage cannot exceed 100%');
          setIsLoading(false);
          return;
        }
        
        try {
          // Query current token balance
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            mint: new PublicKey(tokenPairInfo.inputMint)
          });

          if (tokenAccounts.value.length === 0) {
            toast.error('No balance for this token');
            setIsLoading(false);
            return;
          }

          const tokenAccountData = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
          const tokenBalance = tokenAccountData.uiAmount;

          // 🔧 CRITICAL: Get actual token decimals from account data
          const actualDecimals = tokenAccountData.decimals;

          // Update inputDecimals with actual value from chain if different
          if (actualDecimals !== tokenPairInfo.inputDecimals) {
            // Update the inputDecimals value for amount calculation
            tokenPairInfo.inputDecimals = actualDecimals;
          }

          if (!tokenBalance || tokenBalance <= 0) {
            toast.error('Insufficient token balance');
            setIsLoading(false);
            return;
          }

          // Convert percentage to actual quantity
          quantity = (tokenBalance * quantity) / 100;
          
        } catch {
          toast.error('Unable to retrieve token balance');
          setIsLoading(false);
          return;
        }
      }

              // Calculate amount
      const amount = Math.floor(quantity * Math.pow(10, tokenPairInfo.inputDecimals));

              // 🎯 Get settings from TradeSettingsPanel Presets
      const slippageBps = Math.floor(parseFloat(settings.slippage) * 100); // % to bps conversion
      const priorityFeeLamports = Math.floor(parseFloat(settings.priorityFee) * 1e9); // SOL to lamports conversion

      let platformFeeAccount: string | null = null;
      if (PLATFORM_FEE_BPS > 0) {
        platformFeeAccount = await resolvePlatformFeeAccount(connection, tokenPairInfo.outputMint);
        if (!platformFeeAccount) {
          console.warn(
            `Platform fee account unavailable for mint ${tokenPairInfo.outputMint}. Jupiter platform fee disabled.`
          );
        }
      }

              // 1) Request Quote from Jupiter API (applying Presets slippage)
      toast.loading("Getting quote...", { id: 'swap' });
      
      const quoteParams = new URLSearchParams({
        inputMint: tokenPairInfo.inputMint,
        outputMint: tokenPairInfo.outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
      });

      if (platformFeeAccount) {
        quoteParams.set('platformFeeBps', PLATFORM_FEE_BPS.toString());
      }

      const quoteRes = await fetch(`https://lite-api.jup.ag/swap/v1/quote?${quoteParams.toString()}`);
      const quote = await quoteRes.json();
      
              // Check if Quote has errors
      if (quote.error) {
        toast.error(`Quote failed: ${quote.error}`, { id: 'swap' });
        return;
      }
      toast.loading("Preparing swap transaction...", { id: 'swap' });
      
      const swapPayload: Record<string, unknown> = {
        quoteResponse: quote,
        userPublicKey: publicKey.toBase58(),
        prioritizationFeeLamports: priorityFeeLamports, // Presets priority fee applied
      };

      if (platformFeeAccount) {
        swapPayload.feeAccount = platformFeeAccount;
      }

      const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapPayload),
      });
      const swapData = await swapRes.json();

              // Check if Swap response has errors
      if (swapData.error) {
        toast.error(`Swap request failed: ${swapData.error}`, { id: 'swap' });
        return;
      }

              // Check if swapTransaction exists
      if (!swapData.swapTransaction) {
        toast.error('Swap transaction data not available', { id: 'swap' });
        return;
      }

              // 2) Decode received swapTransaction (Transaction)
      const swapTxBuf = Buffer.from(swapData.swapTransaction, 'base64');
      let isVersionedSwap = false;
      let legacyTransaction: Transaction | null = null;
      let versionedTransaction: VersionedTransaction | null = null;
      let lookupTableAccounts: AddressLookupTableAccount[] = [];
      let versionedOriginalInstructions: TransactionInstruction[] = [];
      let legacyOriginalInstructions: TransactionInstruction[] = [];

      try {
        const possibleVersioned = VersionedTransaction.deserialize(swapTxBuf);
        if (possibleVersioned.version !== 'legacy') {
          isVersionedSwap = true;
          versionedTransaction = possibleVersioned;
        } else {
          legacyTransaction = Transaction.from(swapTxBuf);
          legacyOriginalInstructions = [...legacyTransaction.instructions];
        }
      } catch (parseError) {
        try {
          legacyTransaction = Transaction.from(swapTxBuf);
          legacyOriginalInstructions = [...legacyTransaction.instructions];
        } catch (legacyError) {
          throw new Error(
            `Failed to parse swap transaction: ${legacyError instanceof Error ? legacyError.message : String(legacyError)}`
          );
        }
      }

      if (isVersionedSwap && versionedTransaction) {
        const tableAddressSet = new Set<string>();

        for (const lookup of versionedTransaction.message.addressTableLookups) {
          tableAddressSet.add(lookup.accountKey.toBase58());
        }

        if (Array.isArray(swapData.lookupTableAddresses)) {
          for (const address of swapData.lookupTableAddresses as string[]) {
            tableAddressSet.add(address);
          }
        }

        if (tableAddressSet.size > 0) {
          const fetchedTables = await Promise.all(
            Array.from(tableAddressSet).map(async (address) => {
              const lookup = await connection.getAddressLookupTable(new PublicKey(address));
              if (!lookup.value) {
                throw new Error(`Missing address lookup table: ${address}`);
              }
              return lookup.value;
            })
          );

          lookupTableAccounts = fetchedTables;
        }

        const decompiledMessage = TransactionMessage.decompile(
          versionedTransaction.message,
          lookupTableAccounts.length
            ? { addressLookupTableAccounts: lookupTableAccounts }
            : undefined
        );
        versionedOriginalInstructions = [...decompiledMessage.instructions];
      }

              // 🎯 Fee processing (applied to both Buy/Sell modes)
      let feeAmount = 0;

      if (settings.mode === 'buy') {
        const solAmount = quantity; // quantity already represents SOL in buy mode
        feeAmount = Math.floor(solAmount * FEE_RATE * 1e9);

        // 💰 Buy 모드: SOL 잔액 확인
        try {
          const balance = await connection.getBalance(publicKey);

          // 🔑 Rent-exempt balance for potential new token accounts
          const RENT_EXEMPT_BALANCE = 2039280; // ~0.00203928 SOL per account
          const TRANSACTION_FEE_BUFFER = 5000000; // 0.005 SOL for transaction fees

          // Check if output token account exists
          let needsOutputTokenAccount = false;
          try {
            const outputTokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
              mint: new PublicKey(tokenPairInfo.outputMint)
            });
            needsOutputTokenAccount = outputTokenAccounts.value.length === 0;
          } catch (checkError) {
            // Assume we need to create account if check fails
            needsOutputTokenAccount = true;
          }

          const rentCost = needsOutputTokenAccount ? RENT_EXEMPT_BALANCE : 0;
          const requiredSol = solAmount * 1e9 + feeAmount + rentCost + TRANSACTION_FEE_BUFFER;

          if (balance < requiredSol) {
            const breakdown = needsOutputTokenAccount
              ? `Swap: ${solAmount.toFixed(6)} SOL + Fee: ${(feeAmount / 1e9).toFixed(6)} SOL + Rent: ${(rentCost / 1e9).toFixed(6)} SOL + Buffer: ${(TRANSACTION_FEE_BUFFER / 1e9).toFixed(6)} SOL`
              : `Swap: ${solAmount.toFixed(6)} SOL + Fee: ${(feeAmount / 1e9).toFixed(6)} SOL + Buffer: ${(TRANSACTION_FEE_BUFFER / 1e9).toFixed(6)} SOL`;

            toast.error(
              `Insufficient SOL: Need ${(requiredSol / 1e9).toFixed(6)} SOL but have ${(balance / 1e9).toFixed(6)} SOL. ${breakdown}`,
              { id: 'swap', duration: 5000 }
            );
            setIsLoading(false);
            return;
          }
        } catch (balanceError) {
          // Silent fail
        }
      } else {
        // Sell mode: approximate fee based on expected SOL output
        const expectedOutputSol = parseFloat(formatTokenAmount(quote.outAmount, 9));
        if (!Number.isNaN(expectedOutputSol)) {
          feeAmount = Math.floor(expectedOutputSol * FEE_RATE * 1e9);
        }

        // 💰 Sell 모드: 토큰 잔액 확인 (가장 중요!)
        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            mint: new PublicKey(tokenPairInfo.inputMint)
          });

          const inputAmount = parseFloat(formatTokenAmount(quote.inAmount, tokenPairInfo.inputDecimals));

          if (tokenAccounts.value.length === 0) {
            toast.error(
              `No ${tokenPairInfo.inputTokenInfo.symbol} token account found`,
              { id: 'swap' }
            );
            setIsLoading(false);
            return;
          }

          const tokenBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;

          if (!tokenBalance || tokenBalance < inputAmount) {
            toast.error(
              `Insufficient ${tokenPairInfo.inputTokenInfo.symbol}: You need ${inputAmount.toFixed(6)} but only have ${tokenBalance?.toFixed(6) || 0}`,
              { id: 'swap' }
            );
            setIsLoading(false);
            return;
          }
        } catch (tokenBalanceError) {
          // Continue (will be checked again in simulation)
        }

        // 💰 Sell 모드: 트랜잭션 수수료용 SOL 확인
        try {
          const balance = await connection.getBalance(publicKey);

          // 🔑 Rent-exempt balance for potential new token accounts
          // Jupiter may create associated token accounts which require rent
          const RENT_EXEMPT_BALANCE = 2039280; // ~0.00203928 SOL per account
          const TRANSACTION_FEE_BUFFER = 10000000; // 0.01 SOL for transaction fees + buffer

          // Check if output token account exists
          let needsOutputTokenAccount = false;
          try {
            const outputTokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
              mint: new PublicKey(tokenPairInfo.outputMint)
            });
            needsOutputTokenAccount = outputTokenAccounts.value.length === 0;
          } catch (checkError) {
            // Assume we need to create account if check fails
            needsOutputTokenAccount = true;
          }

          const rentCost = needsOutputTokenAccount ? RENT_EXEMPT_BALANCE : 0;

          // 🔧 CRITICAL: In Sell mode, the platform fee is deducted BEFORE the swap
          // This means we need MORE SOL than expected to cover:
          // 1. Platform fee (deducted first from wallet)
          // 2. Rent for new token account
          // 3. Transaction fees
          // The swap itself uses the token balance, not SOL
          const requiredSol = feeAmount + rentCost + TRANSACTION_FEE_BUFFER;

          if (balance < requiredSol) {
            const breakdown = needsOutputTokenAccount
              ? `Platform fee: ${(feeAmount / 1e9).toFixed(6)} SOL + Rent: ${(rentCost / 1e9).toFixed(6)} SOL + Buffer: ${(TRANSACTION_FEE_BUFFER / 1e9).toFixed(6)} SOL`
              : `Platform fee: ${(feeAmount / 1e9).toFixed(6)} SOL + Buffer: ${(TRANSACTION_FEE_BUFFER / 1e9).toFixed(6)} SOL`;

            toast.error(
              `Insufficient SOL: Need ${(requiredSol / 1e9).toFixed(6)} SOL but have ${(balance / 1e9).toFixed(6)} SOL. ${breakdown}`,
              { id: 'swap', duration: 5000 }
            );
            setIsLoading(false);
            return;
          }
        } catch (balanceError) {
          // Silent fail
        }
      }

              // Replace with latest blockhash (including retry logic)
      toast.loading("Connecting to blockchain...", { id: 'swap' });

      let blockhash;
      let retryCount = 0;
      const maxRetries = 3;
      
              // 🚀 Use stable connection dedicated to blockhash
      let stableConnection;
      
      while (retryCount < maxRetries) {
        try {
          // 🎯 Use Helius connection with WebSocket support
          const { createHeliusConnection } = await import('@/lib/solana');
          stableConnection = createHeliusConnection();

          // Use more stable 'finalized' commitment
          const latestBlockhash = await stableConnection.getLatestBlockhash('finalized');
          blockhash = latestBlockhash.blockhash;
          break;
        } catch (rpcError: unknown) {
          retryCount++;

          if (retryCount >= maxRetries) {
            const errorMessage = rpcError instanceof Error ? rpcError.message : String(rpcError);
            throw new Error(`Blockchain connection failed: ${errorMessage}`);
          }

          // Brief wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }

      if (!blockhash || !stableConnection) {
        throw new Error('Failed to retrieve blockhash');
      }

      const feeInstruction = createFeeInstruction(publicKey, feeAmount);
      const memoInstruction = memoText ? createMemoInstruction(memoText, publicKey) : null;
      let transactionForSigning: VersionedTransaction | Transaction;
      const auxiliaryInstructions: TransactionInstruction[] = [];

      if (isVersionedSwap && versionedTransaction) {
        let instructionsForSwap = [...versionedOriginalInstructions];
        if (feeInstruction) {
          instructionsForSwap = [feeInstruction, ...instructionsForSwap];
        }
        if (memoInstruction) {
          instructionsForSwap = [...instructionsForSwap, memoInstruction];
        }

        let useAuxiliaryTransaction = false;

        let messageForSwap = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: versionedOriginalInstructions,
        }).compileToV0Message(
          lookupTableAccounts.length ? lookupTableAccounts : undefined
        );

        if (feeInstruction || memoInstruction) {
          const candidateMessage = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: blockhash,
            instructions: instructionsForSwap,
          }).compileToV0Message(
            lookupTableAccounts.length ? lookupTableAccounts : undefined
          );

          const candidateSize = candidateMessage.serialize().length;

          if (candidateSize >= PACKET_DATA_SIZE_LIMIT) {
            useAuxiliaryTransaction = true;
          } else {
            messageForSwap = candidateMessage;
          }
        }

        transactionForSigning = new VersionedTransaction(messageForSwap);

        if (useAuxiliaryTransaction) {
          if (feeInstruction) {
            auxiliaryInstructions.push(feeInstruction);
          }
          if (memoInstruction) {
            auxiliaryInstructions.push(memoInstruction);
          }
        }
      } else if (legacyTransaction) {
        legacyTransaction.instructions = [...legacyOriginalInstructions];

        if (feeInstruction) {
          legacyTransaction.instructions.unshift(feeInstruction);
        }
        if (memoInstruction) {
          legacyTransaction.instructions.push(memoInstruction);
        }

        let useAuxiliaryTransaction = false;

        const messageSize = legacyTransaction.serializeMessage().length;

        if (messageSize >= PACKET_DATA_SIZE_LIMIT) {
          useAuxiliaryTransaction = true;
          legacyTransaction.instructions = [...legacyOriginalInstructions];
        }

        if (useAuxiliaryTransaction) {
          if (feeInstruction) {
            auxiliaryInstructions.push(feeInstruction);
          }
          if (memoInstruction) {
            auxiliaryInstructions.push(memoInstruction);
          }
        }

        legacyTransaction.recentBlockhash = blockhash;
        legacyTransaction.feePayer = publicKey; // explicitly specify if not set
        transactionForSigning = legacyTransaction;
      } else {
        throw new Error('Failed to prepare swap transaction');
      }

      // Calculate and display swap information
      const inputAmount = formatTokenAmount(quote.inAmount, tokenPairInfo.inputTokenInfo.decimals);
      const outputAmount = formatTokenAmount(quote.outAmount, tokenPairInfo.outputTokenInfo.decimals);

      // Swap execution toast
      toast.loading(`swap ${inputAmount} ${tokenPairInfo.inputTokenInfo.symbol} → ${outputAmount} ${tokenPairInfo.outputTokenInfo.symbol}`, { id: 'swap' });

      // 🔧 CRITICAL FIX: Refresh blockhash right before signing to prevent expiration
      try {
        const freshBlockhash = await stableConnection.getLatestBlockhash('finalized');
        blockhash = freshBlockhash.blockhash;

        // Update transaction with fresh blockhash
        if (transactionForSigning instanceof Transaction) {
          transactionForSigning.recentBlockhash = blockhash;
        }
      } catch (refreshError) {
        // Continue with existing blockhash if refresh fails
      }

      // 4) Sign and send transaction (using same connection)
      const signedTransaction = await signTransaction(
        transactionForSigning as Parameters<typeof signTransaction>[0]
      );

      const txId = await stableConnection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'finalized', // use same commitment as blockhash
        maxRetries: 3,
      });

      let auxiliaryTxId: string | null = null;

      if (auxiliaryInstructions.length > 0) {
        try {
          const auxiliaryTransaction = new Transaction();
          auxiliaryTransaction.add(...auxiliaryInstructions);
          auxiliaryTransaction.recentBlockhash = blockhash;
          auxiliaryTransaction.feePayer = publicKey;

          const signedAuxiliaryTransaction = await signTransaction(
            auxiliaryTransaction as Parameters<typeof signTransaction>[0]
          );

          auxiliaryTxId = await stableConnection.sendRawTransaction(
            signedAuxiliaryTransaction.serialize(),
            {
              skipPreflight: false,
              preflightCommitment: 'finalized',
              maxRetries: 3,
            }
          );
        } catch (auxError) {
          // Silent fail
        }
      }

      // 5) Transaction confirmation and chat bubble display
      toast.loading("Confirming transaction...", { id: 'swap' });

      // Transaction confirmation using Hybrid approach (WebSocket + Polling)
      let confirmed = false;

      try {
        confirmed = await confirmTransactionHybrid(stableConnection, txId, {
          timeout: 30000,
          commitment: 'confirmed',
          useWebSocket: true
        });
      } catch (confirmError) {
        // Continue even if confirmation fails (transaction might still be valid)
      }
      
      // Display chat bubble after transaction confirmation
      if (confirmed) {
        try {
          // Calculate actual SOL amount traded (always save in SOL basis)
          let actualSolAmount: string;
          if (settings.mode === 'buy') {
            // Buy mode: input SOL amount
            actualSolAmount = quantity.toString();
          } else {
            // Sell mode: received SOL amount (outputAmount)
            actualSolAmount = outputAmount;
          }

          // Use addMessage directly to include txHash and immediately display memo text
          const messageData = {
            userId: 'user1',
            userAddress: publicKey?.toString() || 'Unknown',
            avatar: '🎉',
            tradeType: settings.mode as 'buy' | 'sell',
            tradeAmount: actualSolAmount, // always SOL basis
            content: memoText || '', // save only user-entered memo text
            txHash: auxiliaryTxId || txId, // include transaction hash
          };

          await addMessage(roomId, messageData);
        } catch (msgError) {
          // Silent fail
        }
        
        // Simple success toast
        toast.success(
          `Swap successful! Check on Solscan`,
          { 
            id: 'swap',
            duration: 3000,
            action: {
              label: 'View',
              onClick: () => window.open(`https://solscan.io/tx/${txId}`, '_blank')
            }
          }
        );

      } else {
        // Transaction confirmation failed or timed out
        // Do not create chat bubble for unconfirmed transactions
        toast.error(
          'Transaction confirmation failed or timed out',
          {
            id: 'swap',
            action: {
              label: 'Check on Solscan',
              onClick: () => window.open(`https://solscan.io/tx/${txId}`, '_blank')
            }
          }
        );
      }
      
      // ✅ Clear input field after completion
      setMessage('');
      clearError();

    } catch (err: unknown) {
      let errorMessage = 'An error occurred during swap execution';
      const errorString = err instanceof Error ? err.message : String(err);

      if (err instanceof SendTransactionError) {
        try {
          // Retrieve detailed logs from the failed transaction for easier debugging
          const logs = await err.getLogs(connection);

          // 🎯 Jupiter 에러 코드 파싱
          const jupiterErrorLog = logs.find(log => log.includes('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 failed'));

          if (jupiterErrorLog) {
            // 에러 코드 추출 (예: 0x1788)
            const errorCodeMatch = jupiterErrorLog.match(/error: (0x[0-9a-fA-F]+)/);
            if (errorCodeMatch) {
              const errorCode = errorCodeMatch[1];
              const errorCodeDec = parseInt(errorCode, 16);

              // 🔍 알려진 Jupiter 에러 코드 매핑 (Jupiter Documentation 기반)
              if (errorCode === '0x1788' || errorCodeDec === 6024) {
                errorMessage = 'Insufficient funds: Not enough balance for swap, transaction fees, or rent. Please check your wallet balance.';
              } else if (errorCode === '0x1771' || errorCodeDec === 6001) {
                errorMessage = 'Slippage tolerance exceeded. Try increasing slippage or use dynamic slippage.';
              } else if (errorCode === '0x1779' || errorCodeDec === 6009) {
                errorMessage = 'Token ledger not found. The token account may not exist.';
              } else if (errorCode === '0x177e' || errorCodeDec === 6014) {
                errorMessage = 'Incorrect token program: Cannot charge platform fees on Token2022 tokens.';
              } else if (errorCode === '0x1781' || errorCodeDec === 6017) {
                errorMessage = 'Exact output amount not matched. Similar to slippage issue.';
              } else if (errorCode === '0x1789' || errorCodeDec === 6025) {
                errorMessage = 'Invalid token account. Please check the token accounts.';
              } else {
                errorMessage = `Jupiter swap failed with error code ${errorCode} (decimal: ${errorCodeDec}). Check Jupiter docs for details.`;
              }
            }
          }

          // 기본 로그 기반 에러 메시지 (Jupiter 에러가 아닌 경우)
          if (errorMessage === 'An error occurred during swap execution') {
            const lastLog = [...logs].reverse().find((log) => log.trim().length > 0);
            if (lastLog) {
              errorMessage = lastLog;
            } else {
              const transactionError = err.transactionError;
              if (transactionError?.message) {
                errorMessage = transactionError.message;
              }
            }
          }
        } catch (logError) {
          // Silent fail
        }
      }

      // 일반 에러 메시지 처리
      if (errorMessage === 'An error occurred during swap execution') {
        if (errorString.includes('403') || errorString.includes('Forbidden')) {
          errorMessage = 'RPC server access is restricted. Please try again later.';
        } else if (errorString.includes('blockhash')) {
          errorMessage = 'Blockchain connection failed. Please check your network.';
        } else if (errorString.includes('insufficient')) {
          errorMessage = 'Insufficient balance.';
        } else if (errorString.includes('0x1')) {
          // 0x로 시작하는 에러 코드 감지
          const hexMatch = errorString.match(/0x[0-9a-fA-F]+/);
          if (hexMatch) {
            errorMessage = `Transaction failed with error code ${hexMatch[0]}`;
          } else {
            errorMessage = errorString;
          }
        } else if (errorString) {
          errorMessage = errorString;
        }
      }

      toast.error(errorMessage, { id: 'swap' });
    } finally {
      setIsLoading(false);
    }
  };

  // Form submission handling (chat messages only)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Send as chat message if message exists
    if (message.trim()) {
      await handleChatSubmit();
    }
  };

  // Check if trade information is complete
  const isTradeReady = settings.quantity && connected && publicKey && signTransaction;

  return (
    <div className="space-y-2">
      {/* Error display */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 h-9">
        <Input 
          placeholder="Enter message (optional)..." 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 text-sm border-0 focus:ring-0 rounded-none bg-[oklch(0.2393_0_0)] text-white placeholder:text-gray-300 transition-all duration-200 px-3 py-1 h-9"
          style={{ boxShadow: 'none' }}
          disabled={isLoading}
        />
        
        {/* 🚀 Actual swap execution button (dynamic text) */}
        <button
          onClick={handleTradeSubmit}
          disabled={!isTradeReady || isLoading}
          className={`group relative px-4 md:px-8 py-1 font-semibold rounded-none border-0 overflow-hidden transition-all duration-200 md:min-w-32 ${
            settings.mode === 'buy' 
              ? 'bg-green-500 hover:bg-green-600 text-white' 
              : 'bg-red-500 hover:bg-red-600 text-white'
          } ${(!isTradeReady || isLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          style={{ height: '36px' }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              <span className="text-xs">Swapping...</span>
            </div>
          ) : (
            <>
                              {/* Default state: show only BUY/SELL */}
                <div className="flex items-center justify-center gap-1 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-white transition-all duration-300 group-hover:scale-[100.8]"></div>
                  <span className="font-bold text-xs">
                    {settings.mode === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                </div>
                
                {/* Hover state: SEND text and emoji */}
                <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center gap-1 translate-x-12 opacity-0 transition-all duration-300 group-hover:-translate-x-0 group-hover:opacity-100">
                  <span className="font-bold text-xs">SEND</span>
                  <span className="text-sm">🚀</span>
                </div>
            </>
          )}
        </button>
      </form>
    </div>
  );
} 
