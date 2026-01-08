# GST Filing Timeline

A Next.js application for tracking and managing GST (Goods and Services Tax) return deadlines in India.

## Features

- **Automatic Deadline Generation**: Generates GST return deadlines for GSTR-1 and GSTR-3B (monthly/quarterly)
- **Timeline View**: Display upcoming deadlines in chronological order for the next 90 days
- **Smart Scheduling**: Automatically moves deadlines to next working day if they fall on weekends
- **Deadline Tracking**: Mark returns as filed with timestamps
- **Multi-Entity Support**: Manage deadlines for multiple GSTIN entities
- **Mobile Optimized**: Responsive design for mobile and desktop

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Date Handling**: date-fns

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd GST-Project
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [Supabase](https://supabase.com)
2. Run the SQL schema from `database/schema.sql` in the Supabase SQL Editor
3. Get your project URL and anon key from Project Settings > API

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

### Tables

#### `gst_entities`
- Stores GST entity information (GSTIN, legal name, filing frequency)
- Links to user accounts

#### `gst_deadlines`
- Stores generated deadlines for each entity
- Tracks filing status and due dates
- Unique constraint on entity_id, return_type, period_month, period_year

## API Routes

### POST `/api/deadlines/generate`
Generates deadlines for a GST entity

**Request Body:**
```json
{
  "entity_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated N deadlines",
  "deadlines": [...],
  "entity": {...}
}
```

### POST `/api/deadlines/mark-filed`
Marks a deadline as filed

**Request Body:**
```json
{
  "deadline_id": "uuid",
  "proof_url": "optional_url"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deadline marked as filed",
  "deadline": {...}
}
```

## GST Return Types

### Monthly Filing
- **GSTR-1**: Due on 11th of next month
- **GSTR-3B**: Due on 20th of next month

### Quarterly Filing
- **GSTR-1**: Due on 13th of month following quarter
- **GSTR-3B**: Due on 22nd of month following quarter

## Usage

1. **Add GST Entity**: Insert entity data into `gst_entities` table via Supabase
2. **Generate Deadlines**: Click "Generate Deadlines" button for each entity
3. **Track Deadlines**: View upcoming deadlines grouped by month
4. **Mark as Filed**: Click "Mark as Filed" when return is submitted

## Project Structure

```
GST-Project/
├── app/
│   ├── api/
│   │   └── deadlines/
│   │       ├── generate/route.ts
│   │       └── mark-filed/route.ts
│   ├── timeline/
│   │   └── page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── gst/
│   │   └── deadline-generator.ts
│   ├── utils/
│   │   └── date-utils.ts
│   └── supabase.ts
├── database/
│   └── schema.sql
└── package.json
```

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## License

MIT