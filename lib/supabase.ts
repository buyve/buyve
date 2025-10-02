import { createClient } from '@supabase/supabase-js'

// Supabase에서 생성된 실제 Database 타입 정의
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chat_rooms: {
        Row: {
          id: string
          name: string
          description: string | null
          image: string | null
          token_address: string | null
          created_by: string
          member_count: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          image?: string | null
          token_address?: string | null
          created_by: string
          member_count?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          image?: string | null
          token_address?: string | null
          created_by?: string
          member_count?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      token_price_history: {
        Row: {
          id: string
          token_address: string
          price: number
          open_price: number
          high_price: number
          low_price: number
          close_price: number
          timestamp_1min: string
          volume: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          token_address: string
          price: number
          open_price: number
          high_price: number
          low_price: number
          close_price: number
          timestamp_1min: string
          volume?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          token_address?: string
          price?: number
          open_price?: number
          high_price?: number
          low_price?: number
          close_price?: number
          timestamp_1min?: string
          volume?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      message_cache: {
        Row: {
          block_time: string
          content: string
          message_type: Database["public"]["Enums"]["message_type_enum"]
          price: number | null
          processed_at: string | null
          quantity: number | null
          sender_wallet: string
          signature: string
          token_address: string
        }
        Insert: {
          block_time: string
          content: string
          message_type: Database["public"]["Enums"]["message_type_enum"]
          price?: number | null
          processed_at?: string | null
          quantity?: number | null
          sender_wallet: string
          signature: string
          token_address: string
        }
        Update: {
          block_time?: string
          content?: string
          message_type?: Database["public"]["Enums"]["message_type_enum"]
          price?: number | null
          processed_at?: string | null
          quantity?: number | null
          sender_wallet?: string
          signature?: string
          token_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_cache_token_address"
            columns: ["token_address"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["token_address"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          nickname: string | null
          avatar_url: string | null
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          nickname?: string | null
          avatar_url?: string | null
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          nickname?: string | null
          avatar_url?: string | null
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      message_type_enum: "BUY" | "SELL" | "CHAT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// 환경 변수 검증 및 로드
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // 빌드 타임에는 에러를 던지지 않고 빈 값 반환
  if (!url || !key) {
    console.warn('Supabase environment variables not found. Using empty values for build.')
    return { url: url || 'https://placeholder.supabase.co', key: key || 'placeholder-key' }
  }

  return { url, key }
}

// 서버 사이드 환경 변수 로드
function getSupabaseAdminConfig() {
  // 클라이언트 사이드에서는 admin config를 사용하지 않음
  if (typeof window !== 'undefined') {
    return null
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return null
  }

  try {
    // JWT 토큰 디코딩으로 role 확인
    const payload = JSON.parse(atob(serviceKey.split('.')[1]))
    
    if (payload.role !== 'service_role') {
      // 서비스 역할이 아닌 경우 에러 처리는 남김 (서버 오류 방지)
    }
  } catch {
    // 토큰 디코딩 실패시 무시
  }

  return { url, serviceKey }
}

// 런타임 환경 변수 검증 (실제 API 호출 시에만)
export function validateSupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder-key') {
    throw new Error('Supabase environment variables are not properly configured. Please check your .env.local file.')
  }
}

// 서버 사이드 관리자 검증
export function validateSupabaseAdminConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey || url === 'https://placeholder.supabase.co' || serviceKey === 'placeholder-service-key') {
    throw new Error('Supabase admin environment variables are not properly configured. Please check your .env.local file.')
  }
}

// 싱글톤 패턴으로 클라이언트 인스턴스 관리
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null
let supabaseAdminInstance: ReturnType<typeof createClient<Database>> | null = null

// 서버 사이드 관리용 클라이언트 (RLS 우회 가능)
export const supabaseAdmin = (() => {
  // 클라이언트 사이드에서는 admin 클라이언트를 생성하지 않음
  if (typeof window !== 'undefined') {
    return null as any
  }

  try {
    const adminConfig = getSupabaseAdminConfig()
    if (!adminConfig) {
      return null as any
    }

    if (!supabaseAdminInstance) {
      supabaseAdminInstance = createClient<Database>(
        adminConfig.url, 
        adminConfig.serviceKey, // 서비스 키 사용으로 RLS 우회
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
    }
    return supabaseAdminInstance
  } catch {
    return null as any
  }
})()

// Supabase 클라이언트 생성
export const supabase = (() => {
  try {
    const { url: supabaseUrl, key: supabaseAnonKey } = getSupabaseConfig()
    
    if (!supabaseInstance) {
      supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 50
          }
        }
      })
    }
    return supabaseInstance
  } catch {
    // 빌드 중 에러 처리
    return null as any
  }
})()

// 편의를 위한 타입 별칭
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ChatRoom = Database['public']['Tables']['chat_rooms']['Row']
export type MessageCache = Database['public']['Tables']['message_cache']['Row']
export type MessageType = Database['public']['Enums']['message_type_enum']

// 데이터베이스 타입 정의
export interface MessageCacheRow {
  signature: string;
  token_address: string;
  sender_wallet: string;
  message_type: 'BUY' | 'SELL' | 'CHAT';
  content: string;
  quantity?: number | null;
  price?: number | null;
  block_time: string;
  processed_at?: string | null;
}

export interface ChatRoomRow {
  token_address: string;
  room_name: string;
  creator_wallet: string;
  creation_tx_signature: string;
  created_at?: string;
}

export interface ProfileRow {
  wallet_address: string;
  nickname: string;
  created_at?: string;
  updated_at?: string;
}

// 타입이 적용된 Supabase 클라이언트 (기본 export)
export default supabase