# Compliance Reliability Index (CRI) Implementation

## Overview

The Compliance Reliability Index (CRI) is a scoring system that evaluates user compliance behavior based on GST filing patterns. The score ranges from 0-100 and is calculated using a weighted combination of four key dimensions.

## Architecture

### Components

1. **Database Layer** (`supabase/migrations/005_cri_scores.sql`)
   - `cri_scores` table for storing calculated scores
   - RLS policies for secure access
   - Indexes for performance optimization

2. **Data Aggregation** (`lib/cri/aggregator.ts`)
   - Fetches deadlines from the last 12 months
   - Calculates metrics for scoring
   - Handles edge cases (no data, unfiled deadlines)

3. **Score Calculation** (`lib/cri/calculator.ts`)
   - Implements weighted scoring algorithm
   - Maps scores to letter grades
   - Provides score interpretations

4. **API Layer** (`app/api/cri/calculate/route.ts`)
   - POST endpoint to calculate/update CRI scores
   - GET endpoint to retrieve existing scores
   - Authentication and authorization

5. **UI Layer** (`app/cri/page.tsx`)
   - Mobile-responsive display
   - Entity selection
   - Dimension breakdown visualization
   - Real-time recalculation

## Scoring Methodology

### Dimensions and Weights

The CRI score is calculated using four dimensions:

#### 1. Timeliness (40%)
- **Formula**: (Filed on Time / Total Filed) × 100
- **Purpose**: Measures adherence to deadlines
- **Range**: 0-100

#### 2. Consistency (25%)
- **Formula**: (Filing Rate × 0.7) + (Streak Bonus × 0.3)
- **Components**:
  - Filing Rate: (Total Filed / Total Deadlines) × 100
  - Streak Bonus: Based on consecutive on-time filings
- **Range**: 0-100

#### 3. Responsiveness (15%)
- **Formula**: 100 - (Average Response Time / 30) × 100
- **Purpose**: Measures how quickly users respond to reminders
- **Range**: 0-100
- **Default**: 75 (if no reminder data available)

#### 4. Verification Integrity (20%)
- **Formula**: (Deadlines with Proof / Total Filed) × 100
- **Purpose**: Measures documentation completeness
- **Range**: 0-100

### Grade Mapping

| Grade | Score Range | Description |
|-------|-------------|-------------|
| A+    | 95-100      | Excellent   |
| A     | 90-94       | Very Good   |
| B     | 80-89       | Good        |
| C     | 70-79       | Fair        |
| D     | <70         | Poor        |

### Final Score Calculation

```typescript
CRI Score = (Timeliness × 0.40) +
            (Consistency × 0.25) +
            (Responsiveness × 0.15) +
            (Verification × 0.20)
```

## Database Schema

### `cri_scores` Table

```sql
CREATE TABLE cri_scores (
  id UUID PRIMARY KEY,
  entity_id UUID REFERENCES gst_entities(id),
  score NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  grade TEXT CHECK (grade IN ('A+', 'A', 'B', 'C', 'D')),
  calculated_at TIMESTAMPTZ,
  dimension_scores JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Example `dimension_scores` JSON

```json
{
  "timeliness": 85,
  "consistency": 78,
  "responsiveness": 92,
  "verificationIntegrity": 65
}
```

### Example `metadata` JSON

```json
{
  "totalDeadlines": 24,
  "filedDeadlines": 22,
  "calculationDate": "2025-01-08T10:30:00Z",
  "metrics": {
    "totalDeadlines": 24,
    "filedOnTime": 18,
    "filedLate": 4,
    "unfiled": 2,
    "averageDaysLate": 3.5,
    "currentStreak": 5,
    "proofUploadPercentage": 65,
    "averageResponseTime": 2.8
  }
}
```

## API Endpoints

### POST /api/cri/calculate

Calculate or update CRI score for an entity.

**Request:**
```json
{
  "entity_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 82,
    "grade": "B",
    "dimensionScores": {
      "timeliness": 85,
      "consistency": 78,
      "responsiveness": 92,
      "verificationIntegrity": 65
    },
    "metadata": {
      "totalDeadlines": 24,
      "filedDeadlines": 22,
      "calculationDate": "2025-01-08T10:30:00Z"
    },
    "id": "uuid",
    "calculatedAt": "2025-01-08T10:30:00Z"
  }
}
```

### GET /api/cri/calculate?entity_id={uuid}

Retrieve the latest CRI score for an entity.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "entity_id": "uuid",
    "score": 82,
    "grade": "B",
    "calculated_at": "2025-01-08T10:30:00Z",
    "dimension_scores": { ... },
    "metadata": { ... }
  }
}
```

## Edge Cases Handled

1. **No Historical Data**: Returns score of 0 with grade 'D'
2. **No Filings**: All dimension scores are 0
3. **Division by Zero**: Protected in all calculations
4. **Missing Reminder Data**: Uses default score of 75 for responsiveness
5. **First Month Usage**: Calculates based on available data
6. **All Deadlines Unfiled**: Score reflects 0% filing rate

## Security Features

1. **Row Level Security (RLS)**: Users can only access their own entity scores
2. **Entity Ownership Validation**: API validates entity belongs to authenticated user
3. **Service Role Policy**: Allows backend operations for calculations
4. **Authentication Required**: All endpoints require valid session

## Performance Optimizations

1. **Indexes**:
   - `entity_id` for fast entity lookups
   - `calculated_at DESC` for latest score retrieval
   - Composite index on `(entity_id, calculated_at)`

2. **12-Month Rolling Window**: Limits data processing to relevant timeframe

3. **Upsert Pattern**: Updates existing score instead of creating duplicates

## Usage Example

```typescript
// Calculate CRI score
const response = await fetch('/api/cri/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entity_id: 'uuid' })
});

const result = await response.json();
console.log(`CRI Score: ${result.data.score}, Grade: ${result.data.grade}`);
```

## Future Enhancements

1. **Trend Analysis**: Track score changes over time
2. **Peer Comparison**: Anonymous industry benchmarking
3. **Predictive Scoring**: Forecast future compliance risk
4. **Custom Weighting**: Allow users to adjust dimension weights
5. **Notification Thresholds**: Alert when score drops below threshold

## Testing Recommendations

1. Test with various filing patterns (all on-time, all late, mixed)
2. Test with edge cases (no data, single filing, etc.)
3. Verify RLS policies prevent unauthorized access
4. Test concurrent calculations for same entity
5. Validate score consistency across recalculations with same data

## Disclaimer

The CRI score is a behavioral compliance indicator and does not reflect:
- Tax calculation accuracy
- Legal compliance status
- Financial health
- Audit risk assessment

Always consult with tax professionals for compliance guidance.
