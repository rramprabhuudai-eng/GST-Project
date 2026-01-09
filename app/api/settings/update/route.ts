import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelAllPendingReminders } from '@/lib/messaging/opt-out'

export async function POST(request: NextRequest) {
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

    // Get the request body
    const body = await request.json()
    const { business_name, email, whatsapp_consent, consent_change_reason } = body

    // Validate at least one field is provided
    if (business_name === undefined && email === undefined && whatsapp_consent === undefined) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      )
    }

    // Get the user's account using their phone number
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select(`
        id,
        business_name,
        timezone,
        status,
        primary_contact_id,
        contacts!accounts_primary_contact_id_fkey (
          id,
          name,
          phone,
          email,
          whatsapp_consent,
          opt_out_at
        )
      `)
      .eq('primary_contact_id', user.id)
      .single()

    if (accountError || !account) {
      // Try to find account by matching contact phone with user phone
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, account_id, whatsapp_consent')
        .eq('phone', user.phone)
        .single()

      if (contactError || !contact) {
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        )
      }

      // Get the account using the contact's account_id
      const { data: foundAccount, error: foundAccountError } = await supabase
        .from('accounts')
        .select(`
          id,
          business_name,
          timezone,
          status,
          primary_contact_id,
          contacts!accounts_primary_contact_id_fkey (
            id,
            name,
            phone,
            email,
            whatsapp_consent,
            opt_out_at
          )
        `)
        .eq('id', contact.account_id)
        .single()

      if (foundAccountError || !foundAccount) {
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        )
      }

      // Use the found account and contact
      const accountId = foundAccount.id
      const contactId = contact.id
      const previousConsent = contact.whatsapp_consent

      // Perform updates
      await performUpdates(
        supabase,
        accountId,
        contactId,
        previousConsent,
        business_name,
        email,
        whatsapp_consent,
        consent_change_reason
      )

      // Fetch updated data
      const updatedData = await fetchUpdatedSettings(supabase, accountId, contactId)
      return NextResponse.json(updatedData)
    }

    const accountId = account.id
    const primaryContact = Array.isArray(account.contacts) ? account.contacts[0] : account.contacts
    const contactId = primaryContact?.id
    const previousConsent = primaryContact?.whatsapp_consent

    if (!contactId) {
      return NextResponse.json(
        { error: 'Primary contact not found' },
        { status: 404 }
      )
    }

    // Perform updates
    await performUpdates(
      supabase,
      accountId,
      contactId,
      previousConsent,
      business_name,
      email,
      whatsapp_consent,
      consent_change_reason
    )

    // Fetch updated data
    const updatedData = await fetchUpdatedSettings(supabase, accountId, contactId)
    return NextResponse.json(updatedData)

  } catch (error) {
    console.error('Error in settings update API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Performs the actual database updates for account and contact settings
 */
async function performUpdates(
  supabase: any,
  accountId: string,
  contactId: string,
  previousConsent: boolean,
  business_name?: string,
  email?: string,
  whatsapp_consent?: boolean,
  consent_change_reason?: string
) {
  // Update account if business_name is provided
  if (business_name !== undefined) {
    const { error: accountUpdateError } = await supabase
      .from('accounts')
      .update({ business_name })
      .eq('id', accountId)

    if (accountUpdateError) {
      throw new Error(`Failed to update account: ${accountUpdateError.message}`)
    }
  }

  // Update contact if email or whatsapp_consent is provided
  if (email !== undefined || whatsapp_consent !== undefined) {
    const contactUpdates: any = {}

    if (email !== undefined) {
      contactUpdates.email = email
    }

    if (whatsapp_consent !== undefined) {
      contactUpdates.whatsapp_consent = whatsapp_consent

      // Set consent_change_reason if provided
      if (consent_change_reason) {
        contactUpdates.consent_change_reason = consent_change_reason
      }
    }

    const { error: contactUpdateError } = await supabase
      .from('contacts')
      .update(contactUpdates)
      .eq('id', contactId)

    if (contactUpdateError) {
      throw new Error(`Failed to update contact: ${contactUpdateError.message}`)
    }

    // If consent changed from true to false, cancel all pending reminders
    if (whatsapp_consent === false && previousConsent === true) {
      try {
        const optOutResult = await cancelAllPendingReminders(contactId)
        console.log(
          `Opt-out processed for contact ${contactId}: ${optOutResult.cancelledReminders} reminders and ${optOutResult.cancelledMessages} messages cancelled`
        )
      } catch (error) {
        console.error('Error cancelling reminders during opt-out:', error)
        // Don't throw - we want the consent update to succeed even if cancellation fails
        // The cancelled messages/reminders will be filtered out when sending anyway
      }
    }
  }
}

/**
 * Fetches the updated settings data to return to the client
 */
async function fetchUpdatedSettings(
  supabase: any,
  accountId: string,
  contactId: string
) {
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, business_name, timezone, status')
    .eq('id', accountId)
    .single()

  if (accountError) {
    throw new Error(`Failed to fetch updated account: ${accountError.message}`)
  }

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id, name, phone, email, whatsapp_consent, opt_out_at, consent_changed_at')
    .eq('id', contactId)
    .single()

  if (contactError) {
    throw new Error(`Failed to fetch updated contact: ${contactError.message}`)
  }

  return {
    success: true,
    message: 'Settings updated successfully',
    data: {
      account,
      contact
    }
  }
}
