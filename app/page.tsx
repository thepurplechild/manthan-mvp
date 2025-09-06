// app/page.tsx - Material Glass Landing Page
'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles, Users, Zap, Shield, Play, Star } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-500"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 backdrop-blur-xl bg-white/5 border-b border-white/10 sticky top-0">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              Manthan
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/auth/login" 
              className="px-4 py-2 text-white/80 hover:text-white transition-all duration-300 hover:bg-white/10 rounded-lg backdrop-blur-sm"
            >
              Login
            </Link>
            <Link 
              href="/auth/sign-up" 
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg shadow-lg shadow-purple-500/25 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-6 py-24 text-center">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 text-sm text-purple-200 mb-8">
              <Star className="w-4 h-4 mr-2" />
              Trusted by 500+ creators in the founding cohort
            </div>
          </div>
          
          <h1 className="text-7xl md:text-8xl font-bold mb-8 leading-tight">
            Transform Your{' '}
            <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-orange-300 bg-clip-text text-transparent">
              Stories
            </span>
            <br />Into Success
          </h1>
          
          <p className="text-xl md:text-2xl text-white/70 mb-12 leading-relaxed max-w-3xl mx-auto">
            The AI-powered platform that transforms your scripts into professional pitch decks 
            and connects you with the right buyers in the Indian entertainment industry.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link 
              href="/auth/sign-up"
              className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-xl shadow-purple-500/25 backdrop-blur-sm border border-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/40 flex items-center gap-3"
            >
              Start Your Journey 
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="group px-8 py-4 bg-white/10 backdrop-blur-xl hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-all duration-300 hover:scale-105 flex items-center gap-3">
              <Play className="w-5 h-5" /> Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 container mx-auto px-6 py-24">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold text-white mb-6">
            Why Creators Choose Manthan
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Built specifically for the Indian entertainment ecosystem with cutting-edge AI and industry expertise
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="group relative bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">AI-Powered Pitch Decks</h3>
              <p className="text-white/60 leading-relaxed">
                Transform your scripts into professional, industry-standard pitch materials 
                tailored for Indian OTT platforms and studios with our advanced AI.
              </p>
            </div>
          </div>

          <div className="group relative bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Expert Curation</h3>
              <p className="text-white/60 leading-relaxed">
                Our industry veterans review and refine your pitches, ensuring they meet 
                the highest standards before reaching decision-makers.
              </p>
            </div>
          </div>

          <div className="group relative bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="bg-gradient-to-r from-orange-500 to-pink-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Direct Connections</h3>
              <p className="text-white/60 leading-relaxed">
                Skip the gatekeepers. We facilitate direct introductions to studios, 
                OTT platforms, and producers actively seeking fresh content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="relative z-10 container mx-auto px-6 py-24">
        <div className="relative bg-white/5 backdrop-blur-3xl rounded-[2rem] p-12 md:p-16 border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-[2rem]"></div>
          <div className="relative">
            <div className="flex items-center justify-center mb-10">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-2xl mr-4 shadow-lg">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white">Your IP is Protected</h2>
            </div>
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-xl text-white/70 leading-relaxed mb-12">
                We understand your script is your most valuable asset. That's why we've built 
                Manthan with creator-first principles, complete transparency, and ironclad IP protection.
              </p>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                  <h4 className="text-white font-semibold mb-3 text-lg">Never Shared Without Permission</h4>
                  <p className="text-white/60">Your scripts are only used to generate your pitch materials</p>
                </div>
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                  <h4 className="text-white font-semibold mb-3 text-lg">No Third-Party Training</h4>
                  <p className="text-white/60">Your IP will never be used to train public AI models</p>
                </div>
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                  <h4 className="text-white font-semibold mb-3 text-lg">Full Control</h4>
                  <p className="text-white/60">You decide exactly who sees your work and when</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-8">
            Ready to Transform Your Script?
          </h2>
          <p className="text-xl text-white/70 mb-12 leading-relaxed">
            Join the founding cohort of creators who are revolutionizing 
            how stories get discovered in India.
          </p>
          <Link 
            href="/auth/sign-up"
            className="group inline-flex items-center gap-4 px-12 py-5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xl font-semibold rounded-2xl shadow-2xl shadow-purple-500/25 backdrop-blur-sm border border-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/40"
          >
            Join the Founding Cohort 
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 backdrop-blur-xl bg-white/5 border-t border-white/10">
        <div className="container mx-auto px-6 py-16 text-center">
          <div className="text-3xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              Manthan
            </span>
          </div>
          <p className="text-white/60">
            Transforming stories into success, one script at a time.
          </p>
        </div>
      </footer>
    </div>
  )
}