-- =====================================================
-- Consent Change Tracking Migration
-- =====================================================
-- This migration adds tracking for WhatsApp consent changes
-- to maintain audit trail and compliance with communication preferences
-- =====================================================

-- Add consent tracking columns to contacts table
ALTER TABLE contacts
ADD COLUMN consent_changed_at TIMESTAMPTZ,
ADD COLUMN consent_change_reason TEXT;

-- Add comments
COMMENT ON COLUMN contacts.consent_changed_at IS 'Timestamp when whatsapp_consent was last changed';
COMMENT ON COLUMN contacts.consent_change_reason IS 'Optional reason for consent change (e.g., user-initiated, admin-initiated)';

-- Create index for consent change tracking
CREATE INDEX idx_contacts_consent_changed_at ON contacts(consent_changed_at);

-- =====================================================
-- Trigger to automatically update consent_changed_at
-- =====================================================
-- This trigger fires whenever whatsapp_consent changes
-- and automatically sets the consent_changed_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_consent_changed_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if whatsapp_consent actually changed
    IF OLD.whatsapp_consent IS DISTINCT FROM NEW.whatsapp_consent THEN
        NEW.consent_changed_at = NOW();

        -- Set opt_out_at if consent changed to false
        IF NEW.whatsapp_consent = false AND OLD.whatsapp_consent = true THEN
            NEW.opt_out_at = NOW();
        END IF;

        -- Clear opt_out_at if consent changed back to true
        IF NEW.whatsapp_consent = true AND OLD.whatsapp_consent = false THEN
            NEW.opt_out_at = NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_consent_changed_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_consent_changed_at();

COMMENT ON FUNCTION update_consent_changed_at IS 'Automatically updates consent_changed_at and opt_out_at when whatsapp_consent changes';

-- =====================================================
-- Add claimed_at and claimed_by columns to tables
-- =====================================================
-- These columns support atomic claim pattern for concurrent processing
-- =====================================================

-- Add to reminder_schedule if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reminder_schedule'
        AND column_name = 'claimed_at'
    ) THEN
        ALTER TABLE reminder_schedule
        ADD COLUMN claimed_at TIMESTAMPTZ,
        ADD COLUMN claimed_by TEXT;

        CREATE INDEX idx_reminder_schedule_claimed ON reminder_schedule(claimed_at, claimed_by);

        COMMENT ON COLUMN reminder_schedule.claimed_at IS 'Timestamp when reminder was claimed by a worker for processing';
        COMMENT ON COLUMN reminder_schedule.claimed_by IS 'Identifier of the worker that claimed this reminder';
    END IF;
END $$;

-- Add to message_outbox if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_outbox'
        AND column_name = 'claimed_at'
    ) THEN
        ALTER TABLE message_outbox
        ADD COLUMN claimed_at TIMESTAMPTZ,
        ADD COLUMN claimed_by TEXT;

        CREATE INDEX idx_message_outbox_claimed ON message_outbox(claimed_at, claimed_by);

        COMMENT ON COLUMN message_outbox.claimed_at IS 'Timestamp when message was claimed by a worker for sending';
        COMMENT ON COLUMN message_outbox.claimed_by IS 'Identifier of the worker that claimed this message';
    END IF;
END $$;

-- =====================================================
-- END OF CONSENT TRACKING MIGRATION
-- =====================================================
