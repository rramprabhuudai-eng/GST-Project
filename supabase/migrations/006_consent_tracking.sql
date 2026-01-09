-- Migration: 006_consent_tracking.sql
-- Description: Add consent tracking fields to contacts table
-- This migration is idempotent and can be run multiple times safely

-- Add consent-related columns to contacts table (if they don't exist)
-- Using simple boolean + timestamp model for consent tracking

-- whatsapp_consent: true = opted in, false = opted out
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN DEFAULT true NOT NULL;

-- opt_out_at: timestamp when user opted out (NULL if never opted out or opted back in)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;

-- consent_changed_at: tracks when consent status last changed
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS consent_changed_at TIMESTAMPTZ;

-- consent_change_reason: optional text explaining why consent changed
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS consent_change_reason TEXT;

-- Create index for filtering by consent status (for performance)
CREATE INDEX IF NOT EXISTS idx_contacts_consent
ON contacts(whatsapp_consent, opt_out_at)
WHERE whatsapp_consent = true AND opt_out_at IS NULL;

-- Function to automatically update consent_changed_at timestamp
CREATE OR REPLACE FUNCTION update_consent_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if whatsapp_consent or opt_out_at changed
  IF (OLD.whatsapp_consent IS DISTINCT FROM NEW.whatsapp_consent) OR
     (OLD.opt_out_at IS DISTINCT FROM NEW.opt_out_at) THEN
    NEW.consent_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_consent_changed_at ON contacts;

-- Create trigger to update consent_changed_at on consent changes
CREATE TRIGGER trigger_update_consent_changed_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_consent_changed_at();

-- Add comment for documentation
COMMENT ON COLUMN contacts.whatsapp_consent IS 'WhatsApp messaging consent: true = opted in, false = opted out';
COMMENT ON COLUMN contacts.opt_out_at IS 'Timestamp when contact opted out of WhatsApp messages';
COMMENT ON COLUMN contacts.consent_changed_at IS 'Timestamp of last consent status change';
COMMENT ON COLUMN contacts.consent_change_reason IS 'Optional reason for consent change';
