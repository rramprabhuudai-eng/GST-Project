import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">GST Management System</h1>
        <p className="text-gray-600 mb-8">Manage your GST compliance with ease</p>
        <Link
          href="/signup"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </main>
  )
}
