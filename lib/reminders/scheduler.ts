import { prisma } from '@/lib/db/prisma'
import {
  ReminderTemplateId,
  ReminderStatus,
  ReminderScheduleResult,
  DeadlineStatus
} from '@/lib/types'

/**
 * Creates a reminder schedule for a deadline
 *
 * Schedules three reminders:
 * - T-3 days: First reminder
 * - T-1 day: Second reminder
 * - Due day: Final reminder
 *
 * @param deadlineId - The ID of the deadline to schedule reminders for
 * @returns Promise with the result of reminder creation
 */
export async function createReminderSchedule(
  deadlineId: string
): Promise<ReminderScheduleResult> {
  // Fetch the deadline to get the due date
  const deadline = await prisma.deadline.findUnique({
    where: { id: deadlineId },
    select: {
      id: true,
      due_date: true,
      filed_at: true,
      status: true
    }
  })

  if (!deadline) {
    throw new Error(`Deadline not found: ${deadlineId}`)
  }

  // Skip if deadline is already filed
  if (deadline.filed_at || deadline.status === DeadlineStatus.FILED) {
    return {
      deadline_id: deadlineId,
      reminders_created: 0,
      reminders: []
    }
  }

  const dueDate = new Date(deadline.due_date)
  const now = new Date()

  // Calculate reminder dates
  const tMinus3 = new Date(dueDate)
  tMinus3.setDate(tMinus3.getDate() - 3)
  tMinus3.setHours(9, 0, 0, 0) // Send at 9 AM

  const tMinus1 = new Date(dueDate)
  tMinus1.setDate(tMinus1.getDate() - 1)
  tMinus1.setHours(9, 0, 0, 0) // Send at 9 AM

  const dueDay = new Date(dueDate)
  dueDay.setHours(9, 0, 0, 0) // Send at 9 AM

  // Prepare reminder records (only create for future dates)
  const remindersToCreate = []

  if (tMinus3 > now) {
    remindersToCreate.push({
      deadline_id: deadlineId,
      template_id: ReminderTemplateId.T_MINUS_3,
      send_at: tMinus3,
      status: ReminderStatus.PENDING
    })
  }

  if (tMinus1 > now) {
    remindersToCreate.push({
      deadline_id: deadlineId,
      template_id: ReminderTemplateId.T_MINUS_1,
      send_at: tMinus1,
      status: ReminderStatus.PENDING
    })
  }

  if (dueDay > now) {
    remindersToCreate.push({
      deadline_id: deadlineId,
      template_id: ReminderTemplateId.DUE_DAY,
      send_at: dueDay,
      status: ReminderStatus.PENDING
    })
  }

  // Insert reminders in a transaction
  const createdReminders = await prisma.$transaction(
    remindersToCreate.map(reminder =>
      prisma.reminderSchedule.create({
        data: reminder,
        select: {
          id: true,
          template_id: true,
          send_at: true
        }
      })
    )
  )

  return {
    deadline_id: deadlineId,
    reminders_created: createdReminders.length,
    reminders: createdReminders
  }
}

/**
 * Creates reminder schedules for multiple deadlines
 *
 * @param deadlineIds - Array of deadline IDs
 * @returns Promise with array of results
 */
export async function createReminderSchedules(
  deadlineIds: string[]
): Promise<ReminderScheduleResult[]> {
  const results = await Promise.allSettled(
    deadlineIds.map(id => createReminderSchedule(id))
  )

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      // Return empty result for failed schedules
      console.error(
        `Failed to create reminder schedule for deadline ${deadlineIds[index]}:`,
        result.reason
      )
      return {
        deadline_id: deadlineIds[index],
        reminders_created: 0,
        reminders: []
      }
    }
  })
}
