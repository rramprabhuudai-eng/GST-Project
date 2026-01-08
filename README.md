# GST-Project - WhatsApp Reminder Scheduler

A Next.js application with WhatsApp reminder scheduling and message queue system for GST compliance deadlines.

## Features

- **Deadline Management**: Create and track GST filing deadlines
- **Automated Reminder Scheduling**: Automatically schedule reminders at T-3 days, T-1 day, and due day
- **WhatsApp Integration**: Send reminders via WhatsApp (BSP integration ready)
- **Message Queue System**: Robust message queuing with retry capabilities
- **Contact Management**: Manage contacts with WhatsApp consent tracking

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Messaging**: WhatsApp Business API (adapter stub included)

## Project Structure

```
GST-Project/
├── app/
│   └── api/
│       ├── cron/
│       │   └── send-reminders/    # Cron job for processing reminders
│       └── deadlines/
│           └── generate/          # API to create deadlines and schedule reminders
├── lib/
│   ├── db/
│   │   └── prisma.ts              # Prisma client singleton
│   ├── reminders/
│   │   └── scheduler.ts           # Reminder scheduling logic
│   ├── messaging/
│   │   ├── queue.ts               # Message queue management
│   │   └── whatsapp-adapter.ts   # WhatsApp BSP adapter (stub)
│   └── types.ts                   # Shared TypeScript types
├── prisma/
│   └── schema.prisma              # Database schema
└── package.json
```

## Database Schema

### Tables

1. **contacts**: Store contact information with WhatsApp consent
2. **deadlines**: GST filing deadlines linked to contacts
3. **reminder_schedule**: Scheduled reminders for deadlines
4. **message_outbox**: Message queue for WhatsApp messages

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `WHATSAPP_BSP_API_URL`: WhatsApp BSP API endpoint (optional for now)
- `WHATSAPP_BSP_API_KEY`: WhatsApp BSP API key (optional for now)
- `WHATSAPP_BSP_FROM_NUMBER`: WhatsApp business number (optional for now)

### 3. Initialize Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

### 4. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## API Endpoints

### POST /api/deadlines/generate

Create deadlines and automatically schedule reminders.

**Request Body:**
```json
{
  "contact_id": "contact_123",
  "gstin": "29ABCDE1234F1Z5",
  "deadlines": [
    {
      "return_type": "GSTR-1",
      "period": "2024-01",
      "due_date": "2024-02-11"
    },
    {
      "return_type": "GSTR-3B",
      "period": "2024-01",
      "due_date": "2024-02-20"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "deadlines_created": 2,
  "reminders_scheduled": 6,
  "deadlines": [...],
  "reminder_schedules": [...]
}
```

### GET /api/deadlines/generate

Retrieve deadlines for a contact.

**Query Parameters:**
- `contact_id` or `gstin` (required)

**Example:**
```
GET /api/deadlines/generate?contact_id=contact_123
```

### POST /api/cron/send-reminders

Process scheduled reminders (to be called by a cron service).

**Headers:**
- `x-idempotency-key` (optional): Idempotency key for duplicate prevention

**Response:**
```json
{
  "processed": 10,
  "sent": 8,
  "skipped": 1,
  "failed": 1,
  "errors": [...]
}
```

## Reminder Scheduling Logic

When a deadline is created:

1. **T-3 days reminder**: Scheduled 3 days before due date at 9 AM
2. **T-1 day reminder**: Scheduled 1 day before due date at 9 AM
3. **Due day reminder**: Scheduled on due date at 9 AM

Reminders are only created for future dates and skipped if:
- Deadline is already filed
- Contact has no WhatsApp consent
- Contact has no WhatsApp number

## Message Queue System

Messages are queued in the `message_outbox` table with:
- Template ID and parameters
- Scheduled time
- Contact information
- Status tracking (pending, sent, failed)
- Retry count

The cron job `/api/cron/send-reminders` processes the queue periodically.

## WhatsApp Integration

The WhatsApp adapter (`/lib/messaging/whatsapp-adapter.ts`) is currently a stub that logs messages to the console.

To integrate with a real WhatsApp BSP:

1. Choose a BSP (Twilio, Meta Cloud API, Gupshup, etc.)
2. Update environment variables with BSP credentials
3. Implement the actual API calls in `sendTemplateMessage()`
4. Configure WhatsApp message templates in your BSP dashboard

Template IDs used:
- `gst_deadline_tminus3`: T-3 days reminder
- `gst_deadline_tminus1`: T-1 day reminder
- `gst_deadline_dueday`: Due day reminder

## Cron Job Setup

The `/api/cron/send-reminders` endpoint should be called periodically (e.g., every 15 minutes).

### Using Vercel Cron

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### Using External Cron Service

Configure your service to POST to:
```
https://your-domain.com/api/cron/send-reminders
```

## Development

### Database Migrations

When changing the schema:

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Type Generation

After schema changes:

```bash
npm run prisma:generate
```

## Production Deployment

1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Deploy to your hosting platform (Vercel, Railway, etc.)
5. Set up cron job for reminder processing

## Security Considerations

- Validate all user inputs
- Implement rate limiting on API endpoints
- Secure cron endpoints with API keys or IP whitelisting
- Use HTTPS in production
- Properly handle BSP API credentials
- Implement proper error handling and logging
- Add authentication/authorization as needed

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.