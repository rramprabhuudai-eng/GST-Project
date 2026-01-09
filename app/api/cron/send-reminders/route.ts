/**
 * Cron job to send scheduled WhatsApp reminders
 * Runs periodically to process due reminders
 *
 * CRITICAL: Only sends reminders to contacts with active consent
 * (whatsapp_consent = true AND opt_out_at IS NULL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ReminderWithContact {
  id: string;
  contact_id: string;
  scheduled_at: string;
  message: string;
  status: string;
  contacts: {
    id: string;
    phone: string;
    name: string;
    whatsapp_consent: boolean;
    opt_out_at: string | null;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization (if using Vercel Cron or similar)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Fetch due reminders with contact information
    // CRITICAL: JOIN with contacts table to check consent status
    const { data: reminders, error: fetchError } = await supabase
      .from('reminders')
      .select(`
        id,
        contact_id,
        scheduled_at,
        message,
        status,
        contacts!inner (
          id,
          phone,
          name,
          whatsapp_consent,
          opt_out_at
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(100); // Process in batches

    if (fetchError) {
      console.error('Error fetching reminders:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch reminders', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        skipped: 0,
        message: 'No reminders due',
      });
    }

    let sentCount = 0;
    let skippedCount = 0;
    const results = [];

    // Process each reminder
    for (const reminder of reminders as unknown as ReminderWithContact[]) {
      const contact = reminder.contacts;

      // CRITICAL: Check consent status
      // Only send if whatsapp_consent = true AND opt_out_at IS NULL
      if (contact.whatsapp_consent !== true || contact.opt_out_at !== null) {
        // Skip this reminder - contact has opted out
        skippedCount++;

        // Update reminder status to cancelled with reason
        await supabase
          .from('reminders')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        console.log(
          `Skipped reminder ${reminder.id} for contact ${contact.id} (${contact.name}): ` +
          `No consent (whatsapp_consent=${contact.whatsapp_consent}, opt_out_at=${contact.opt_out_at})`
        );

        results.push({
          reminderId: reminder.id,
          contactId: contact.id,
          status: 'skipped',
          reason: 'Contact opted out or no consent',
        });

        continue; // Skip to next reminder
      }

      // Contact has consent - proceed with sending
      try {
        // TODO: Integrate with actual WhatsApp API
        // For now, simulate sending
        const sent = await sendWhatsAppMessage(contact.phone, reminder.message);

        if (sent) {
          // Update reminder status to sent
          await supabase
            .from('reminders')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);

          // Create message record
          await supabase.from('messages').insert({
            contact_id: contact.id,
            reminder_id: reminder.id,
            message: reminder.message,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

          sentCount++;

          console.log(
            `Sent reminder ${reminder.id} to contact ${contact.id} (${contact.name})`
          );

          results.push({
            reminderId: reminder.id,
            contactId: contact.id,
            status: 'sent',
          });
        } else {
          // Mark as failed
          await supabase
            .from('reminders')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);

          results.push({
            reminderId: reminder.id,
            contactId: contact.id,
            status: 'failed',
            reason: 'WhatsApp send failed',
          });
        }
      } catch (error) {
        console.error(`Error sending reminder ${reminder.id}:`, error);

        // Mark as failed
        await supabase
          .from('reminders')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        results.push({
          reminderId: reminder.id,
          contactId: contact.id,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `Cron job completed: Processed ${reminders.length} reminders, ` +
      `Sent ${sentCount}, Skipped ${skippedCount} (no consent)`
    );

    return NextResponse.json({
      success: true,
      processed: reminders.length,
      sent: sentCount,
      skipped: skippedCount,
      results,
    });
  } catch (error) {
    console.error('Unexpected error in send-reminders cron:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Send WhatsApp message
 * TODO: Replace with actual WhatsApp Business API integration
 *
 * @param phone - Recipient phone number
 * @param message - Message to send
 * @returns true if sent successfully, false otherwise
 */
async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<boolean> {
  // TODO: Implement actual WhatsApp API call
  // For now, simulate success
  console.log(`[SIMULATED] Sending WhatsApp to ${phone}: ${message}`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  return true;
}
