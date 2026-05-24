import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PayPal Backend API',
  description: 'Backend proxy API for PayPal SDK integration',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
