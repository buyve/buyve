export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  image: string;
  token_address?: string;
  created_by: string;
  member_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_address: string;
  nickname?: string;
  avatar?: string;
  content: string;
  trade_type: 'buy' | 'sell';
  trade_amount?: string;
  tx_hash?: string;
  created_at: Date;
}

export interface CreateMessageRequest {
  content: string;
  trade_type: 'buy' | 'sell';
  trade_amount?: string;
  tx_hash?: string;
  user_address: string;
  nickname?: string;
  avatar?: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
  command: string;
} 