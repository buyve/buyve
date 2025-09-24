// 지갑 연결 관련 타입
export interface WalletState {
  isConnected: boolean;
  address?: string | null;
  balance?: number;
  network?: string;
  nickname?: string | null;
  avatar?: string;
}

// 사용자 프로필 타입
export interface UserProfile {
  id: string;
  address: string;
  nickname?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 채팅방 타입
export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  image: string;
  tokenAddress?: string;
  createdBy: string;
  memberCount: number;
  lastMessage?: ChatMessage;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 채팅 메시지 타입
export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userAddress: string;
  nickname?: string;
  avatar?: string;
  content: string;
  tradeType: 'buy' | 'sell';
  tradeAmount?: string;
  txHash?: string;
  timestamp: Date;
}

// 거래 설정 타입
export interface TradeSettings {
  mode: 'buy' | 'sell';
  amount: string;
  slippage: string;
  priorityFee: string;
  autoExecute: boolean;
}

// 거래 실행 타입
export interface TradeExecution {
  id: string;
  userId: string;
  roomId: string;
  messageId: string;
  type: 'buy' | 'sell';
  amount: string;
  price?: string;
  txHash?: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
  confirmedAt?: Date;
}

// API 응답 타입export interface ApiResponse<T = unknown> {  success: boolean;  data?: T;  error?: string;  message?: string;}

// 페이지네이션 타입
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// 이벤트 타입 (실시간 업데이트용)
export type WebSocketEvent = 
  | { type: 'NEW_MESSAGE'; payload: ChatMessage }
  | { type: 'TRADE_EXECUTED'; payload: TradeExecution }
  | { type: 'USER_JOINED'; payload: { roomId: string; user: UserProfile } }
  | { type: 'USER_LEFT'; payload: { roomId: string; userId: string } }
  | { type: 'ROOM_CREATED'; payload: ChatRoom }
  | { type: 'ROOM_UPDATED'; payload: ChatRoom };

// 폼 상태 타입export interface FormState<T = Record<string, unknown>> {  data: T;  errors: Record<string, string>;  isSubmitting: boolean;  isValid: boolean;}// 모달 상태 타입export interface ModalState {  isOpen: boolean;  type?: string;  data?: unknown;}

// 토스트/알림 타입
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
} 