'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'

interface OnboardingFormData {
  businessName: string
  contactName: string
  gstin: string
  filingFrequency: 'monthly' | 'quarterly'
  whatsappConsent: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<OnboardingFormData>({
    businessName: '',
    contactName: '',
    gstin: '',
    filingFrequency: 'monthly',
    whatsappConsent: false,
  })
  const supabase = createClient()

  useEffect(() => {
    // Redirect to signup if not authenticated
    if (!authLoading && !user) {
      router.push('/signup')
    }
  }, [user, authLoading, router])

  const handleStep1Submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.businessName.trim()) {
      setError('Business name is required')
      return
    }

    if (!formData.contactName.trim()) {
      setError('Contact name is required')
      return
    }

    setStep(2)
  }

  const handleStep2Submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate GSTIN format
      const response = await fetch('/api/auth/verify-gstin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gstin: formData.gstin }),
      })

      const data = await response.json()

      if (!response.ok || !data.isValid) {
        setError(data.error || 'Invalid GSTIN')
        setLoading(false)
        return
      }

      setStep(3)
    } catch (err: any) {
      setError(err.message || 'Failed to validate GSTIN')
    } finally {
      setLoading(false)
    }
  }

  const handleStep3Submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Get user phone from auth
      const userPhone = user.phone || user.user_metadata?.phone

      if (!userPhone) {
        throw new Error('Phone number not found')
      }

      // Validate GSTIN again to get state code
      const gstinResponse = await fetch('/api/auth/verify-gstin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gstin: formData.gstin }),
      })

      const gstinData = await gstinResponse.json()

      if (!gstinData.isValid) {
        throw new Error('Invalid GSTIN')
      }

      // Create account record
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert({
          business_name: formData.businessName,
        })
        .select()
        .single()

      if (accountError) {
        throw accountError
      }

      // Create contact record
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          account_id: account.id,
          name: formData.contactName,
          phone: userPhone,
          whatsapp_consent: formData.whatsappConsent,
        })
        .select()
        .single()

      if (contactError) {
        throw contactError
      }

      // Create GST entity record
      const { data: gstEntity, error: gstError } = await supabase
        .from('gst_entities')
        .insert({
          account_id: account.id,
          gstin: formData.gstin.toUpperCase(),
          legal_name: formData.businessName,
          state_code: gstinData.stateCode,
          filing_frequency: formData.filingFrequency,
          status: 'active',
        })
        .select()
        .single()

      if (gstError) {
        throw gstError
      }

      // Auto-generate deadlines for the new GST entity
      const deadlineResponse = await fetch('/api/deadlines/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity_id: gstEntity.id }),
      })

      if (!deadlineResponse.ok) {
        console.error('Failed to generate deadlines:', await deadlineResponse.text())
        // Don't throw error - onboarding should still succeed
      }

      // Success - redirect to timeline
      router.push('/timeline')
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding')
      setLoading(false)
    }
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  // Don't render if not authenticated
  if (!user) {
    return null
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
            <div className="flex gap-2 mt-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full ${
                    s <= step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Step {step} of 3
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  placeholder="Enter your business name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
                  required
                />
              </div>

              <div>
                <label htmlFor="contactName" className="block text-sm font-medium mb-2">
                  Contact Name *
                </label>
                <input
                  type="text"
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData({ ...formData, contactName: e.target.value })
                  }
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-lg touch-manipulation min-h-[48px]"
              >
                Continue
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <div>
                <label htmlFor="gstin" className="block text-sm font-medium mb-2">
                  GSTIN *
                </label>
                <input
                  type="text"
                  id="gstin"
                  value={formData.gstin}
                  onChange={(e) =>
                    setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                  }
                  placeholder="27AAPFU0939F1ZV"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg uppercase font-mono"
                  maxLength={15}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Format: 2 digits + 10 alphanumeric + 1 letter + 1 digit + 1 letter
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Filing Frequency *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="filingFrequency"
                      value="monthly"
                      checked={formData.filingFrequency === 'monthly'}
                      onChange={(e) =>
                        setFormData({ ...formData, filingFrequency: e.target.value as 'monthly' | 'quarterly' })
                      }
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">Monthly</div>
                      <div className="text-sm text-gray-600">File GSTR-1 and GSTR-3B every month</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="filingFrequency"
                      value="quarterly"
                      checked={formData.filingFrequency === 'quarterly'}
                      onChange={(e) =>
                        setFormData({ ...formData, filingFrequency: e.target.value as 'monthly' | 'quarterly' })
                      }
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">Quarterly</div>
                      <div className="text-sm text-gray-600">File GSTR-1 and GSTR-3B every quarter</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors text-lg touch-manipulation min-h-[48px]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg touch-manipulation min-h-[48px]"
                >
                  {loading ? 'Validating...' : 'Continue'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleStep3Submit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold mb-2">WhatsApp Updates</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Would you like to receive important GST compliance updates, filing reminders,
                  and notifications on WhatsApp? This helps you stay on top of your GST obligations.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.whatsappConsent}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsappConsent: e.target.checked })
                    }
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm">
                    Yes, send me WhatsApp updates about GST compliance, filing deadlines,
                    and important notifications
                  </span>
                </label>
              </div>

              <div className="text-xs text-gray-500">
                You can change this preference anytime in your settings. We will only send
                important business-related updates.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg touch-manipulation min-h-[48px]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg touch-manipulation min-h-[48px]"
                >
                  {loading ? 'Creating Account...' : 'Complete Setup'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
