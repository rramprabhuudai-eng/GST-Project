/**
 * Opt-out functionality for WhatsApp messaging
 * Handles contact opt-out and cancellation of pending communications
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OptOutResult {
  success: boolean;
  contactUpdated: boolean;
  remindersCancelled: number;
  messagesCancelled: number;
  error?: string;
}

/**
 * Opt out a contact from WhatsApp communications
 *
 * CRITICAL: This function only cancels pending/scheduled items.
 * It NEVER modifies sent, delivered, failed, or already-cancelled items.
 * This preserves historical data integrity.
 *
 * @param contactId - The ID of the contact opting out
 * @param reason - Optional reason for opting out
 * @returns Result with counts of cancelled items
 */
export async function optOutContact(
  contactId: string,
  reason?: string
): Promise<OptOutResult> {
  try {
    // 1. Update contact consent status
    const { error: contactError } = await supabase
      .from('contacts')
      .update({
        whatsapp_consent: false,
        opt_out_at: new Date().toISOString(),
        consent_change_reason: reason || 'User requested opt-out',
      })
      .eq('id', contactId);

    if (contactError) {
      return {
        success: false,
        contactUpdated: false,
        remindersCancelled: 0,
        messagesCancelled: 0,
        error: `Failed to update contact: ${contactError.message}`,
      };
    }

    // 2. Cancel pending/scheduled reminders ONLY
    // DO NOT modify reminders that are: sent, delivered, failed, cancelled
    // This preserves historical data
    const { data: cancelledReminders, error: remindersError } = await supabase
      .from('reminders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .in('status', ['scheduled', 'queued', 'pending']) // ONLY cancel these statuses
      .select('id');

    if (remindersError) {
      console.error('Error cancelling reminders:', remindersError);
    }

    // 3. Cancel pending/queued messages ONLY
    // DO NOT modify messages that are: sent, delivered, failed, cancelled
    // This preserves historical data
    const { data: cancelledMessages, error: messagesError } = await supabase
      .from('messages')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .in('status', ['queued', 'pending']) // ONLY cancel these statuses
      .select('id');

    if (messagesError) {
      console.error('Error cancelling messages:', messagesError);
    }

    const remindersCancelled = cancelledReminders?.length || 0;
    const messagesCancelled = cancelledMessages?.length || 0;

    console.log(
      `Contact ${contactId} opted out. ` +
      `Cancelled: ${remindersCancelled} reminders, ${messagesCancelled} messages. ` +
      `Reason: ${reason || 'Not specified'}`
    );

    return {
      success: true,
      contactUpdated: true,
      remindersCancelled,
      messagesCancelled,
    };
  } catch (error) {
    console.error('Unexpected error in optOutContact:', error);
    return {
      success: false,
      contactUpdated: false,
      remindersCancelled: 0,
      messagesCancelled: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Opt a contact back in to WhatsApp communications
 *
 * @param contactId - The ID of the contact opting back in
 * @param reason - Optional reason for opting back in
 */
export async function optInContact(
  contactId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('contacts')
      .update({
        whatsapp_consent: true,
        opt_out_at: null, // Clear opt-out timestamp
        consent_change_reason: reason || 'User requested opt-in',
      })
      .eq('id', contactId);

    if (error) {
      return {
        success: false,
        error: `Failed to opt in contact: ${error.message}`,
      };
    }

    console.log(`Contact ${contactId} opted back in. Reason: ${reason || 'Not specified'}`);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in optInContact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a contact has given WhatsApp consent
 *
 * @param contactId - The ID of the contact to check
 * @returns true if contact has consent, false otherwise
 */
export async function hasWhatsAppConsent(contactId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('whatsapp_consent, opt_out_at')
      .eq('id', contactId)
      .single();

    if (error || !data) {
      console.error('Error checking consent:', error);
      return false;
    }

    // Contact must have whatsapp_consent = true AND opt_out_at must be NULL
    return data.whatsapp_consent === true && data.opt_out_at === null;
  } catch (error) {
    console.error('Unexpected error in hasWhatsAppConsent:', error);
    return false;
  }
}
