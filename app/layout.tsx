import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GST WhatsApp Reminder Scheduler',
  description: 'Automated reminder scheduling and message queue system for GST compliance deadlines',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
