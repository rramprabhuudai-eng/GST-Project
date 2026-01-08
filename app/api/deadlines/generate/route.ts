import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateDeadlines, FilingFrequency } from '@/lib/gst/deadline-generator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entity_id } = body

    if (!entity_id) {
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 }
      )
    }

    // Fetch the entity to get filing frequency
    const { data: entity, error: entityError } = await supabase
      .from('gst_entities')
      .select('*')
      .eq('id', entity_id)
      .single()

    if (entityError || !entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      )
    }

    // Generate deadlines based on filing frequency
    const filingFrequency = entity.filing_frequency as FilingFrequency
    const deadlines = generateDeadlines(filingFrequency)

    // Insert deadlines into database (skip if already exists due to UNIQUE constraint)
    const deadlinesWithEntityId = deadlines.map(deadline => ({
      entity_id,
      ...deadline
    }))

    // Use upsert to handle duplicates gracefully
    const { data: insertedDeadlines, error: insertError } = await supabase
      .from('deadlines')
      .upsert(deadlinesWithEntityId, {
        onConflict: 'entity_id,return_type,period_year,period_month',
        ignoreDuplicates: true
      })
      .select()

    if (insertError) {
      console.error('Error inserting deadlines:', insertError)
      return NextResponse.json(
        { error: 'Failed to insert deadlines', details: insertError.message },
        { status: 500 }
      )
    }

    // Fetch all deadlines for this entity to return
    const { data: allDeadlines, error: fetchError } = await supabase
      .from('deadlines')
      .select('*')
      .eq('entity_id', entity_id)
      .order('due_date', { ascending: true })

    if (fetchError) {
      console.error('Error fetching deadlines:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch deadlines', details: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${deadlines.length} deadlines for ${entity.legal_name}`,
      deadlines: allDeadlines,
      entity: {
        id: entity.id,
        gstin: entity.gstin,
        legal_name: entity.legal_name,
        filing_frequency: entity.filing_frequency
      }
    })

  } catch (error) {
    console.error('Error in generate deadlines API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to regenerate for all entities (optional, for testing)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const entity_id = searchParams.get('entity_id')

    if (!entity_id) {
      return NextResponse.json(
        { error: 'entity_id query parameter is required' },
        { status: 400 }
      )
    }

    // Reuse POST logic
    return POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ entity_id })
    }))

  } catch (error) {
    console.error('Error in generate deadlines GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
