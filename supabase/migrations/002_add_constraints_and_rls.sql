-- =====================================================
-- GST Compliance App - Constraints and RLS Policies
-- =====================================================
-- This migration adds:
-- 1. UNIQUE constraint on reminder_schedule for (deadline_id, template_id)
-- 2. Atomic claim columns for cron job safety
-- 3. Row Level Security (RLS) policies on all tables
-- =====================================================

-- =====================================================
-- ADD MISSING CONSTRAINTS
-- =====================================================

-- Add UNIQUE constraint to prevent duplicate reminders for same deadline + template
ALTER TABLE reminder_schedule
ADD CONSTRAINT unique_deadline_template UNIQUE (deadline_id, template_id);

-- Add atomic claim columns to reminder_schedule for safe cron processing
ALTER TABLE reminder_schedule
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS claimed_by TEXT;

COMMENT ON COLUMN reminder_schedule.claimed_at IS 'Timestamp when reminder was claimed by a cron worker (for atomic processing)';
COMMENT ON COLUMN reminder_schedule.claimed_by IS 'Identifier of the cron worker that claimed this reminder (for debugging)';

-- Add index for atomic claim pattern
CREATE INDEX IF NOT EXISTS idx_reminder_schedule_claim
ON reminder_schedule(status, send_at, claimed_at)
WHERE status = 'pending' AND claimed_at IS NULL;

-- Add atomic claim columns to message_outbox for safe cron processing
ALTER TABLE message_outbox
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS claimed_by TEXT;

COMMENT ON COLUMN message_outbox.claimed_at IS 'Timestamp when message was claimed by a sender worker (for atomic processing)';
COMMENT ON COLUMN message_outbox.claimed_by IS 'Identifier of the sender worker that claimed this message (for debugging)';

-- Add index for atomic claim pattern on message_outbox
CREATE INDEX IF NOT EXISTS idx_message_outbox_claim
ON message_outbox(delivery_status, scheduled_for, claimed_at)
WHERE delivery_status = 'queued' AND claimed_at IS NULL;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_outbox ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR ACCOUNTS TABLE
-- =====================================================

-- Policy: Users can read their own account(s) via phone number match
CREATE POLICY accounts_select_policy ON accounts
FOR SELECT
USING (
  -- Match phone to authenticated user's phone
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = id
    AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
  )
);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY accounts_service_role_policy ON accounts
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- RLS POLICIES FOR CONTACTS TABLE
-- =====================================================

-- Policy: Users can access contacts for their account
CREATE POLICY contacts_select_policy ON contacts
FOR SELECT
USING (
  account_id IN (
    SELECT id FROM accounts
    WHERE EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = users.id
      AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
    )
  )
);

-- Policy: Service role can do everything
CREATE POLICY contacts_service_role_policy ON contacts
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- RLS POLICIES FOR GST_ENTITIES TABLE
-- =====================================================

-- Policy: Users can access GST entities for their account
CREATE POLICY gst_entities_select_policy ON gst_entities
FOR SELECT
USING (
  account_id IN (
    SELECT id FROM accounts
    WHERE EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = users.id
      AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
    )
  )
);

-- Policy: Users can insert GST entities for their account
CREATE POLICY gst_entities_insert_policy ON gst_entities
FOR INSERT
WITH CHECK (
  account_id IN (
    SELECT id FROM accounts
    WHERE EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = users.id
      AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
    )
  )
);

-- Policy: Users can update GST entities for their account
CREATE POLICY gst_entities_update_policy ON gst_entities
FOR UPDATE
USING (
  account_id IN (
    SELECT id FROM accounts
    WHERE EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = users.id
      AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
    )
  )
);

-- Policy: Service role can do everything
CREATE POLICY gst_entities_service_role_policy ON gst_entities
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- RLS POLICIES FOR DEADLINES TABLE
-- =====================================================

-- Policy: Users can access deadlines for their entities
CREATE POLICY deadlines_select_policy ON deadlines
FOR SELECT
USING (
  entity_id IN (
    SELECT id FROM gst_entities
    WHERE account_id IN (
      SELECT id FROM accounts
      WHERE EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.uid() = users.id
        AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
      )
    )
  )
);

-- Policy: Users can update deadlines for their entities (mark as filed)
CREATE POLICY deadlines_update_policy ON deadlines
FOR UPDATE
USING (
  entity_id IN (
    SELECT id FROM gst_entities
    WHERE account_id IN (
      SELECT id FROM accounts
      WHERE EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.uid() = users.id
        AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
      )
    )
  )
);

-- Policy: Service role can do everything (for deadline generation)
CREATE POLICY deadlines_service_role_policy ON deadlines
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- RLS POLICIES FOR REMINDER_SCHEDULE TABLE
-- =====================================================

-- Policy: Users can read reminders for their deadlines
CREATE POLICY reminder_schedule_select_policy ON reminder_schedule
FOR SELECT
USING (
  deadline_id IN (
    SELECT id FROM deadlines
    WHERE entity_id IN (
      SELECT id FROM gst_entities
      WHERE account_id IN (
        SELECT id FROM accounts
        WHERE EXISTS (
          SELECT 1 FROM auth.users
          WHERE auth.uid() = users.id
          AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
        )
      )
    )
  )
);

-- Policy: Service role can do everything (for cron jobs)
CREATE POLICY reminder_schedule_service_role_policy ON reminder_schedule
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- RLS POLICIES FOR MESSAGE_OUTBOX TABLE
-- =====================================================

-- Policy: Users can read their messages
CREATE POLICY message_outbox_select_policy ON message_outbox
FOR SELECT
USING (
  contact_id IN (
    SELECT id FROM contacts
    WHERE account_id IN (
      SELECT id FROM accounts
      WHERE EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.uid() = users.id
        AND (phone = accounts.phone OR user_metadata->>'phone' = accounts.phone)
      )
    )
  )
);

-- Policy: Service role can do everything (for message sending)
CREATE POLICY message_outbox_service_role_policy ON message_outbox
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- HELPER FUNCTION FOR DEADLINE FILING
-- =====================================================

-- Function to cancel pending reminders when a deadline is filed
CREATE OR REPLACE FUNCTION cancel_reminders_on_deadline_filed()
RETURNS TRIGGER AS $$
BEGIN
  -- If deadline was just marked as filed, cancel all pending reminders
  IF NEW.filed_at IS NOT NULL AND (OLD.filed_at IS NULL OR OLD.filed_at IS DISTINCT FROM NEW.filed_at) THEN
    UPDATE reminder_schedule
    SET status = 'cancelled',
        error_message = 'Deadline was filed early'
    WHERE deadline_id = NEW.id
    AND status = 'pending'
    AND sent_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically cancel reminders when deadline is marked as filed
DROP TRIGGER IF EXISTS cancel_reminders_on_filed ON deadlines;
CREATE TRIGGER cancel_reminders_on_filed
  AFTER UPDATE OF filed_at ON deadlines
  FOR EACH ROW
  EXECUTE FUNCTION cancel_reminders_on_deadline_filed();

COMMENT ON FUNCTION cancel_reminders_on_deadline_filed IS 'Automatically cancels pending reminders when a deadline is marked as filed';

-- =====================================================
-- END OF CONSTRAINTS AND RLS MIGRATION
-- =====================================================
