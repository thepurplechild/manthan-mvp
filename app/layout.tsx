import './globals.css'
import Navigation from '@/components/Navigation'
import AsyncErrorBoundary from '@/components/async-error-boundary'
import { Inter, Poppins } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })
const poppins = Poppins({ weight: ['400','500','600','700','800'], subsets: ['latin'], display: 'swap', variable: '--font-heading' })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="bg-manthan-ivory-50 text-manthan-charcoal-800 font-sans">
        <AsyncErrorBoundary>
          <Navigation />
          {children}
        </AsyncErrorBoundary>
      </body>
    </html>
  )
}
