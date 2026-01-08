-- GST Project Database Schema
-- Run this in your Supabase SQL editor to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- GST Entities Table
CREATE TABLE IF NOT EXISTS gst_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  gstin VARCHAR(15) NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  filing_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (filing_frequency IN ('monthly', 'quarterly')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GST Deadlines Table
CREATE TABLE IF NOT EXISTS gst_deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES gst_entities(id) ON DELETE CASCADE,
  return_type TEXT NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'filed', 'overdue')),
  filed_at TIMESTAMP WITH TIME ZONE,
  proof_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure no duplicate deadlines for the same entity, return type, and period
  UNIQUE(entity_id, return_type, period_month, period_year)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gst_entities_user_id ON gst_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_gst_deadlines_entity_id ON gst_deadlines(entity_id);
CREATE INDEX IF NOT EXISTS idx_gst_deadlines_due_date ON gst_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_gst_deadlines_status ON gst_deadlines(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to auto-update updated_at
CREATE TRIGGER update_gst_entities_updated_at
  BEFORE UPDATE ON gst_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gst_deadlines_updated_at
  BEFORE UPDATE ON gst_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO gst_entities (user_id, gstin, legal_name, trade_name, filing_frequency)
-- VALUES ('user123', '27AABCU9603R1ZX', 'Example Company Pvt Ltd', 'Example Trade', 'monthly');
