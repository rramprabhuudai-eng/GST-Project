-- =====================================================
-- GST Compliance App - Initial Database Schema
-- =====================================================
-- This migration creates the foundational database structure for managing
-- GST compliance, including accounts, entities, deadlines, and notifications.
--
-- Note: RLS policies are not included in this migration and will be added separately.
-- =====================================================

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ACCOUNTS TABLE
-- =====================================================
-- Purpose: Stores business account information
-- Each account represents a business/organization using the GST compliance system
-- An account can have multiple GST entities and contacts associated with it
-- =====================================================

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_name TEXT NOT NULL,
    primary_contact_id UUID,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    status TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended'))
);

-- Add comment to the table
COMMENT ON TABLE accounts IS 'Business accounts using the GST compliance system';
COMMENT ON COLUMN accounts.id IS 'Unique identifier for the account';
COMMENT ON COLUMN accounts.business_name IS 'Name of the business/organization';
COMMENT ON COLUMN accounts.primary_contact_id IS 'Reference to the main contact person (foreign key added after contacts table creation)';
COMMENT ON COLUMN accounts.timezone IS 'Timezone for scheduling deadlines and reminders';
COMMENT ON COLUMN accounts.status IS 'Current status of the account (active, inactive, suspended)';

-- Index for filtering by status
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_created_at ON accounts(created_at);

-- =====================================================
-- CONTACTS TABLE
-- =====================================================
-- Purpose: Stores contact information for individuals associated with accounts
-- Used for sending WhatsApp reminders and notifications about GST deadlines
-- Manages communication preferences and opt-out status
-- =====================================================

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    phone TEXT,
    email TEXT,
    name TEXT NOT NULL,
    whatsapp_consent BOOLEAN NOT NULL DEFAULT false,
    opt_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT phone_or_email_required CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- Add comments
COMMENT ON TABLE contacts IS 'Contact persons associated with business accounts';
COMMENT ON COLUMN contacts.id IS 'Unique identifier for the contact';
COMMENT ON COLUMN contacts.account_id IS 'Reference to the parent account';
COMMENT ON COLUMN contacts.phone IS 'Phone number (preferably in E.164 format for WhatsApp)';
COMMENT ON COLUMN contacts.email IS 'Email address for notifications';
COMMENT ON COLUMN contacts.name IS 'Full name of the contact person';
COMMENT ON COLUMN contacts.whatsapp_consent IS 'Whether contact has consented to receive WhatsApp messages';
COMMENT ON COLUMN contacts.opt_out_at IS 'Timestamp when contact opted out of communications (NULL if not opted out)';

-- Indexes for foreign keys and frequently queried fields
CREATE INDEX idx_contacts_account_id ON contacts(account_id);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_whatsapp_consent ON contacts(whatsapp_consent) WHERE opt_out_at IS NULL;

-- Now add the foreign key constraint from accounts to contacts
ALTER TABLE accounts
    ADD CONSTRAINT fk_accounts_primary_contact
    FOREIGN KEY (primary_contact_id)
    REFERENCES contacts(id)
    ON DELETE SET NULL;

CREATE INDEX idx_accounts_primary_contact_id ON accounts(primary_contact_id);

-- =====================================================
-- GST_ENTITIES TABLE
-- =====================================================
-- Purpose: Stores GST registration details for each business entity
-- A single account may have multiple GST entities (different GSTINs)
-- Tracks verification status and registration information
-- =====================================================

CREATE TABLE gst_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    gstin TEXT NOT NULL UNIQUE,
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    state_code TEXT NOT NULL,
    registration_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_gstin_format CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'cancelled', 'suspended'))
);

-- Add comments
COMMENT ON TABLE gst_entities IS 'GST registrations (GSTINs) associated with business accounts';
COMMENT ON COLUMN gst_entities.id IS 'Unique identifier for the GST entity';
COMMENT ON COLUMN gst_entities.account_id IS 'Reference to the parent account';
COMMENT ON COLUMN gst_entities.gstin IS 'GST Identification Number (15 characters, unique across system)';
COMMENT ON COLUMN gst_entities.legal_name IS 'Legal name as per GST registration';
COMMENT ON COLUMN gst_entities.trade_name IS 'Trade name (if different from legal name)';
COMMENT ON COLUMN gst_entities.state_code IS 'Two-digit state code from GSTIN';
COMMENT ON COLUMN gst_entities.registration_date IS 'Date of GST registration';
COMMENT ON COLUMN gst_entities.status IS 'Current GST registration status';
COMMENT ON COLUMN gst_entities.verified_at IS 'Timestamp when GSTIN was verified against government records';

-- Indexes
CREATE INDEX idx_gst_entities_account_id ON gst_entities(account_id);
CREATE INDEX idx_gst_entities_gstin ON gst_entities(gstin);
CREATE INDEX idx_gst_entities_status ON gst_entities(status);
CREATE INDEX idx_gst_entities_state_code ON gst_entities(state_code);

-- =====================================================
-- DEADLINES TABLE
-- =====================================================
-- Purpose: Tracks GST return filing deadlines for each entity
-- Stores information about return types, periods, due dates, and filing status
-- Supports proof of filing and notes for audit trail
-- =====================================================

CREATE TABLE deadlines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES gst_entities(id) ON DELETE CASCADE,
    return_type TEXT NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    due_date DATE NOT NULL,
    filed_at TIMESTAMPTZ,
    proof_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_month CHECK (period_month >= 1 AND period_month <= 12),
    CONSTRAINT valid_year CHECK (period_year >= 2000 AND period_year <= 2100),
    CONSTRAINT valid_return_type CHECK (return_type IN ('GSTR1', 'GSTR3B', 'GSTR4', 'GSTR9', 'GSTR9C', 'CMP08', 'ITC04'))
);

-- Add comments
COMMENT ON TABLE deadlines IS 'GST return filing deadlines and their status';
COMMENT ON COLUMN deadlines.id IS 'Unique identifier for the deadline';
COMMENT ON COLUMN deadlines.entity_id IS 'Reference to the GST entity this deadline belongs to';
COMMENT ON COLUMN deadlines.return_type IS 'Type of GST return (GSTR1, GSTR3B, etc.)';
COMMENT ON COLUMN deadlines.period_month IS 'Month for which the return is due (1-12)';
COMMENT ON COLUMN deadlines.period_year IS 'Year for which the return is due';
COMMENT ON COLUMN deadlines.due_date IS 'Official due date for filing the return';
COMMENT ON COLUMN deadlines.filed_at IS 'Timestamp when the return was filed (NULL if not yet filed)';
COMMENT ON COLUMN deadlines.proof_url IS 'URL to filing proof document (ARN receipt, acknowledgement, etc.)';
COMMENT ON COLUMN deadlines.notes IS 'Additional notes about the filing or deadline';

-- Indexes
CREATE INDEX idx_deadlines_entity_id ON deadlines(entity_id);
CREATE INDEX idx_deadlines_due_date ON deadlines(due_date);
CREATE INDEX idx_deadlines_return_type ON deadlines(return_type);
CREATE INDEX idx_deadlines_filed_at ON deadlines(filed_at);
CREATE INDEX idx_deadlines_period ON deadlines(period_year, period_month);

-- Composite index for finding unfiled deadlines
CREATE INDEX idx_deadlines_unfiled ON deadlines(entity_id, due_date) WHERE filed_at IS NULL;

-- Unique constraint to prevent duplicate deadlines for same entity/period/type
CREATE UNIQUE INDEX idx_deadlines_unique_period ON deadlines(entity_id, return_type, period_year, period_month);

-- =====================================================
-- REMINDER_SCHEDULE TABLE
-- =====================================================
-- Purpose: Manages scheduled reminders for upcoming GST deadlines
-- Tracks when reminders should be sent and their delivery status
-- Links to message templates for WhatsApp notifications
-- =====================================================

CREATE TABLE reminder_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deadline_id UUID NOT NULL REFERENCES deadlines(id) ON DELETE CASCADE,
    send_at TIMESTAMPTZ NOT NULL,
    template_id TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message TEXT,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'))
);

-- Add comments
COMMENT ON TABLE reminder_schedule IS 'Scheduled reminders for GST filing deadlines';
COMMENT ON COLUMN reminder_schedule.id IS 'Unique identifier for the scheduled reminder';
COMMENT ON COLUMN reminder_schedule.deadline_id IS 'Reference to the deadline this reminder is for';
COMMENT ON COLUMN reminder_schedule.send_at IS 'Scheduled time to send the reminder';
COMMENT ON COLUMN reminder_schedule.template_id IS 'Identifier for the message template to use';
COMMENT ON COLUMN reminder_schedule.sent_at IS 'Actual time the reminder was sent (NULL if not yet sent)';
COMMENT ON COLUMN reminder_schedule.status IS 'Current status of the reminder (pending, sent, failed, cancelled)';
COMMENT ON COLUMN reminder_schedule.error_message IS 'Error details if reminder failed to send';

-- Indexes
CREATE INDEX idx_reminder_schedule_deadline_id ON reminder_schedule(deadline_id);
CREATE INDEX idx_reminder_schedule_send_at ON reminder_schedule(send_at);
CREATE INDEX idx_reminder_schedule_status ON reminder_schedule(status);

-- Index for finding pending reminders that need to be sent
CREATE INDEX idx_reminder_schedule_pending ON reminder_schedule(send_at, status) WHERE status = 'pending';

-- =====================================================
-- MESSAGE_OUTBOX TABLE
-- =====================================================
-- Purpose: Queues and tracks outgoing WhatsApp messages
-- Stores message content, scheduling, and delivery status
-- Maintains audit trail of all communications with contacts
-- =====================================================

CREATE TABLE message_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL,
    parameters JSONB,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    delivery_status TEXT NOT NULL DEFAULT 'queued',
    external_message_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message TEXT,
    CONSTRAINT valid_delivery_status CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'cancelled'))
);

-- Add comments
COMMENT ON TABLE message_outbox IS 'Outgoing WhatsApp messages queue and delivery tracking';
COMMENT ON COLUMN message_outbox.id IS 'Unique identifier for the message';
COMMENT ON COLUMN message_outbox.contact_id IS 'Reference to the recipient contact';
COMMENT ON COLUMN message_outbox.template_id IS 'Identifier for the WhatsApp message template';
COMMENT ON COLUMN message_outbox.parameters IS 'JSON object containing template parameters/variables';
COMMENT ON COLUMN message_outbox.scheduled_for IS 'Scheduled time to send the message';
COMMENT ON COLUMN message_outbox.sent_at IS 'Actual time the message was sent (NULL if not yet sent)';
COMMENT ON COLUMN message_outbox.delivery_status IS 'Current delivery status (queued, sent, delivered, read, failed, cancelled)';
COMMENT ON COLUMN message_outbox.external_message_id IS 'Message ID from WhatsApp provider (for tracking and webhooks)';
COMMENT ON COLUMN message_outbox.error_message IS 'Error details if message failed to send';

-- Indexes
CREATE INDEX idx_message_outbox_contact_id ON message_outbox(contact_id);
CREATE INDEX idx_message_outbox_scheduled_for ON message_outbox(scheduled_for);
CREATE INDEX idx_message_outbox_delivery_status ON message_outbox(delivery_status);
CREATE INDEX idx_message_outbox_sent_at ON message_outbox(sent_at);
CREATE INDEX idx_message_outbox_external_id ON message_outbox(external_message_id);

-- Index for finding messages queued to be sent
CREATE INDEX idx_message_outbox_queued ON message_outbox(scheduled_for, delivery_status) WHERE delivery_status = 'queued';

-- =====================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================
-- Automatically update the updated_at column when records are modified
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gst_entities_updated_at
    BEFORE UPDATE ON gst_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deadlines_updated_at
    BEFORE UPDATE ON deadlines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- END OF INITIAL SCHEMA MIGRATION
-- =====================================================
