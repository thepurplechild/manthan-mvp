// app/page.tsx - Modern Landing Page
'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles, Users, Zap, Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-8 flex justify-between items-center">
        <div className="text-2xl font-bold text-white">
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Manthan
          </span>
        </div>
        <div className="space-x-6">
          <Link href="/login" className="text-purple-200 hover:text-white transition-colors">
            Login
          </Link>
          <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-full text-white transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            Turn Your{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Stories
            </span>{' '}
            Into Success
          </h1>
          <p className="text-xl text-purple-200 mb-12 leading-relaxed">
            The AI-powered platform that transforms your scripts into professional pitch decks 
            and connects you with the right buyers in the Indian entertainment industry.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/signup"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-full text-white font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105"
            >
              Start Your Journey <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="border-2 border-purple-400 hover:bg-purple-400 hover:text-slate-900 px-8 py-4 rounded-full text-purple-400 font-semibold transition-all">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Why Creators Choose Manthan
          </h2>
          <p className="text-purple-200 text-lg">
            Built specifically for the Indian entertainment ecosystem
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">AI-Powered Pitch Decks</h3>
            <p className="text-purple-200 leading-relaxed">
              Transform your scripts into professional, industry-standard pitch materials 
              tailored for Indian OTT platforms and studios.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Expert Curation</h3>
            <p className="text-purple-200 leading-relaxed">
              Our industry experts review and refine your pitches, ensuring they meet 
              the highest standards before reaching decision-makers.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="bg-gradient-to-r from-orange-600 to-pink-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Direct Connections</h3>
            <p className="text-purple-200 leading-relaxed">
              Skip the gatekeepers. We facilitate direct introductions to studios, 
              OTT platforms, and producers actively seeking content.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-12 border border-white/10">
          <div className="flex items-center justify-center mb-8">
            <Shield className="w-12 h-12 text-purple-400 mr-4" />
            <h2 className="text-3xl font-bold text-white">Your IP is Protected</h2>
          </div>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-purple-200 text-lg leading-relaxed mb-8">
              We understand your script is your most valuable asset. That's why we've built 
              Manthan with creator-first principles, complete transparency, and ironclad IP protection.
            </p>
            <div className="grid md:grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="text-white font-semibold mb-2">Never Shared Without Permission</h4>
                <p className="text-purple-300">Your scripts are only used to generate your pitch materials</p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">No Third-Party Training</h4>
                <p className="text-purple-300">Your IP will never be used to train public AI models</p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Full Control</h4>
                <p className="text-purple-300">You decide exactly who sees your work and when</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Script?
          </h2>
          <p className="text-purple-200 text-lg mb-8">
            Join the founding cohort of creators who are revolutionizing 
            how stories get discovered in India.
          </p>
          <Link 
            href="/signup"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-12 py-4 rounded-full text-white text-lg font-semibold inline-flex items-center gap-3 transition-all transform hover:scale-105"
          >
            Join the Founding Cohort <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="container mx-auto px-6 py-12 text-center">
          <div className="text-2xl font-bold text-white mb-4">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Manthan
            </span>
          </div>
          <p className="text-purple-200 text-sm">
            Transforming stories into success, one script at a time.
          </p>
        </div>
      </footer>
    </div>
  )
}