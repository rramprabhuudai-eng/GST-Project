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
      accounts: {
        Row: {
          id: string
          created_at: string
          business_name: string
          primary_contact_id: string | null
          timezone: string
          status: 'active' | 'inactive' | 'suspended'
        }
        Insert: {
          id?: string
          created_at?: string
          business_name: string
          primary_contact_id?: string | null
          timezone?: string
          status?: 'active' | 'inactive' | 'suspended'
        }
        Update: {
          id?: string
          created_at?: string
          business_name?: string
          primary_contact_id?: string | null
          timezone?: string
          status?: 'active' | 'inactive' | 'suspended'
        }
      }
      contacts: {
        Row: {
          id: string
          account_id: string
          phone: string | null
          email: string | null
          name: string
          whatsapp_consent: boolean
          opt_out_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          phone?: string | null
          email?: string | null
          name: string
          whatsapp_consent?: boolean
          opt_out_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          phone?: string | null
          email?: string | null
          name?: string
          whatsapp_consent?: boolean
          opt_out_at?: string | null
          created_at?: string
        }
      }
      gst_entities: {
        Row: {
          id: string
          account_id: string
          gstin: string
          legal_name: string
          trade_name: string | null
          state_code: string
          registration_date: string | null
          status: 'active' | 'inactive' | 'cancelled' | 'suspended'
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          gstin: string
          legal_name: string
          trade_name?: string | null
          state_code: string
          registration_date?: string | null
          status?: 'active' | 'inactive' | 'cancelled' | 'suspended'
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          gstin?: string
          legal_name?: string
          trade_name?: string | null
          state_code?: string
          registration_date?: string | null
          status?: 'active' | 'inactive' | 'cancelled' | 'suspended'
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      deadlines: {
        Row: {
          id: string
          entity_id: string
          return_type: string
          period_month: number
          period_year: number
          due_date: string
          filed_at: string | null
          proof_url: string | null
          notes: string | null
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
          filed_at?: string | null
          proof_url?: string | null
          notes?: string | null
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
          filed_at?: string | null
          proof_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reminder_schedule: {
        Row: {
          id: string
          deadline_id: string
          send_at: string
          template_id: string
          sent_at: string | null
          status: 'pending' | 'sent' | 'failed' | 'cancelled'
          created_at: string
          error_message: string | null
          claimed_at: string | null
          claimed_by: string | null
        }
        Insert: {
          id?: string
          deadline_id: string
          send_at: string
          template_id: string
          sent_at?: string | null
          status?: 'pending' | 'sent' | 'failed' | 'cancelled'
          created_at?: string
          error_message?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
        }
        Update: {
          id?: string
          deadline_id?: string
          send_at?: string
          template_id?: string
          sent_at?: string | null
          status?: 'pending' | 'sent' | 'failed' | 'cancelled'
          created_at?: string
          error_message?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
        }
      }
      message_outbox: {
        Row: {
          id: string
          contact_id: string
          template_id: string
          parameters: Json | null
          scheduled_for: string
          sent_at: string | null
          delivery_status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled'
          external_message_id: string | null
          created_at: string
          error_message: string | null
          claimed_at: string | null
          claimed_by: string | null
        }
        Insert: {
          id?: string
          contact_id: string
          template_id: string
          parameters?: Json | null
          scheduled_for: string
          sent_at?: string | null
          delivery_status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled'
          external_message_id?: string | null
          created_at?: string
          error_message?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
        }
        Update: {
          id?: string
          contact_id?: string
          template_id?: string
          parameters?: Json | null
          scheduled_for?: string
          sent_at?: string | null
          delivery_status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled'
          external_message_id?: string | null
          created_at?: string
          error_message?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
        }
      }
    }
  }
}
