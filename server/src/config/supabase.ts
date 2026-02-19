import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './index';
import logger from '../utils/logger';

// Using 'any' for flexibility with Supabase queries - types are enforced at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: SupabaseClient<any> | null = null;

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          is_admin: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          is_admin?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          is_admin?: boolean;
        };
      };
      call_sessions: {
        Row: {
          id: string;
          user_id: string;
          status: 'ringing' | 'active' | 'ended' | 'failed';
          started_at: string;
          ended_at: string | null;
          channel_id: string | null;
          direction: 'inbound' | 'outbound';
          caller_number: string | null;
          callee_number: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: 'ringing' | 'active' | 'ended' | 'failed';
          started_at?: string;
          ended_at?: string | null;
          channel_id?: string | null;
          direction: 'inbound' | 'outbound';
          caller_number?: string | null;
          callee_number?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: 'ringing' | 'active' | 'ended' | 'failed';
          started_at?: string;
          ended_at?: string | null;
          channel_id?: string | null;
          direction?: 'inbound' | 'outbound';
          caller_number?: string | null;
          callee_number?: string | null;
        };
      };
      call_messages: {
        Row: {
          id: string;
          call_session_id: string;
          role: 'user' | 'ai';
          content: string;
          timestamp: string;
          audio_url: string | null;
        };
        Insert: {
          id?: string;
          call_session_id: string;
          role: 'user' | 'ai';
          content: string;
          timestamp?: string;
          audio_url?: string | null;
        };
        Update: {
          id?: string;
          call_session_id?: string;
          role?: 'user' | 'ai';
          content?: string;
          timestamp?: string;
          audio_url?: string | null;
        };
      };
      call_recordings: {
        Row: {
          id: string;
          call_session_id: string;
          file_url: string;
          created_at: string;
          duration: number | null;
          file_size: number | null;
        };
        Insert: {
          id?: string;
          call_session_id: string;
          file_url: string;
          created_at?: string;
          duration?: number | null;
          file_size?: number | null;
        };
        Update: {
          id?: string;
          call_session_id?: string;
          file_url?: string;
          created_at?: string;
          duration?: number | null;
          file_size?: number | null;
        };
      };
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): SupabaseClient<any> {
  if (!supabaseClient) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('Supabase configuration is missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    logger.info('Supabase client initialized successfully');
  }

  return supabaseClient;
}

export default getSupabaseClient;
