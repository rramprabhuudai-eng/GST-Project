# GST-Project

A comprehensive GST (Goods and Services Tax) compliance management system with an integrated Compliance Reliability Index (CRI) scoring system.

## Features

### Compliance Reliability Index (CRI)

The CRI is a behavioral compliance indicator that evaluates user filing patterns based on:

- **Timeliness (40%)**: Percentage of deadlines filed on or before due date
- **Consistency (25%)**: Filing streak and pattern regularity
- **Responsiveness (15%)**: Average days between reminder and filing
- **Verification Integrity (20%)**: Percentage of filings with proof provided

**Score Range**: 0-100 with letter grades (A+, A, B, C, D)

**Data Window**: Rolling 12-month period

## Project Structure

```
GST-Project/
├── app/
│   ├── api/
│   │   └── cri/
│   │       └── calculate/
│   │           └── route.ts          # CRI calculation API endpoints
│   └── cri/
│       └── page.tsx                  # CRI display page
├── lib/
│   └── cri/
│       ├── types.ts                  # TypeScript type definitions
│       ├── aggregator.ts             # Data aggregation logic
│       └── calculator.ts             # Score calculation logic
└── supabase/
    └── migrations/
        └── 005_cri_scores.sql        # Database schema for CRI scores
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **UI**: React 18

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase project with appropriate tables (gst_entities, deadlines)

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
# Apply the migration file: supabase/migrations/005_cri_scores.sql

# Run development server
npm run dev
```

Visit `http://localhost:3000/cri` to view the CRI dashboard.

## API Endpoints

### Calculate CRI Score

```bash
POST /api/cri/calculate
Content-Type: application/json

{
  "entity_id": "uuid"
}
```

### Get CRI Score

```bash
GET /api/cri/calculate?entity_id=uuid
```

## Documentation

For detailed implementation documentation, see [CRI_IMPLEMENTATION.md](./CRI_IMPLEMENTATION.md)

## Security

- Row Level Security (RLS) enabled on all tables
- Entity ownership validation
- Authentication required for all endpoints

## License

Private - All rights reserved
