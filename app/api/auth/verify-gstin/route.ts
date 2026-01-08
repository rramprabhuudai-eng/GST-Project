import { NextRequest, NextResponse } from 'next/server'
import { validateGSTIN, STATE_CODES } from '@/lib/validations/gstin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gstin } = body

    if (!gstin) {
      return NextResponse.json(
        { isValid: false, error: 'GSTIN is required' },
        { status: 400 }
      )
    }

    // Validate GSTIN format
    const validation = validateGSTIN(gstin)

    if (!validation.isValid) {
      return NextResponse.json(
        { isValid: false, error: validation.error },
        { status: 400 }
      )
    }

    // Get state name from state code
    const stateName = STATE_CODES[validation.stateCode!]

    return NextResponse.json({
      isValid: true,
      stateCode: validation.stateCode,
      stateName,
      gstin: gstin.toUpperCase(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { isValid: false, error: error.message || 'Failed to validate GSTIN' },
      { status: 500 }
    )
  }
}
