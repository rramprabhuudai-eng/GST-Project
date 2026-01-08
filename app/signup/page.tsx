'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PhoneOTPForm from '@/components/auth/PhoneOTPForm'
import { useAuth } from '@/components/auth/AuthProvider'

export default function SignUpPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    // If user is already authenticated, redirect to timeline
    if (user && !loading) {
      router.push('/timeline')
    }
  }, [user, loading, router])

  const handleSuccess = () => {
    // Redirect to onboarding after successful authentication
    router.push('/onboarding')
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  // Don't render the form if user is already authenticated
  if (user) {
    return null
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2">GST Management</h1>
            <p className="text-gray-600">Sign up to get started</p>
          </div>

          <PhoneOTPForm onSuccess={handleSuccess} />

          <div className="mt-6 text-center text-sm text-gray-500">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </div>
    </main>
  )
}
