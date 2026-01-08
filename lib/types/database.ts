export interface Account {
  id: string
  created_at: string
  business_name: string
  phone: string
  whatsapp_consent: boolean
}

export interface Contact {
  id: string
  created_at: string
  account_id: string
  name: string
  phone: string
  is_primary: boolean
}

export interface GSTEntity {
  id: string
  created_at: string
  account_id: string
  gstin: string
  state_code: string
  legal_name?: string
  trade_name?: string
  is_active: boolean
}

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at'>
        Update: Partial<Omit<Account, 'id' | 'created_at'>>
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'created_at'>
        Update: Partial<Omit<Contact, 'id' | 'created_at'>>
      }
      gst_entities: {
        Row: GSTEntity
        Insert: Omit<GSTEntity, 'id' | 'created_at'>
        Update: Partial<Omit<GSTEntity, 'id' | 'created_at'>>
      }
    }
  }
}
