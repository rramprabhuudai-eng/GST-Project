'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPhoneForSupabase, validatePhone } from '@/lib/validations/phone'

interface PhoneOTPFormProps {
  onSuccess: () => void
}

export default function PhoneOTPForm({ onSuccess }: PhoneOTPFormProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleSendOTP = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate phone number
      const validation = validatePhone(phone)
      if (!validation.isValid) {
        setError(validation.error || 'Invalid phone number')
        setLoading(false)
        return
      }

      // Format phone for Supabase
      const formattedPhone = formatPhoneForSupabase(phone)

      // Send OTP
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms',
        },
      })

      if (error) {
        throw error
      }

      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (otp.length !== 6) {
        setError('OTP must be 6 digits')
        setLoading(false)
        return
      }

      const formattedPhone = formatPhoneForSupabase(phone)

      // Verify OTP
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      })

      if (error) {
        throw error
      }

      // Success - call onSuccess callback
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError(null)
    setLoading(true)

    try {
      const formattedPhone = formatPhoneForSupabase(phone)

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms',
        },
      })

      if (error) {
        throw error
      }

      setError(null)
      // Show success message
      const successMsg = document.createElement('div')
      successMsg.textContent = 'OTP resent successfully'
      successMsg.className = 'text-green-600 text-sm mt-2'
      setTimeout(() => successMsg.remove(), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'phone') {
    return (
      <div className="w-full max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2">
              Phone Number
            </label>
            <div className="flex gap-2">
              <div className="flex items-center bg-gray-100 px-3 py-3 rounded-lg border border-gray-300">
                <span className="text-gray-700 font-medium">+91</span>
              </div>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                required
                disabled={loading}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enter your 10-digit Indian mobile number
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || phone.length !== 10}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg touch-manipulation min-h-[48px]"
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Verify OTP</h2>
      <form onSubmit={handleVerifyOTP} className="space-y-4">
        <div>
          <label htmlFor="otp" className="block text-sm font-medium mb-2">
            Enter OTP
          </label>
          <input
            type="text"
            id="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg text-center tracking-widest"
            maxLength={6}
            pattern="[0-9]{6}"
            required
            disabled={loading}
            autoFocus
          />
          <p className="text-sm text-gray-500 mt-1">
            OTP sent to +91 {phone}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg touch-manipulation min-h-[48px]"
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={loading}
            className="text-blue-600 hover:underline text-sm disabled:text-gray-400 touch-manipulation min-h-[44px]"
          >
            Resend OTP
          </button>
          <span className="mx-2 text-gray-400">|</span>
          <button
            type="button"
            onClick={() => {
              setStep('phone')
              setOtp('')
              setError(null)
            }}
            disabled={loading}
            className="text-blue-600 hover:underline text-sm disabled:text-gray-400 touch-manipulation min-h-[44px]"
          >
            Change Number
          </button>
        </div>
      </form>
    </div>
  )
}
