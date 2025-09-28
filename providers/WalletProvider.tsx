'use client';

import React, { ReactNode, useMemo, useState, useEffect } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletProvider as CustomWalletProvider } from '@/contexts/WalletContext';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderWrapperProps {
    children: ReactNode;
}

export default function WalletProviderWrapper({ children }: WalletProviderWrapperProps) {
    const [isPopupMode, setIsPopupMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        return params.get('popup') === 'true';
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updatePopupState = () => {
            const params = new URLSearchParams(window.location.search);
            setIsPopupMode(params.get('popup') === 'true');
        };

        updatePopupState();

        window.addEventListener('popstate', updatePopupState);
        window.addEventListener('pushstate', updatePopupState as EventListener);
        window.addEventListener('replacestate', updatePopupState as EventListener);

        return () => {
            window.removeEventListener('popstate', updatePopupState);
            window.removeEventListener('pushstate', updatePopupState as EventListener);
            window.removeEventListener('replacestate', updatePopupState as EventListener);
        };
    }, []);

    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Mainnet;

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => {
        if (network === WalletAdapterNetwork.Mainnet) {
            // In browser, use proxy endpoint for better reliability
            if (typeof window !== 'undefined') {
                return `${window.location.origin}/api/solana-rpc`;
            }
            // Fallback for SSR or if proxy fails
            return process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
        }
        return clusterApiUrl(network);
    }, [network]);

    const wallets = useMemo(
        () => [
            // Phantom is automatically registered as Standard Wallet, so removed
            // new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [network]
    );

    return (
        <ConnectionProvider 
            endpoint={endpoint}
            config={{
                commitment: 'confirmed',
                wsEndpoint: endpoint.replace('http', 'ws'),
                httpHeaders: {
                    'Content-Type': 'application/json',
                }
            }}
        >
            <WalletProvider wallets={wallets} autoConnect={!isPopupMode}>
                <WalletModalProvider>
                    <CustomWalletProvider>
                        {children}
                    </CustomWalletProvider>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}

// Re-export hooks for convenience
export { useConnection } from '@solana/wallet-adapter-react';
export { useWalletModal } from '@solana/wallet-adapter-react-ui';
// Custom wallet hook with profile management
export { useWallet } from '@/contexts/WalletContext';
