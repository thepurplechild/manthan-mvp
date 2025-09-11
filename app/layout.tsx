import './globals.css'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import AsyncErrorBoundary from '@/components/async-error-boundary'
import { Inter, Poppins } from 'next/font/google'
import PWA from '@/components/PWA'
import Toaster from '@/components/Toaster'
import FocusOnPathChange from '@/components/FocusOnPathChange'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })
const poppins = Poppins({ weight: ['400','500','600','700','800'], subsets: ['latin'], display: 'swap', variable: '--font-heading' })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF6B35" />
      </head>
      <body className="bg-manthan-ivory-50 text-manthan-charcoal-800 font-sans">
        <AsyncErrorBoundary>
          <PWA />
          <NavBar />
          <FocusOnPathChange />
          <main id="main-content" tabIndex={-1} className="animate-fadeIn outline-none">
            {children}
          </main>
          <Toaster />
          <Footer />
        </AsyncErrorBoundary>
      </body>
    </html>
  )
}
