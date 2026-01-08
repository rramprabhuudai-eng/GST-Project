import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deadline_id, proof_url } = body

    if (!deadline_id) {
      return NextResponse.json(
        { error: 'deadline_id is required' },
        { status: 400 }
      )
    }

    // Update the deadline record
    const { data: updatedDeadline, error: updateError } = await supabase
      .from('gst_deadlines')
      .update({
        status: 'filed',
        filed_at: new Date().toISOString(),
        proof_url: proof_url || null
      })
      .eq('id', deadline_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating deadline:', updateError)
      return NextResponse.json(
        { error: 'Failed to update deadline', details: updateError.message },
        { status: 500 }
      )
    }

    if (!updatedDeadline) {
      return NextResponse.json(
        { error: 'Deadline not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Deadline marked as filed',
      deadline: updatedDeadline
    })

  } catch (error) {
    console.error('Error in mark-filed API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT endpoint as an alternative
export async function PUT(request: NextRequest) {
  return POST(request)
}
