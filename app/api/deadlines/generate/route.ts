import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createReminderSchedules } from '@/lib/reminders/scheduler'
import { DeadlineStatus } from '@/lib/types'

/**
 * Request body interface for deadline generation
 */
interface GenerateDeadlinesRequest {
  contact_id: string
  gstin: string
  deadlines: Array<{
    return_type: string // e.g., "GSTR-1", "GSTR-3B"
    period: string // e.g., "2024-01"
    due_date: string // ISO date string
  }>
}

/**
 * API endpoint to generate deadlines and schedule reminders
 *
 * This endpoint:
 * 1. Creates deadline records for a contact
 * 2. Automatically schedules reminders for future deadlines
 *
 * @param request - Request containing contact ID, GSTIN, and deadline details
 * @returns JSON response with created deadlines and reminder schedules
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateDeadlinesRequest = await request.json()

    // Validate request body
    if (!body.contact_id || !body.gstin || !Array.isArray(body.deadlines)) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          message: 'contact_id, gstin, and deadlines array are required'
        },
        { status: 400 }
      )
    }

    // Validate contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: body.contact_id }
    })

    if (!contact) {
      return NextResponse.json(
        {
          error: 'Contact not found',
          message: `Contact with ID ${body.contact_id} does not exist`
        },
        { status: 404 }
      )
    }

    const now = new Date()
    const futureDeadlineIds: string[] = []
    const createdDeadlines = []

    // Create deadlines in a transaction
    for (const deadlineData of body.deadlines) {
      // Validate deadline data
      if (!deadlineData.return_type || !deadlineData.period || !deadlineData.due_date) {
        return NextResponse.json(
          {
            error: 'Invalid deadline data',
            message: 'Each deadline must have return_type, period, and due_date'
          },
          { status: 400 }
        )
      }

      const dueDate = new Date(deadlineData.due_date)

      // Validate due date
      if (isNaN(dueDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid due_date',
            message: `Invalid date format for ${deadlineData.due_date}`
          },
          { status: 400 }
        )
      }

      // Create deadline
      const deadline = await prisma.deadline.create({
        data: {
          contact_id: body.contact_id,
          gstin: body.gstin,
          return_type: deadlineData.return_type,
          period: deadlineData.period,
          due_date: dueDate,
          status: DeadlineStatus.PENDING
        }
      })

      createdDeadlines.push(deadline)

      // Track future deadlines for reminder scheduling
      if (dueDate > now) {
        futureDeadlineIds.push(deadline.id)
      }
    }

    // Schedule reminders for future deadlines
    let reminderResults = []
    if (futureDeadlineIds.length > 0) {
      try {
        reminderResults = await createReminderSchedules(futureDeadlineIds)
      } catch (error: any) {
        console.error('Error creating reminder schedules:', error)
        // Continue even if reminder scheduling fails
        // The deadlines are already created
      }
    }

    return NextResponse.json(
      {
        success: true,
        deadlines_created: createdDeadlines.length,
        reminders_scheduled: reminderResults.reduce(
          (sum, result) => sum + result.reminders_created,
          0
        ),
        deadlines: createdDeadlines.map(d => ({
          id: d.id,
          return_type: d.return_type,
          period: d.period,
          due_date: d.due_date,
          status: d.status
        })),
        reminder_schedules: reminderResults
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in generate deadlines endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler to retrieve deadlines for a contact
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contact_id')
    const gstin = searchParams.get('gstin')

    if (!contactId && !gstin) {
      return NextResponse.json(
        {
          error: 'Missing parameter',
          message: 'Either contact_id or gstin is required'
        },
        { status: 400 }
      )
    }

    const deadlines = await prisma.deadline.findMany({
      where: contactId
        ? { contact_id: contactId }
        : { gstin: gstin! },
      include: {
        reminderSchedule: {
          select: {
            id: true,
            template_id: true,
            send_at: true,
            sent_at: true,
            status: true
          }
        }
      },
      orderBy: {
        due_date: 'asc'
      }
    })

    return NextResponse.json(
      {
        success: true,
        count: deadlines.length,
        deadlines
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error retrieving deadlines:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    )
  }
}
