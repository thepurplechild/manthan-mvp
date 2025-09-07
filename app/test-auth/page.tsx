'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function TestAuth() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    try {
      console.log('Testing Supabase connection...')
      
      // Check environment variables
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('Environment variables:', {
        url: url ? 'Set' : 'Missing',
        key: key ? 'Set' : 'Missing',
        urlValue: url,
        keyLength: key?.length
      })
      
      // Test client creation
      const supabase = createClient()
      console.log('Supabase client created:', !!supabase)
      
      // Test basic connection
      const { data, error } = await supabase.auth.getSession()
      console.log('Get session result:', { data: !!data, error })
      
      if (error) {
        setResult(`Connection Error: ${error.message}`)
      } else {
        setResult('✅ Supabase connection successful!')
      }
    } catch (error) {
      console.error('Test error:', error)
      setResult(`Test Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const testSignUp = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const testEmail = 'test@example.com'
      const testPassword = 'testpassword123'
      
      console.log('Testing sign up with:', testEmail)
      
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            full_name: 'Test User'
          }
        }
      })
      
      console.log('Sign up result:', { data, error })
      
      if (error) {
        setResult(`Sign Up Error: ${error.message}`)
      } else {
        setResult(`✅ Sign up test successful! User ID: ${data.user?.id}`)
      }
    } catch (error) {
      console.error('Sign up test error:', error)
      setResult(`Sign Up Test Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Authentication Test</h1>
        
        <div className="space-y-4 mb-8">
          <button
            onClick={testConnection}
            disabled={loading}
            className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Supabase Connection'}
          </button>
          
          <button
            onClick={testSignUp}
            disabled={loading}
            className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Sign Up Flow'}
          </button>
        </div>
        
        {result && (
          <div className="p-4 bg-white/10 backdrop-blur-lg rounded-lg border border-white/20">
            <h2 className="text-white font-semibold mb-2">Test Result:</h2>
            <pre className="text-white/80 text-sm">{result}</pre>
          </div>
        )}
        
        <div className="mt-8 p-4 bg-white/5 backdrop-blur-lg rounded-lg border border-white/10">
          <h2 className="text-white font-semibold mb-2">Environment Check:</h2>
          <pre className="text-white/60 text-sm">
            {`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing'}
NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}`}
          </pre>
        </div>
      </div>
    </div>
  )
}