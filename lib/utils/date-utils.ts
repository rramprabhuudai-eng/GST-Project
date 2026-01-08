import { differenceInDays, format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'

/**
 * Gets a human-readable countdown for a deadline
 * @param dueDate The due date string (YYYY-MM-DD)
 * @returns Countdown string like "3 days away", "Tomorrow", "Today", or "Overdue"
 */
export function getDeadlineCountdown(dueDate: string): string {
  const due = parseISO(dueDate)
  const today = new Date()

  if (isToday(due)) {
    return 'Today'
  }

  if (isTomorrow(due)) {
    return 'Tomorrow'
  }

  if (isPast(due)) {
    const daysOverdue = Math.abs(differenceInDays(due, today))
    return `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`
  }

  const daysUntil = differenceInDays(due, today)
  return `${daysUntil} day${daysUntil > 1 ? 's' : ''} away`
}

/**
 * Formats a date for display
 * @param dateString The date string
 * @param formatString The format string (default: 'MMM dd, yyyy')
 * @returns Formatted date string
 */
export function formatDate(dateString: string, formatString: string = 'MMM dd, yyyy'): string {
  return format(parseISO(dateString), formatString)
}

/**
 * Gets the status color class for a deadline status
 * @param status The deadline status
 * @returns Tailwind color classes
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'filed':
      return 'bg-green-100 text-green-800'
    case 'overdue':
      return 'bg-red-100 text-red-800'
    case 'upcoming':
    default:
      return 'bg-blue-100 text-blue-800'
  }
}

/**
 * Gets urgency color based on days until deadline
 * @param dueDate The due date string
 * @returns Tailwind border color class
 */
export function getUrgencyColor(dueDate: string): string {
  const due = parseISO(dueDate)
  const daysUntil = differenceInDays(due, new Date())

  if (isPast(due)) {
    return 'border-red-500'
  }

  if (daysUntil <= 3) {
    return 'border-orange-500'
  }

  if (daysUntil <= 7) {
    return 'border-yellow-500'
  }

  return 'border-gray-300'
}
