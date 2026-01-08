'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'

export default function TimelinePage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  useEffect(() => {
    // Redirect to signup if not authenticated
    if (!loading && !user) {
      router.push('/signup')
    }
  }, [user, loading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
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

  // Don't render if not authenticated
  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold">GST Timeline</h1>
          <button
            onClick={handleSignOut}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome!</h2>
          <p className="text-gray-600">
            Your onboarding is complete. This is your GST timeline dashboard.
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>User:</strong> {user.phone}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
