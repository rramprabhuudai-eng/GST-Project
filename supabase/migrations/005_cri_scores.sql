-- Migration: CRI (Compliance Reliability Index) Scores Table
-- Description: Stores calculated CRI scores for GST entities with dimension breakdowns

-- Create cri_scores table
CREATE TABLE IF NOT EXISTS cri_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  grade TEXT NOT NULL CHECK (grade IN ('A+', 'A', 'B', 'C', 'D')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dimension_scores JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraint (assumes gst_entities table exists)
  CONSTRAINT fk_entity
    FOREIGN KEY (entity_id)
    REFERENCES gst_entities(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_cri_scores_entity_id ON cri_scores(entity_id);
CREATE INDEX idx_cri_scores_calculated_at ON cri_scores(calculated_at DESC);
CREATE INDEX idx_cri_scores_entity_calculated ON cri_scores(entity_id, calculated_at DESC);
CREATE INDEX idx_cri_scores_grade ON cri_scores(grade);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cri_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER trigger_update_cri_scores_updated_at
  BEFORE UPDATE ON cri_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_cri_scores_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE cri_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view CRI scores for their own entities
CREATE POLICY "Users can view their own entity CRI scores"
  ON cri_scores
  FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM gst_entities
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Service role can insert/update CRI scores
CREATE POLICY "Service role can manage CRI scores"
  ON cri_scores
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policy: Authenticated users can insert CRI scores for their entities
CREATE POLICY "Users can insert CRI scores for their entities"
  ON cri_scores
  FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM gst_entities
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Authenticated users can update CRI scores for their entities
CREATE POLICY "Users can update CRI scores for their entities"
  ON cri_scores
  FOR UPDATE
  USING (
    entity_id IN (
      SELECT id FROM gst_entities
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT id FROM gst_entities
      WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE cri_scores IS 'Stores Compliance Reliability Index scores for GST entities based on filing behavior';
COMMENT ON COLUMN cri_scores.score IS 'CRI score from 0-100';
COMMENT ON COLUMN cri_scores.grade IS 'Letter grade: A+ (95-100), A (90-94), B (80-89), C (70-79), D (<70)';
COMMENT ON COLUMN cri_scores.dimension_scores IS 'JSON object containing scores for timeliness, consistency, responsiveness, and verificationIntegrity';
COMMENT ON COLUMN cri_scores.metadata IS 'Additional calculation metadata including total deadlines, filed count, etc.';
