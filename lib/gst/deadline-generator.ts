import { addMonths, setDate, isWeekend, addDays, startOfMonth, format } from 'date-fns'

export interface GSTDeadline {
  return_type: string
  period_month: number
  period_year: number
  due_date: string
}

export type FilingFrequency = 'monthly' | 'quarterly'

interface DeadlineConfig {
  return_type: string
  day: number
  frequency: FilingFrequency
}

// GST deadline configurations based on Indian GST rules
const DEADLINE_CONFIGS: DeadlineConfig[] = [
  { return_type: 'GSTR-1', day: 11, frequency: 'monthly' },
  { return_type: 'GSTR-3B', day: 20, frequency: 'monthly' },
  { return_type: 'GSTR-1', day: 13, frequency: 'quarterly' },
  { return_type: 'GSTR-3B', day: 22, frequency: 'quarterly' }, // Using 22nd for quarterly (can be 24th for some states)
]

/**
 * Moves a date to the next working day if it falls on a weekend
 * @param date The date to check
 * @returns The date or next working day if weekend
 */
function moveToNextWorkingDay(date: Date): Date {
  let workingDate = new Date(date)

  while (isWeekend(workingDate)) {
    workingDate = addDays(workingDate, 1)
  }

  return workingDate
}

/**
 * Gets the period (month/year) for a return based on frequency
 * @param baseDate The base date to calculate from
 * @param frequency Filing frequency
 * @param monthsBack How many periods back
 * @returns Object with period_month and period_year
 */
function getPeriodForReturn(
  baseDate: Date,
  frequency: FilingFrequency,
  monthsBack: number
): { period_month: number; period_year: number } {
  const periodDate = addMonths(baseDate, -monthsBack)

  if (frequency === 'quarterly') {
    // For quarterly, round down to the start of the quarter
    const month = periodDate.getMonth() + 1
    const quarterEndMonth = Math.floor((month - 1) / 3) * 3 + 3

    return {
      period_month: quarterEndMonth,
      period_year: periodDate.getFullYear()
    }
  }

  return {
    period_month: periodDate.getMonth() + 1,
    period_year: periodDate.getFullYear()
  }
}

/**
 * Calculates the due date for a GST return
 * @param period_month The period month (1-12)
 * @param period_year The period year
 * @param day The day of the month for the deadline
 * @param frequency Filing frequency
 * @returns The due date as a Date object
 */
function calculateDueDate(
  period_month: number,
  period_year: number,
  day: number,
  frequency: FilingFrequency
): Date {
  // For monthly: due date is in the next month
  // For quarterly: due date is in the month after the quarter ends
  const monthsToAdd = frequency === 'monthly' ? 1 : 1

  const periodDate = new Date(period_year, period_month - 1, 1)
  const dueMonthDate = addMonths(periodDate, monthsToAdd)

  // Set the day
  let dueDate = setDate(dueMonthDate, day)

  // Move to next working day if weekend
  dueDate = moveToNextWorkingDay(dueDate)

  return dueDate
}

/**
 * Generates GST return deadlines for the next 12 months
 * @param filingFrequency The filing frequency (monthly or quarterly)
 * @param startDate Optional start date (defaults to current date)
 * @returns Array of deadline objects
 */
export function generateDeadlines(
  filingFrequency: FilingFrequency,
  startDate: Date = new Date()
): GSTDeadline[] {
  const deadlines: GSTDeadline[] = []
  const currentDate = startOfMonth(startDate)

  // Generate deadlines for the next 12 months
  const monthsToGenerate = 12
  const periodsToGenerate = filingFrequency === 'monthly' ? monthsToGenerate : Math.ceil(monthsToGenerate / 3)

  // Filter configs by frequency
  const relevantConfigs = DEADLINE_CONFIGS.filter(
    config => config.frequency === filingFrequency
  )

  for (let i = 0; i < periodsToGenerate; i++) {
    const monthsBack = filingFrequency === 'monthly' ? i : i * 3

    for (const config of relevantConfigs) {
      const period = getPeriodForReturn(currentDate, filingFrequency, monthsBack)
      const dueDate = calculateDueDate(
        period.period_month,
        period.period_year,
        config.day,
        filingFrequency
      )

      // Only include future deadlines (including current month)
      if (dueDate >= startOfMonth(startDate)) {
        deadlines.push({
          return_type: config.return_type,
          period_month: period.period_month,
          period_year: period.period_year,
          due_date: format(dueDate, 'yyyy-MM-dd')
        })
      }
    }
  }

  // Sort by due date
  deadlines.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

  return deadlines
}

/**
 * Generates deadlines for multiple filing frequencies (useful for testing)
 * @param filingFrequencies Array of filing frequencies
 * @param startDate Optional start date
 * @returns Object with deadlines grouped by frequency
 */
export function generateDeadlinesForMultipleFrequencies(
  filingFrequencies: FilingFrequency[],
  startDate: Date = new Date()
): Record<FilingFrequency, GSTDeadline[]> {
  const result: Record<string, GSTDeadline[]> = {}

  for (const frequency of filingFrequencies) {
    result[frequency] = generateDeadlines(frequency, startDate)
  }

  return result as Record<FilingFrequency, GSTDeadline[]>
}

/**
 * Gets the period label for display (e.g., "October 2024" or "Q3 2024")
 * @param period_month The period month (1-12)
 * @param period_year The period year
 * @param frequency Filing frequency
 * @returns Formatted period string
 */
export function getPeriodLabel(
  period_month: number,
  period_year: number,
  frequency: FilingFrequency
): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  if (frequency === 'quarterly') {
    const quarter = Math.ceil(period_month / 3)
    return `Q${quarter} ${period_year}`
  }

  return `${monthNames[period_month - 1]} ${period_year}`
}
