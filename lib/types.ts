// Reminder template IDs
export enum ReminderTemplateId {
  T_MINUS_3 = 'gst_deadline_tminus3',
  T_MINUS_1 = 'gst_deadline_tminus1',
  DUE_DAY = 'gst_deadline_dueday'
}

// Reminder status
export enum ReminderStatus {
  PENDING = 'pending',
  SENT = 'sent',
  SKIPPED = 'skipped',
  FAILED = 'failed'
}

// Message status
export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed'
}

// Deadline status
export enum DeadlineStatus {
  PENDING = 'pending',
  FILED = 'filed',
  MISSED = 'missed'
}

// Template parameters for WhatsApp messages
export interface WhatsAppTemplateParameters {
  gstin: string
  return_type: string
  due_date: string
  [key: string]: string
}

// Result type for reminder scheduling
export interface ReminderScheduleResult {
  deadline_id: string
  reminders_created: number
  reminders: Array<{
    id: string
    template_id: string
    send_at: Date
  }>
}

// Result type for message enqueue
export interface EnqueueMessageResult {
  id: string
  contact_id: string
  template_id: string
  scheduled_for: Date
}

// Result type for send reminders cron
export interface SendRemindersResult {
  processed: number
  sent: number
  skipped: number
  failed: number
  errors: Array<{
    reminder_id: string
    error: string
  }>
}

// WhatsApp send result
export interface WhatsAppSendResult {
  success: boolean
  message_id?: string
  error?: string
}
