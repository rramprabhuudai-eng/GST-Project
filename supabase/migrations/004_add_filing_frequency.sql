-- =====================================================
-- Add Filing Frequency to GST Entities
-- =====================================================
-- This migration adds the filing_frequency column that was
-- missing from the initial schema
-- =====================================================

ALTER TABLE gst_entities
ADD COLUMN IF NOT EXISTS filing_frequency TEXT NOT NULL DEFAULT 'monthly'
CHECK (filing_frequency IN ('monthly', 'quarterly'));

COMMENT ON COLUMN gst_entities.filing_frequency IS 'GST filing frequency for this entity (monthly or quarterly)';

-- =====================================================
-- END OF FILING FREQUENCY MIGRATION
-- =====================================================
