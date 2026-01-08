import { prisma } from '@/lib/db/prisma'
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
  const message = await prisma.messageOutbox.create({
    data: {
      contact_id: contactId,
      template_id: templateId,
      parameters: parameters as any, // Prisma Json type
      phone_number: phoneNumber,
      scheduled_for: scheduledFor,
      status: MessageStatus.PENDING
    },
    select: {
      id: true,
      contact_id: true,
      template_id: true,
      scheduled_for: true
    }
  })

  return message
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
  return await prisma.$transaction(
    messages.map(msg =>
      prisma.messageOutbox.create({
        data: {
          contact_id: msg.contactId,
          template_id: msg.templateId,
          parameters: msg.parameters as any,
          phone_number: msg.phoneNumber,
          scheduled_for: msg.scheduledFor,
          status: MessageStatus.PENDING
        },
        select: {
          id: true,
          contact_id: true,
          template_id: true,
          scheduled_for: true
        }
      })
    )
  )
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
  await prisma.messageOutbox.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.SENT,
      sent_at: new Date(),
      message_id: bspMessageId
    }
  })
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
  errorMessage: string,
  retryCount: number
): Promise<void> {
  await prisma.messageOutbox.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.FAILED,
      error_message: errorMessage,
      retry_count: retryCount
    }
  })
}

/**
 * Gets pending messages that are ready to be sent
 *
 * @param limit - Maximum number of messages to retrieve
 * @returns Promise with array of pending messages
 */
export async function getPendingMessages(limit: number = 100) {
  return await prisma.messageOutbox.findMany({
    where: {
      status: MessageStatus.PENDING,
      scheduled_for: {
        lte: new Date()
      }
    },
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
    },
    orderBy: {
      scheduled_for: 'asc'
    },
    take: limit
  })
}
