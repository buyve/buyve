export type Message = {
    id: string;
    roomId: string;
    sender: string;      // wallet addr (anonymised)
    side: 'buy' | 'sell';
    amount: number;
    memo: string;
    createdAt: string;   // ISO
  };
  