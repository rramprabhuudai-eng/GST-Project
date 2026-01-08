import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { enqueueWhatsAppMessage } from '@/lib/messaging/queue'
import {
  ReminderStatus,
  DeadlineStatus,
  SendRemindersResult,
  WhatsAppTemplateParameters
} from '@/lib/types'

/**
 * Cron job endpoint to process and send scheduled reminders
 *
 * This endpoint should be called periodically (e.g., every 15 minutes) by a cron service
 *
 * Process:
 * 1. Query reminders due to be sent (send_at <= now AND sent_at IS NULL)
 * 2. For each reminder:
 *    - Check if deadline is still unfiled
 *    - Get contact info with whatsapp_consent = true
 *    - Enqueue message in message_outbox
 *    - Mark reminder as sent
 * 3. Return count of reminders processed
 *
 * @returns JSON response with processing results
 */
export async function POST(request: NextRequest) {
  try {
    const result: SendRemindersResult = {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: []
    }

    // Idempotency: Use a request ID if provided
    const requestId = request.headers.get('x-idempotency-key')
    if (requestId) {
      // TODO: Implement idempotency check using a cache or database table
      // For now, we rely on the sent_at check in the database query
    }

    // Get reminders that are due to be sent
    const now = new Date()
    const dueReminders = await prisma.reminderSchedule.findMany({
      where: {
        send_at: {
          lte: now
        },
        sent_at: null,
        status: ReminderStatus.PENDING
      },
      include: {
        deadline: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                gstin: true,
                whatsapp_number: true,
                whatsapp_consent: true
              }
            }
          }
        }
      },
      orderBy: {
        send_at: 'asc'
      },
      take: 100 // Process in batches
    })

    result.processed = dueReminders.length

    // Process each reminder
    for (const reminder of dueReminders) {
      try {
        const { deadline } = reminder
        const { contact } = deadline

        // Check if deadline is still unfiled
        if (
          deadline.filed_at !== null ||
          deadline.status === DeadlineStatus.FILED
        ) {
          // Skip reminder for filed deadlines
          await prisma.reminderSchedule.update({
            where: { id: reminder.id },
            data: {
              status: ReminderStatus.SKIPPED,
              sent_at: now
            }
          })
          result.skipped++
          continue
        }

        // Check if contact has WhatsApp consent
        if (!contact.whatsapp_consent || !contact.whatsapp_number) {
          // Skip reminder for contacts without consent
          await prisma.reminderSchedule.update({
            where: { id: reminder.id },
            data: {
              status: ReminderStatus.SKIPPED,
              sent_at: now
            }
          })
          result.skipped++
          continue
        }

        // Prepare template parameters
        const parameters: WhatsAppTemplateParameters = {
          gstin: deadline.gstin,
          return_type: deadline.return_type,
          due_date: deadline.due_date.toISOString().split('T')[0] // Format: YYYY-MM-DD
        }

        // Enqueue message for sending
        await enqueueWhatsAppMessage(
          contact.id,
          reminder.template_id,
          parameters,
          now, // Send immediately
          contact.whatsapp_number
        )

        // Mark reminder as sent
        await prisma.reminderSchedule.update({
          where: { id: reminder.id },
          data: {
            status: ReminderStatus.SENT,
            sent_at: now
          }
        })

        result.sent++
      } catch (error: any) {
        console.error(
          `Error processing reminder ${reminder.id}:`,
          error
        )

        // Mark reminder as failed
        await prisma.reminderSchedule.update({
          where: { id: reminder.id },
          data: {
            status: ReminderStatus.FAILED
          }
        })

        result.failed++
        result.errors.push({
          reminder_id: reminder.id,
          error: error.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Error in send-reminders cron job:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for testing the endpoint
 */
export async function GET() {
  return NextResponse.json(
    {
      message: 'Send reminders cron endpoint',
      usage: 'POST to this endpoint to process reminders'
    },
    { status: 200 }
  )
}
