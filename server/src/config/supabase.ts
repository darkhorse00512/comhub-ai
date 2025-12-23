import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './index';
import logger from '../utils/logger';

let supabaseClient: SupabaseClient | null = null;

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
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

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('Supabase configuration is missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    supabaseClient = createClient<Database>(
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
