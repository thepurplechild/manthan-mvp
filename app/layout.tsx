import './globals.css'
import Navigation from '@/components/Navigation'
import AsyncErrorBoundary from '@/components/async-error-boundary'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AsyncErrorBoundary>
          <Navigation />
          {children}
        </AsyncErrorBoundary>
      </body>
    </html>
  )
}