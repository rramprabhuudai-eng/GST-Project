# Database Schema

This document outlines the database schema for the GST Management System.

## Tables

### accounts
Stores business account information.

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT false
);
```

### contacts
Stores contact information associated with accounts.

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_contacts_account_id ON contacts(account_id);
```

### gst_entities
Stores GST registration details for accounts.

```sql
CREATE TABLE gst_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  gstin TEXT NOT NULL UNIQUE,
  state_code TEXT NOT NULL,
  legal_name TEXT,
  trade_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_gst_entities_account_id ON gst_entities(account_id);
CREATE INDEX idx_gst_entities_gstin ON gst_entities(gstin);
```

## Relationships

- One account can have multiple contacts (one-to-many)
- One account can have multiple GST entities (one-to-many)
- Each account is linked to a Supabase Auth user via the phone number

## Setup Instructions

1. Create a Supabase project at https://supabase.com
2. Run the SQL statements above in the SQL Editor
3. Enable Phone authentication in Authentication > Providers
4. Configure phone OTP settings
5. Update `.env.local` with your Supabase credentials
