import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find the contact associated with this user's phone number
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        phone,
        email,
        whatsapp_consent,
        opt_out_at,
        consent_changed_at,
        account_id
      `)
      .eq('phone', user.phone)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Get the account information
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, business_name, timezone, status')
      .eq('id', contact.account_id)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        account,
        contact
      }
    })

  } catch (error) {
    console.error('Error in settings fetch API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
