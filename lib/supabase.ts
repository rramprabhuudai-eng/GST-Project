import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      gst_entities: {
        Row: {
          id: string
          user_id: string
          gstin: string
          legal_name: string
          trade_name: string | null
          filing_frequency: 'monthly' | 'quarterly'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gstin: string
          legal_name: string
          trade_name?: string | null
          filing_frequency?: 'monthly' | 'quarterly'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          gstin?: string
          legal_name?: string
          trade_name?: string | null
          filing_frequency?: 'monthly' | 'quarterly'
          created_at?: string
          updated_at?: string
        }
      }
      gst_deadlines: {
        Row: {
          id: string
          entity_id: string
          return_type: string
          period_month: number
          period_year: number
          due_date: string
          status: 'upcoming' | 'filed' | 'overdue'
          filed_at: string | null
          proof_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entity_id: string
          return_type: string
          period_month: number
          period_year: number
          due_date: string
          status?: 'upcoming' | 'filed' | 'overdue'
          filed_at?: string | null
          proof_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          entity_id?: string
          return_type?: string
          period_month?: number
          period_year?: number
          due_date?: string
          status?: 'upcoming' | 'filed' | 'overdue'
          filed_at?: string | null
          proof_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
