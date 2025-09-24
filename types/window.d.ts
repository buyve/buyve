// Phantom 지갑 인터페이스 정의
interface PhantomWallet {
  isPhantom: boolean;
  publicKey: {
    toString(): string;
    toBytes(): Uint8Array;
  };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
  signTransaction(transaction: unknown): Promise<unknown>;
  signAllTransactions(transactions: unknown[]): Promise<unknown[]>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  removeListener(event: string, callback: (...args: unknown[]) => void): void;
}

// Window 객체에 solana 속성 추가
declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

export {}; 