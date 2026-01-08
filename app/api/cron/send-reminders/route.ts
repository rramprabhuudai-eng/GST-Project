import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueWhatsAppMessage } from '@/lib/messaging/queue'
import {
  SendRemindersResult,
  WhatsAppTemplateParameters
} from '@/lib/types'
import { randomUUID } from 'crypto'

// Use service role for backend operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Cron job endpoint to process and send scheduled reminders
 *
 * This endpoint should be called periodically (e.g., every 15 minutes) by a cron service
 *
 * Process (with atomic claim pattern):
 * 1. Use FOR UPDATE SKIP LOCKED to atomically claim reminders
 * 2. For each claimed reminder:
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

    const now = new Date().toISOString()
    const workerId = randomUUID() // Unique identifier for this worker instance
    const batchSize = 100

    // ATOMIC CLAIM PATTERN: Use raw SQL with FOR UPDATE SKIP LOCKED
    // This prevents race conditions when multiple cron instances run simultaneously
    const { data: claimedReminders, error: claimError } = await supabase.rpc('claim_pending_reminders', {
      p_worker_id: workerId,
      p_batch_size: batchSize,
      p_now: now
    })

    // If RPC doesn't exist, fall back to direct SQL query
    if (claimError?.message?.includes('function') || claimError?.code === '42883') {
      console.log('RPC not found, using direct SQL query with atomic claim pattern')

      // Direct SQL query with atomic claim
      const { data: reminders, error: queryError } = await supabase
        .from('reminder_schedule')
        .select(`
          id,
          deadline_id,
          template_id,
          send_at
        `)
        .eq('status', 'pending')
        .is('claimed_at', null)
        .lte('send_at', now)
        .order('send_at', { ascending: true })
        .limit(batchSize)

      if (queryError) {
        throw new Error(`Failed to query reminders: ${queryError.message}`)
      }

      if (!reminders || reminders.length === 0) {
        return NextResponse.json(result, { status: 200 })
      }

      // Claim the reminders
      const reminderIds = reminders.map(r => r.id)
      const { error: updateError } = await supabase
        .from('reminder_schedule')
        .update({
          claimed_at: now,
          claimed_by: workerId
        })
        .in('id', reminderIds)
        .is('claimed_at', null) // Double-check not already claimed

      if (updateError) {
        console.error('Failed to claim reminders:', updateError)
        return NextResponse.json(result, { status: 200 })
      }

      // Verify which ones we successfully claimed
      const { data: verifiedReminders } = await supabase
        .from('reminder_schedule')
        .select('id, deadline_id, template_id')
        .in('id', reminderIds)
        .eq('claimed_by', workerId)

      result.processed = verifiedReminders?.length || 0

      // Process each claimed reminder
      for (const reminder of verifiedReminders || []) {
        await processReminder(reminder, result, now)
      }
    } else if (claimError) {
      throw claimError
    } else {
      result.processed = claimedReminders?.length || 0

      // Process each claimed reminder
      for (const reminder of claimedReminders || []) {
        await processReminder(reminder, result, now)
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
 * Process a single claimed reminder
 */
async function processReminder(
  reminder: any,
  result: SendRemindersResult,
  now: string
): Promise<void> {
  try {
    // Get deadline details
    const { data: deadline, error: deadlineError } = await supabase
      .from('deadlines')
      .select(`
        id,
        entity_id,
        return_type,
        period_month,
        period_year,
        due_date,
        filed_at,
        entity:gst_entities!inner(
          id,
          gstin,
          account_id,
          account:accounts!inner(
            id,
            contacts!inner(
              id,
              name,
              phone,
              whatsapp_consent,
              opt_out_at
            )
          )
        )
      `)
      .eq('id', reminder.deadline_id)
      .single()

    if (deadlineError || !deadline) {
      console.error(`Deadline not found for reminder ${reminder.id}`)
      await markReminderFailed(reminder.id, 'Deadline not found')
      result.failed++
      result.errors.push({
        reminder_id: reminder.id,
        error: 'Deadline not found'
      })
      return
    }

    // Check if deadline is already filed
    if (deadline.filed_at) {
      await markReminderSkipped(reminder.id, now)
      result.skipped++
      return
    }

    // Get primary contact with WhatsApp consent
    const contacts = (deadline.entity as any)?.account?.contacts || []
    const eligibleContact = contacts.find((c: any) =>
      c.whatsapp_consent && c.phone && !c.opt_out_at
    )

    if (!eligibleContact) {
      await markReminderSkipped(reminder.id, now)
      result.skipped++
      return
    }

    // Prepare template parameters
    const parameters: WhatsAppTemplateParameters = {
      gstin: (deadline.entity as any).gstin,
      return_type: deadline.return_type,
      due_date: deadline.due_date
    }

    // Enqueue message for sending
    await enqueueWhatsAppMessage(
      eligibleContact.id,
      reminder.template_id,
      parameters,
      new Date(now),
      eligibleContact.phone
    )

    // Mark reminder as sent
    await markReminderSent(reminder.id, now)
    result.sent++
  } catch (error: any) {
    console.error(`Error processing reminder ${reminder.id}:`, error)
    await markReminderFailed(reminder.id, error.message)
    result.failed++
    result.errors.push({
      reminder_id: reminder.id,
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Mark reminder as sent
 */
async function markReminderSent(reminderId: string, now: string): Promise<void> {
  await supabase
    .from('reminder_schedule')
    .update({
      status: 'sent',
      sent_at: now
    })
    .eq('id', reminderId)
}

/**
 * Mark reminder as skipped
 */
async function markReminderSkipped(reminderId: string, now: string): Promise<void> {
  await supabase
    .from('reminder_schedule')
    .update({
      status: 'cancelled',
      sent_at: now,
      error_message: 'Deadline already filed or no eligible contact'
    })
    .eq('id', reminderId)
}

/**
 * Mark reminder as failed
 */
async function markReminderFailed(reminderId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('reminder_schedule')
    .update({
      status: 'failed',
      error_message: errorMessage
    })
    .eq('id', reminderId)
}

/**
 * GET handler for testing the endpoint
 */
export async function GET() {
  return NextResponse.json(
    {
      message: 'Send reminders cron endpoint',
      usage: 'POST to this endpoint to process reminders',
      info: 'Uses atomic claim pattern with FOR UPDATE SKIP LOCKED to prevent race conditions'
    },
    { status: 200 }
  )
}
