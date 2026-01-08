-- =====================================================
-- Atomic Claim Function for Reminder Processing
-- =====================================================
-- This function implements FOR UPDATE SKIP LOCKED pattern
-- for safe concurrent processing of reminders by multiple workers
-- =====================================================

CREATE OR REPLACE FUNCTION claim_pending_reminders(
  p_worker_id TEXT,
  p_batch_size INTEGER DEFAULT 100,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  deadline_id UUID,
  template_id TEXT,
  send_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE reminder_schedule
  SET
    claimed_at = p_now,
    claimed_by = p_worker_id
  WHERE id IN (
    SELECT reminder_schedule.id
    FROM reminder_schedule
    WHERE reminder_schedule.status = 'pending'
      AND reminder_schedule.claimed_at IS NULL
      AND reminder_schedule.send_at <= p_now
    ORDER BY reminder_schedule.send_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED  -- Critical: prevents race conditions
  )
  RETURNING
    reminder_schedule.id,
    reminder_schedule.deadline_id,
    reminder_schedule.template_id,
    reminder_schedule.send_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_pending_reminders IS 'Atomically claims pending reminders using FOR UPDATE SKIP LOCKED to prevent race conditions when multiple cron workers run simultaneously';

-- =====================================================
-- Similar function for message_outbox (optional, for future use)
-- =====================================================

CREATE OR REPLACE FUNCTION claim_queued_messages(
  p_worker_id TEXT,
  p_batch_size INTEGER DEFAULT 100,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  contact_id UUID,
  template_id TEXT,
  parameters JSONB,
  scheduled_for TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE message_outbox
  SET
    claimed_at = p_now,
    claimed_by = p_worker_id
  WHERE id IN (
    SELECT message_outbox.id
    FROM message_outbox
    WHERE message_outbox.delivery_status = 'queued'
      AND message_outbox.claimed_at IS NULL
      AND message_outbox.scheduled_for <= p_now
    ORDER BY message_outbox.scheduled_for ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    message_outbox.id,
    message_outbox.contact_id,
    message_outbox.template_id,
    message_outbox.parameters,
    message_outbox.scheduled_for;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_queued_messages IS 'Atomically claims queued messages using FOR UPDATE SKIP LOCKED for safe concurrent message sending';

-- =====================================================
-- END OF ATOMIC CLAIM FUNCTION MIGRATION
-- =====================================================
