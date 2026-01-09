'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'

interface AccountData {
  id: string
  business_name: string
  timezone: string
  status: string
}

interface ContactData {
  id: string
  name: string
  phone: string
  email: string
  whatsapp_consent: boolean
  opt_out_at: string | null
  consent_changed_at: string | null
}

interface SettingsData {
  account: AccountData
  contact: ContactData
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showOptOutModal, setShowOptOutModal] = useState(false)
  const [pendingConsentChange, setPendingConsentChange] = useState(false)

  // Form state
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsappConsent, setWhatsappConsent] = useState(false)
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('')
  const [optOutAt, setOptOutAt] = useState<string | null>(null)

  // Track original values to detect changes
  const [originalData, setOriginalData] = useState<SettingsData | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signup')
    } else if (user) {
      fetchSettings()
    }
  }, [user, authLoading, router])

  async function fetchSettings() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/settings')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch settings')
      }

      const { account, contact } = data.data

      // Set form values
      setBusinessName(account.business_name)
      setTimezone(account.timezone)
      setContactName(contact.name)
      setPhone(contact.phone)
      setEmail(contact.email || '')
      setWhatsappConsent(contact.whatsapp_consent)
      setOptOutAt(contact.opt_out_at)

      // Store original data
      setOriginalData(data.data)

    } catch (err) {
      console.error('Error fetching settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveSettings() {
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      // Validate email format if provided
      if (email && !isValidEmail(email)) {
        throw new Error('Please enter a valid email address')
      }

      // Build update payload only with changed fields
      const updates: any = {}
      let hasChanges = false

      if (businessName !== originalData?.account.business_name) {
        updates.business_name = businessName
        hasChanges = true
      }

      if (email !== originalData?.contact.email) {
        updates.email = email
        hasChanges = true
      }

      if (whatsappConsent !== originalData?.contact.whatsapp_consent) {
        updates.whatsapp_consent = whatsappConsent
        updates.consent_change_reason = whatsappConsent
          ? 'User opted back in via settings'
          : 'User opted out via settings'
        hasChanges = true
      }

      if (!hasChanges) {
        setSuccessMessage('No changes to save')
        return
      }

      const response = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings')
      }

      // Update original data with new values
      setOriginalData(data.data)
      setOptOutAt(data.data.contact.opt_out_at)

      setSuccessMessage('Settings saved successfully!')

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000)

    } catch (err) {
      console.error('Error saving settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function handleWhatsAppToggle(checked: boolean) {
    // If turning off consent, show confirmation modal
    if (!checked && whatsappConsent) {
      setPendingConsentChange(true)
      setShowOptOutModal(true)
    } else {
      // Turning consent back on - update immediately
      setWhatsappConsent(checked)
    }
  }

  function confirmOptOut() {
    setWhatsappConsent(false)
    setShowOptOutModal(false)
    setPendingConsentChange(false)
  }

  function cancelOptOut() {
    setShowOptOutModal(false)
    setPendingConsentChange(false)
  }

  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  function hasUnsavedChanges(): boolean {
    if (!originalData) return false

    return (
      businessName !== originalData.account.business_name ||
      email !== originalData.contact.email ||
      whatsappConsent !== originalData.contact.whatsapp_consent
    )
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your account preferences and contact information</p>
        </div>

        {/* Opt-out status banner */}
        {optOutAt && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                  WhatsApp Notifications Disabled
                </h3>
                <p className="text-sm text-yellow-800">
                  You opted out on {new Date(optOutAt).toLocaleDateString()}. You won&apos;t receive deadline reminders via WhatsApp.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Business Information Section */}
          <div className="border-b border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your business name"
                required
              />
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="border-b border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Contact name cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Phone number cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email address"
                />
              </div>
            </div>
          </div>

          {/* WhatsApp Notifications Section */}
          <div className="border-b border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">WhatsApp Notifications</h2>
            <div className="flex items-start gap-4">
              <div className="flex items-center h-6">
                <input
                  type="checkbox"
                  id="whatsapp-consent"
                  checked={whatsappConsent}
                  onChange={(e) => handleWhatsAppToggle(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="whatsapp-consent" className="block text-sm font-medium text-gray-900 cursor-pointer">
                  Receive WhatsApp reminders for GST filing deadlines
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  Get timely reminders on WhatsApp at 9:00 AM (3 days before, 1 day before, and on the due date).
                  {!whatsappConsent && (
                    <span className="block mt-1 text-yellow-700 font-medium">
                      Currently disabled - You won&apos;t receive any WhatsApp reminders.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Timezone Section */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timezone</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Timezone
              </label>
              <input
                type="text"
                value={timezone}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">All reminders are scheduled according to this timezone</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving || !hasUnsavedChanges()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

        {/* Back to Timeline Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/timeline')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Timeline
          </button>
        </div>
      </div>

      {/* Opt-out Confirmation Modal */}
      {showOptOutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Disable WhatsApp Reminders?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure? You won&apos;t receive any GST filing deadline reminders via WhatsApp. All pending reminders will be cancelled immediately.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> You can opt back in anytime from this settings page.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelOptOut}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmOptOut}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Yes, Disable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
