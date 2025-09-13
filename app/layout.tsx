import './globals.css'
import Navigation from '@/components/Navigation'
import AsyncErrorBoundary from '@/components/async-error-boundary'
import PWA from '@/components/PWA'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF6B35" />
      </head>
      <body className="bg-manthan-ivory-50 text-manthan-charcoal-800 font-sans">
        <AsyncErrorBoundary>
          <PWA />
          <Navigation />
          {children}
        </AsyncErrorBoundary>
      </body>
    </html>
  )
}
