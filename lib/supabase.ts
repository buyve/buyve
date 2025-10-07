import { createClient } from '@supabase/supabase-js'

// Actual Database type definition generated from Supabase
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

// Environment variable validation and loading
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Return empty values at build time without throwing error
  if (!url || !key) {
    console.warn('Supabase environment variables not found. Using empty values for build.')
    return { url: url || 'https://placeholder.supabase.co', key: key || 'placeholder-key' }
  }

  return { url, key }
}

// Server-side environment variable loading
function getSupabaseAdminConfig() {
  // Do not use admin config on client-side
  if (typeof window !== 'undefined') {
    return null
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return null
  }

  try {
    // Verify role by decoding JWT token
    const payload = JSON.parse(atob(serviceKey.split('.')[1]))

    if (payload.role !== 'service_role') {
      // Leave error handling for non-service roles (prevent server errors)
    }
  } catch {
    // Ignore token decoding failures
  }

  return { url, serviceKey }
}

// Runtime environment variable validation (only for actual API calls)
export function validateSupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder-key') {
    throw new Error('Supabase environment variables are not properly configured. Please check your .env.local file.')
  }
}

// Server-side admin validation
export function validateSupabaseAdminConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey || url === 'https://placeholder.supabase.co' || serviceKey === 'placeholder-service-key') {
    throw new Error('Supabase admin environment variables are not properly configured. Please check your .env.local file.')
  }
}

// Manage client instances with singleton pattern
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null
let supabaseAdminInstance: ReturnType<typeof createClient<Database>> | null = null

// Server-side admin client (can bypass RLS)
export const supabaseAdmin = (() => {
  // Do not create admin client on client-side
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
        adminConfig.serviceKey, // Bypass RLS using service key
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

// Create Supabase client
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
    // Handle errors during build
    return null as any
  }
})()

// Type aliases for convenience
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ChatRoom = Database['public']['Tables']['chat_rooms']['Row']
export type MessageCache = Database['public']['Tables']['message_cache']['Row']
export type MessageType = Database['public']['Enums']['message_type_enum']

// Database type definitions
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

// Typed Supabase client (default export)
export default supabase