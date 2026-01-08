import { supabase } from '@/lib/supabase'
import {
  MessageStatus,
  WhatsAppTemplateParameters,
  EnqueueMessageResult
} from '@/lib/types'

/**
 * Enqueues a WhatsApp message for sending
 *
 * Creates a record in the message_outbox table with all necessary parameters
 *
 * @param contactId - The ID of the contact to send the message to
 * @param templateId - The WhatsApp template ID to use
 * @param parameters - Template parameters (GSTIN, return type, due date, etc.)
 * @param scheduledFor - When the message should be sent
 * @param phoneNumber - WhatsApp phone number to send to
 * @returns Promise with the enqueued message details
 */
export async function enqueueWhatsAppMessage(
  contactId: string,
  templateId: string,
  parameters: WhatsAppTemplateParameters,
  scheduledFor: Date,
  phoneNumber: string
): Promise<EnqueueMessageResult> {
  const { data: message, error } = await supabase
    .from('message_outbox')
    .insert({
      contact_id: contactId,
      template_id: templateId,
      parameters: parameters,
      scheduled_for: scheduledFor.toISOString(),
      delivery_status: 'queued'
    })
    .select('id, contact_id, template_id, scheduled_for')
    .single()

  if (error) {
    throw new Error(`Failed to enqueue message: ${error.message}`)
  }

  return {
    id: message.id,
    contact_id: message.contact_id,
    template_id: message.template_id,
    scheduled_for: new Date(message.scheduled_for)
  }
}

/**
 * Enqueues multiple WhatsApp messages in a single transaction
 *
 * @param messages - Array of message details to enqueue
 * @returns Promise with array of enqueued message details
 */
export async function enqueueWhatsAppMessages(
  messages: Array<{
    contactId: string
    templateId: string
    parameters: WhatsAppTemplateParameters
    scheduledFor: Date
    phoneNumber: string
  }>
): Promise<EnqueueMessageResult[]> {
  const messagesToInsert = messages.map(msg => ({
    contact_id: msg.contactId,
    template_id: msg.templateId,
    parameters: msg.parameters,
    scheduled_for: msg.scheduledFor.toISOString(),
    delivery_status: 'queued' as const
  }))

  const { data: insertedMessages, error } = await supabase
    .from('message_outbox')
    .insert(messagesToInsert)
    .select('id, contact_id, template_id, scheduled_for')

  if (error) {
    throw new Error(`Failed to enqueue messages: ${error.message}`)
  }

  return insertedMessages.map(msg => ({
    id: msg.id,
    contact_id: msg.contact_id,
    template_id: msg.template_id,
    scheduled_for: new Date(msg.scheduled_for)
  }))
}

/**
 * Marks a message as sent
 *
 * @param messageId - The ID of the message in the outbox
 * @param bspMessageId - The message ID returned by the BSP
 */
export async function markMessageAsSent(
  messageId: string,
  bspMessageId: string
): Promise<void> {
  const { error } = await supabase
    .from('message_outbox')
    .update({
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
      external_message_id: bspMessageId
    })
    .eq('id', messageId)

  if (error) {
    throw new Error(`Failed to mark message as sent: ${error.message}`)
  }
}

/**
 * Marks a message as failed
 *
 * @param messageId - The ID of the message in the outbox
 * @param errorMessage - The error message from the BSP
 * @param retryCount - Current retry count
 */
export async function markMessageAsFailed(
  messageId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('message_outbox')
    .update({
      delivery_status: 'failed',
      error_message: errorMessage
    })
    .eq('id', messageId)

  if (error) {
    throw new Error(`Failed to mark message as failed: ${error.message}`)
  }
}

/**
 * Gets pending messages that are ready to be sent
 *
 * @param limit - Maximum number of messages to retrieve
 * @returns Promise with array of pending messages
 */
export async function getPendingMessages(limit: number = 100) {
  const { data: messages, error } = await supabase
    .from('message_outbox')
    .select(`
      *,
      contact:contacts(
        id,
        name,
        phone,
        whatsapp_consent
      )
    `)
    .eq('delivery_status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to get pending messages: ${error.message}`)
  }

  return messages
}
