import { supabase } from '@/lib/supabase'

/**
 * Result of cancelling reminders and messages for a contact
 */
export interface OptOutResult {
  cancelledReminders: number
  cancelledMessages: number
}

/**
 * Cancels all pending reminders for a contact who has opted out
 *
 * This function:
 * 1. Finds all pending reminders for deadlines belonging to the contact's account
 * 2. Updates their status to 'cancelled'
 * 3. Returns the count of cancelled reminders
 *
 * @param contactId - The ID of the contact opting out
 * @returns Promise with count of cancelled reminders
 */
export async function cancelPendingRemindersForContact(
  contactId: string
): Promise<number> {
  // First, get the account_id for this contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('account_id')
    .eq('id', contactId)
    .single()

  if (contactError || !contact) {
    throw new Error(`Failed to get contact: ${contactError?.message || 'Contact not found'}`)
  }

  // Get all entity IDs for this account
  const { data: entities, error: entitiesError } = await supabase
    .from('gst_entities')
    .select('id')
    .eq('account_id', contact.account_id)

  if (entitiesError) {
    throw new Error(`Failed to get entities: ${entitiesError.message}`)
  }

  if (!entities || entities.length === 0) {
    return 0 // No entities, no reminders to cancel
  }

  const entityIds = entities.map(e => e.id)

  // Get all deadline IDs for these entities
  const { data: deadlines, error: deadlinesError } = await supabase
    .from('deadlines')
    .select('id')
    .in('entity_id', entityIds)

  if (deadlinesError) {
    throw new Error(`Failed to get deadlines: ${deadlinesError.message}`)
  }

  if (!deadlines || deadlines.length === 0) {
    return 0 // No deadlines, no reminders to cancel
  }

  const deadlineIds = deadlines.map(d => d.id)

  // Cancel all pending reminders for these deadlines
  const { data: cancelledReminders, error: reminderError } = await supabase
    .from('reminder_schedule')
    .update({ status: 'cancelled' })
    .in('deadline_id', deadlineIds)
    .eq('status', 'pending')
    .select('id')

  if (reminderError) {
    throw new Error(`Failed to cancel reminders: ${reminderError.message}`)
  }

  return cancelledReminders?.length || 0
}

/**
 * Cancels all pending messages for a contact who has opted out
 *
 * This function:
 * 1. Finds all queued messages for the contact
 * 2. Updates their delivery_status to 'cancelled'
 * 3. Returns the count of cancelled messages
 *
 * @param contactId - The ID of the contact opting out
 * @returns Promise with count of cancelled messages
 */
export async function cancelPendingMessagesForContact(
  contactId: string
): Promise<number> {
  const { data: cancelledMessages, error } = await supabase
    .from('message_outbox')
    .update({ delivery_status: 'cancelled' })
    .eq('contact_id', contactId)
    .eq('delivery_status', 'queued')
    .select('id')

  if (error) {
    throw new Error(`Failed to cancel messages: ${error.message}`)
  }

  return cancelledMessages?.length || 0
}

/**
 * Cancels all pending reminders and messages for a contact
 *
 * This is the main opt-out handler that should be called when a user
 * opts out of WhatsApp communications. It ensures that:
 * 1. No more reminders will be generated (status changed to 'cancelled')
 * 2. No queued messages will be sent (status changed to 'cancelled')
 *
 * @param contactId - The ID of the contact opting out
 * @returns Promise with OptOutResult containing counts of cancelled items
 */
export async function cancelAllPendingReminders(
  contactId: string
): Promise<OptOutResult> {
  try {
    // Cancel reminders and messages in parallel for better performance
    const [cancelledReminders, cancelledMessages] = await Promise.all([
      cancelPendingRemindersForContact(contactId),
      cancelPendingMessagesForContact(contactId)
    ])

    return {
      cancelledReminders,
      cancelledMessages
    }
  } catch (error) {
    throw new Error(
      `Failed to cancel pending communications: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Re-enables reminders for a contact who is opting back in
 *
 * Note: This only clears the opt-out status. It does NOT re-create
 * reminders that were previously cancelled. New reminders will be
 * created for upcoming deadlines during the next reminder generation cycle.
 *
 * @param contactId - The ID of the contact opting back in
 * @returns Promise that resolves when opt-in is complete
 */
export async function optInContact(contactId: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({
      whatsapp_consent: true,
      opt_out_at: null,
      consent_change_reason: 'User opted back in via settings'
    })
    .eq('id', contactId)

  if (error) {
    throw new Error(`Failed to opt in contact: ${error.message}`)
  }
}
