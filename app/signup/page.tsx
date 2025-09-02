// app/signup/page.tsx - Signup with Creator's Bill of Rights
'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { Shield, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showRightsModal, setShowRightsModal] = useState(false)
  const [rightsAccepted, setRightsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClientComponentClient()
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!rightsAccepted) {
      setShowRightsModal(true)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) throw error

      router.push('/dashboard')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const creatorRights = [
    "I understand my uploaded script will be used ONLY for the purpose of generating my project's pitch materials.",
    "I understand my script and personal data will NEVER be shared with third parties without my explicit, case-by-case permission.",
    "I understand my intellectual property will NOT be used to train any public or third-party AI models.",
    "I understand I maintain full ownership of my work and can withdraw it from the platform at any time.",
    "I understand Manthan operates with complete transparency about how my data is used and stored."
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Manthan
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4 mb-2">Join the Founding Cohort</h1>
          <p className="text-purple-200">Start your journey as a creator</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <form onSubmit={handleSignUp} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Create a secure password"
              />
            </div>

            {/* Creator's Bill of Rights Checkbox */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={rightsAccepted}
                  onChange={(e) => setRightsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 text-purple-600 bg-transparent border-purple-400 rounded focus:ring-purple-500"
                />
                <div>
                  <label className="text-sm text-purple-200">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setShowRightsModal(true)}
                      className="text-purple-400 underline hover:text-purple-300"
                    >
                      Creator's Bill of Rights
                    </button>
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !rightsAccepted}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 px-6 py-3 rounded-lg text-white font-semibold transition-all disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-purple-200 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 underline">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Creator's Bill of Rights Modal */}
      {showRightsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Shield className="w-8 h-8 text-purple-400" />
                <h2 className="text-2xl font-bold text-white">Creator's Bill of Rights</h2>
              </div>
              <button
                onClick={() => setShowRightsModal(false)}
                className="text-purple-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6 mb-8">
              <p className="text-purple-200 leading-relaxed">
                At Manthan, we believe creators should have complete control and transparency 
                over their intellectual property. Before joining our platform, please review 
                and acknowledge these fundamental rights:
              </p>

              <div className="space-y-4">
                {creatorRights.map((right, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-purple-100 text-sm leading-relaxed">{right}</p>
                  </div>
                ))}
              </div>

              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                <h3 className="text-purple-200 font-semibold mb-2">Why This Matters</h3>
                <p className="text-purple-300 text-sm">
                  Unlike larger platforms, Manthan is built specifically for creators. 
                  Your trust is our foundation, and these commitments ensure you maintain 
                  complete control over your creative work.
                </p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setRightsAccepted(true)
                  setShowRightsModal(false)
                }}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-6 py-3 rounded-lg text-white font-semibold transition-all"
              >
                I Accept These Rights
              </button>
              <button
                onClick={() => setShowRightsModal(false)}
                className="px-6 py-3 border border-white/20 rounded-lg text-purple-200 hover:text-white transition-colors"
              >
                Review Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}