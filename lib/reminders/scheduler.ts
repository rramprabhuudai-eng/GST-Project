/**
 * Reminder scheduling functionality
 * Creates and manages GST return reminders for contacts
 *
 * CRITICAL: Only creates reminders for contacts with active consent
 * (whatsapp_consent = true AND opt_out_at IS NULL)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ScheduleReminderParams {
  contactId: string;
  scheduledAt: Date;
  message: string;
  reminderType?: 'gst_return' | 'payment' | 'filing' | 'other';
}

interface ScheduleReminderResult {
  success: boolean;
  reminderId?: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Schedule a reminder for a contact
 *
 * CRITICAL: This function checks consent before creating reminders.
 * Reminders are ONLY created if:
 * - whatsapp_consent = true
 * - opt_out_at IS NULL
 *
 * If a contact has opted out, the reminder is NOT created.
 *
 * @param params - Reminder parameters
 * @returns Result indicating success, skip, or error
 */
export async function scheduleReminder(
  params: ScheduleReminderParams
): Promise<ScheduleReminderResult> {
  const { contactId, scheduledAt, message, reminderType = 'gst_return' } = params;

  try {
    // CRITICAL: Check consent status BEFORE creating reminder
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, whatsapp_consent, opt_out_at')
      .eq('id', contactId)
      .single();

    if (contactError) {
      return {
        success: false,
        error: `Failed to fetch contact: ${contactError.message}`,
      };
    }

    if (!contact) {
      return {
        success: false,
        error: 'Contact not found',
      };
    }

    // Check if contact has given consent
    // ONLY create reminder if whatsapp_consent = true AND opt_out_at IS NULL
    if (contact.whatsapp_consent !== true || contact.opt_out_at !== null) {
      console.log(
        `Skipping reminder creation for contact ${contactId} (${contact.name}): ` +
        `No consent (whatsapp_consent=${contact.whatsapp_consent}, opt_out_at=${contact.opt_out_at})`
      );

      return {
        success: true,
        skipped: true,
        error: 'Contact has opted out or not given consent',
      };
    }

    // Contact has consent - proceed with creating reminder
    const { data: reminder, error: reminderError } = await supabase
      .from('reminders')
      .insert({
        contact_id: contactId,
        scheduled_at: scheduledAt.toISOString(),
        message,
        reminder_type: reminderType,
        status: 'scheduled',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (reminderError) {
      return {
        success: false,
        error: `Failed to create reminder: ${reminderError.message}`,
      };
    }

    console.log(
      `Reminder ${reminder.id} scheduled for contact ${contactId} (${contact.name}) ` +
      `at ${scheduledAt.toISOString()}`
    );

    return {
      success: true,
      reminderId: reminder.id,
    };
  } catch (error) {
    console.error('Unexpected error in scheduleReminder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Schedule reminders for multiple contacts
 *
 * CRITICAL: Automatically filters out contacts without consent.
 * Only creates reminders for contacts where:
 * - whatsapp_consent = true
 * - opt_out_at IS NULL
 *
 * @param contactIds - Array of contact IDs
 * @param scheduledAt - When to send the reminder
 * @param message - Reminder message
 * @param reminderType - Type of reminder
 * @returns Results for each contact
 */
export async function scheduleBulkReminders(
  contactIds: string[],
  scheduledAt: Date,
  message: string,
  reminderType?: 'gst_return' | 'payment' | 'filing' | 'other'
): Promise<{
  success: number;
  skipped: number;
  failed: number;
  results: ScheduleReminderResult[];
}> {
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const results: ScheduleReminderResult[] = [];

  // CRITICAL: Fetch all contacts and filter by consent BEFORE creating reminders
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, name, whatsapp_consent, opt_out_at')
    .in('id', contactIds);

  if (contactsError) {
    console.error('Error fetching contacts for bulk reminders:', contactsError);
    return {
      success: 0,
      skipped: 0,
      failed: contactIds.length,
      results: contactIds.map(id => ({
        success: false,
        error: 'Failed to fetch contacts',
      })),
    };
  }

  // Filter contacts with consent
  const contactsWithConsent = contacts.filter(
    c => c.whatsapp_consent === true && c.opt_out_at === null
  );

  const contactsWithoutConsent = contacts.filter(
    c => c.whatsapp_consent !== true || c.opt_out_at !== null
  );

  console.log(
    `Bulk reminder scheduling: ${contactsWithConsent.length} with consent, ` +
    `${contactsWithoutConsent.length} without consent (will skip)`
  );

  // Log skipped contacts
  for (const contact of contactsWithoutConsent) {
    console.log(
      `Skipping contact ${contact.id} (${contact.name}): ` +
      `No consent (whatsapp_consent=${contact.whatsapp_consent}, opt_out_at=${contact.opt_out_at})`
    );

    results.push({
      success: true,
      skipped: true,
      error: 'Contact has opted out or not given consent',
    });

    skippedCount++;
  }

  // Create reminders only for contacts with consent
  if (contactsWithConsent.length > 0) {
    const remindersToInsert = contactsWithConsent.map(contact => ({
      contact_id: contact.id,
      scheduled_at: scheduledAt.toISOString(),
      message,
      reminder_type: reminderType || 'gst_return',
      status: 'scheduled',
      created_at: new Date().toISOString(),
    }));

    const { data: insertedReminders, error: insertError } = await supabase
      .from('reminders')
      .insert(remindersToInsert)
      .select('id, contact_id');

    if (insertError) {
      console.error('Error inserting bulk reminders:', insertError);
      failedCount += contactsWithConsent.length;

      for (let i = 0; i < contactsWithConsent.length; i++) {
        results.push({
          success: false,
          error: `Failed to create reminder: ${insertError.message}`,
        });
      }
    } else {
      successCount = insertedReminders.length;

      for (const reminder of insertedReminders) {
        results.push({
          success: true,
          reminderId: reminder.id,
        });
      }

      console.log(
        `Successfully scheduled ${successCount} reminders for ${scheduledAt.toISOString()}`
      );
    }
  }

  return {
    success: successCount,
    skipped: skippedCount,
    failed: failedCount,
    results,
  };
}

/**
 * Cancel a scheduled reminder
 *
 * @param reminderId - ID of the reminder to cancel
 * @returns Success status
 */
export async function cancelReminder(
  reminderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reminders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reminderId)
      .in('status', ['scheduled', 'queued', 'pending']); // Only cancel if not sent yet

    if (error) {
      return {
        success: false,
        error: `Failed to cancel reminder: ${error.message}`,
      };
    }

    console.log(`Reminder ${reminderId} cancelled`);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in cancelReminder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get upcoming reminders for a contact
 *
 * @param contactId - Contact ID
 * @param limit - Maximum number of reminders to return
 * @returns Array of upcoming reminders
 */
export async function getUpcomingReminders(
  contactId: string,
  limit: number = 10
) {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('contact_id', contactId)
      .in('status', ['scheduled', 'queued', 'pending'])
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching upcoming reminders:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error in getUpcomingReminders:', error);
    return [];
  }
}
