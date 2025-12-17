import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stable Configurator',
  description: 'Build your custom stable block configuration',
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

