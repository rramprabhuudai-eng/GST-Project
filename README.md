# GST Management System

A modern web application for managing GST compliance with phone OTP authentication and comprehensive onboarding flow.

## Features

- **Phone OTP Authentication**: Secure authentication using Supabase Auth with SMS OTP
- **Multi-step Onboarding**: Progressive form with business details, GSTIN validation, and WhatsApp consent
- **GSTIN Validation**: Format validation with state code extraction
- **Mobile-first Design**: Responsive UI with proper touch targets and spacing
- **Type-safe**: Built with TypeScript for enhanced developer experience

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account

### Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd GST-Project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Enable Phone authentication in Authentication > Providers
   - Run the SQL from `database-schema.md` to create required tables
   - Copy your project URL and anon key

4. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

6. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
GST-Project/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── verify-gstin/    # GSTIN validation API
│   ├── onboarding/               # Multi-step onboarding page
│   ├── signup/                   # Phone OTP signup page
│   ├── timeline/                 # Main dashboard
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout with AuthProvider
│   └── page.tsx                  # Landing page
├── components/
│   └── auth/
│       ├── AuthProvider.tsx      # Auth context provider
│       └── PhoneOTPForm.tsx      # Phone OTP form component
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   └── server.ts             # Server Supabase client
│   ├── types/
│   │   └── database.ts           # Database type definitions
│   └── validations/
│       ├── gstin.ts              # GSTIN validation utilities
│       └── phone.ts              # Phone validation utilities
└── database-schema.md            # Database schema documentation
```

## Database Schema

The application uses three main tables:

- **accounts**: Business account information
- **contacts**: Contact persons associated with accounts
- **gst_entities**: GST registration details

See `database-schema.md` for detailed schema and setup instructions.

## Authentication Flow

1. User enters phone number (+91 country code)
2. OTP is sent via SMS
3. User enters and verifies OTP
4. On success, redirects to onboarding

## Onboarding Flow

1. **Step 1**: Business name and contact name
2. **Step 2**: GSTIN entry and validation
3. **Step 3**: WhatsApp consent with clear explanation

After completion, user data is saved to database and redirected to the timeline dashboard.

## GSTIN Validation

GSTIN format: `2 digits + 10 alphanumeric + 1 letter + 1 digit + 1 letter`

Example: `27AAPFU0939F1ZV`

The validation extracts:
- State code (first 2 digits)
- Validates format using regex
- Returns state name from code mapping

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Deployment

This project can be deployed to Vercel, Netlify, or any platform that supports Next.js.

Make sure to set the environment variables in your deployment platform.

## License

MIT