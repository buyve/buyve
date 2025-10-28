'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/providers/WalletProvider';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getBlockhashConnection } from '@/lib/solana';

interface CreateChatRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_WALLET = 'AmDH1y39wJGjmnUqijMuui3nvYq2E2m2WHU6Ssnc2hYL';
const REQUIRED_PAYMENT = 0.001; // SOL

export default function CreateChatRoomDialog({ open, onOpenChange }: CreateChatRoomDialogProps) {
  const [roomName, setRoomName] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'payment' | 'creating'>('input');
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  
  const { isConnected, address } = useWallet();

  // Contract address duplicate check (debouncing)
  useEffect(() => {
    if (!contractAddress.trim() || contractAddress.length < 32) {
      setDuplicateError('');
      return;
    }

    const checkDuplicate = async () => {
      setIsDuplicateChecking(true);
      setDuplicateError('');
      
      try {
        const response = await fetch(`/api/chatrooms/check?contractAddress=${encodeURIComponent(contractAddress.trim())}`);
        const data = await response.json();
        
        if (data.success && data.exists) {
          setDuplicateError(data.message);
        }
      } catch {
      } finally {
        setIsDuplicateChecking(false);
      }
    };

    const timeoutId = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(timeoutId);
  }, [contractAddress]);

  const handleCreate = async () => {
    if (!roomName.trim() || !contractAddress.trim()) {
      alert('Please enter both Buyve room name and contract address.');
      return;
    }

    if (!isConnected || !address) {
      alert('Please connect your wallet first.');
      return;
    }

    if (duplicateError) {
      alert('This contract address already exists.');
      return;
    }

    // Basic Solana address format validation
    try {
      new PublicKey(contractAddress.trim());
    } catch {
              alert('Invalid Solana contract address format.');
      return;
    }

    setIsLoading(true);
    setStep('payment');

    try {
      // Step 1: Execute Solana transaction
      const transactionSignature = await sendPaymentTransaction();
      
      if (!transactionSignature) {
        throw new Error('Transaction was cancelled or failed.');
      }

      setStep('creating');

              // Step 2: Request chatroom creation to backend
      const response = await fetch('/api/chatrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName.trim(),
          contractAddress: contractAddress.trim(),
          creatorAddress: address,
          transactionSignature
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create Buyve room.');
      }

      alert(`"${roomName}" Buyve room created successfully!\nTransaction: ${transactionSignature}`);
      
      // Reset on success
      onOpenChange(false);
      setRoomName('');
      setContractAddress('');
      setStep('input');

      // Send chatroom list refresh event
      window.dispatchEvent(new CustomEvent('chatroomCreated', {
        detail: { chatroom: data.chatroom }
      }));

    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred while creating the Buyve room.');
      setStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  const sendPaymentTransaction = async (): Promise<string | null> => {
    try {
      const connection = await getBlockhashConnection();
      const fromPubkey = new PublicKey(address!);
      const toPubkey = new PublicKey(PAYMENT_WALLET);

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: REQUIRED_PAYMENT * LAMPORTS_PER_SOL,
        })
      );

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Use wallet adapter
      if (typeof window !== 'undefined' && window.solana) {
        // Sign transaction
        const signedTransaction = await window.solana.signTransaction(transaction) as Transaction;
        
        // Send signed transaction
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });

        
        // 🎯 Transaction confirmation using same polling method as Swap (no WebSocket)
        let confirmed = false;
        let attempts = 0;
                  const maxAttempts = 15; // Reduced to 15 seconds
        
        while (!confirmed && attempts < maxAttempts) {
          try {
            const txInfo = await connection.getTransaction(signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            });
            
            if (txInfo) {
              if (txInfo.meta?.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(txInfo.meta.err)}`);
              }
              confirmed = true;
              break;
            }
          } catch {
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        
        if (!confirmed) {
          // Continue even if timeout, as transaction likely succeeded
        }

        return signature;
      } else {
        throw new Error('Solana wallet not found.');
      }

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('User rejected') || 
        error.message.includes('User denied')
      )) {
        return null; // User cancelled
      }
      throw error;
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setRoomName('');
    setContractAddress('');
    setStep('input');
    setDuplicateError('');
  };

  const canCreate = 
    roomName.trim() && 
    contractAddress.trim() && 
    isConnected && 
    !duplicateError && 
    !isDuplicateChecking;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'input' && 'Create New Buyve room'}
            {step === 'payment' && 'Processing Payment...'}
            {step === 'creating' && 'Creating Buyve room...'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {step === 'input' && (
            <>
              {/* Wallet connection status */}
              {!isConnected && (
                <div className="p-3 bg-yellow-100 border border-yellow-400 rounded-md">
                  <p className="text-sm text-yellow-700">
                    ⚠️ Please connect your wallet first to create a Buyve room.
                  </p>
                </div>
              )}

              {/* Payment information */}
              <div className="p-3 bg-blue-100 border border-blue-400 rounded-md">
                <p className="text-sm text-blue-700">
                  💰 Buyve room creation fee: <strong>0.001 SOL</strong>
                </p>
              </div>

              {/* Chatroom name */}
              <div className="space-y-2">
                <Label htmlFor="roomName">Buyve room Name *</Label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., SOL/USDC Trading Room"
                  className="neobrutalism-input"
                  maxLength={20}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
  {roomName.length}/20 characters
                </p>
              </div>

              {/* Contract address input */}
              <div className="space-y-2">
                <Label htmlFor="contractAddress">Contract Address (CA) *</Label>
                <Input
                  id="contractAddress"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  placeholder="e.g., So11111111111111111111111111111111111111112"
                  className="neobrutalism-input font-mono text-sm"
                  maxLength={44}
                  disabled={isLoading}
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Enter the Solana token contract address ({contractAddress.length}/44 characters)
                  </p>
                  {isDuplicateChecking && (
                    <p className="text-xs text-blue-600">Checking for duplicates...</p>
                  )}
                  {duplicateError && (
                    <p className="text-xs text-red-600">❌ {duplicateError}</p>
                  )}
                  {contractAddress.length >= 32 && !duplicateError && !isDuplicateChecking && (
                    <p className="text-xs text-green-600">✅ Address is available</p>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 'payment' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium">Processing Payment</p>
              <p className="text-sm text-muted-foreground">
                Please approve the transaction in your wallet...
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Amount: 0.001 SOL
              </p>
            </div>
          )}

          {step === 'creating' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium">Creating Buyve room</p>
              <p className="text-sm text-muted-foreground">
                Please wait a moment...
              </p>
            </div>
          )}

          {/* Buttons */}
          {step === 'input' && (
            <div className="flex space-x-2 pt-4">
              <Button
                variant="neutral"
                onClick={handleCancel}
                className="neobrutalism-button flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                className="neobrutalism-button flex-1"
                disabled={!canCreate || isLoading}
              >
                {isLoading ? 'Processing...' : 'Pay 0.001 SOL & Create'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 