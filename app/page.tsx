export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">
          GST WhatsApp Reminder Scheduler
        </h1>
        <p className="text-xl mb-8">
          Automated reminder scheduling and message queue system for GST compliance deadlines
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">API Endpoints</h2>
            <ul className="space-y-2">
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  POST /api/deadlines/generate
                </code>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  GET /api/deadlines/generate
                </code>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  POST /api/cron/send-reminders
                </code>
              </li>
            </ul>
          </div>

          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-2">Features</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Deadline management</li>
              <li>Automated reminder scheduling</li>
              <li>WhatsApp integration ready</li>
              <li>Message queue system</li>
            </ul>
          </div>
        </div>

        <div className="mt-8">
          <a
            href="https://github.com/rramprabhuudai-eng/GST-Project"
            className="text-blue-600 hover:underline"
          >
            View Documentation →
          </a>
        </div>
      </div>
    </main>
  )
}
