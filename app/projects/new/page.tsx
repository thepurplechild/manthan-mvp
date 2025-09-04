// app/projects/new/page.tsx - Project Creation Page
'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, Sparkles } from 'lucide-react'

export default function NewProjectPage() {
  const [title, setTitle] = useState('')
  const [logline, setLogline] = useState('')
  const [genre, setGenre] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [targetPlatforms, setTargetPlatforms] = useState('')
  const [scriptFile, setScriptFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)

  const supabase = createClientComponentClient()
  const router = useRouter()

  const genres = [
    'Drama', 'Comedy', 'Thriller', 'Action', 'Romance', 'Horror', 
    'Sci-Fi', 'Documentary', 'Animation', 'Musical', 'Historical', 'Biographical'
  ]

  const budgetRanges = [
    'Below 1 Cr', '1-5 Cr', '5-15 Cr', '15-50 Cr', '50+ Cr'
  ]

  const platforms = [
    'Netflix India', 'Amazon Prime Video', 'Disney+ Hotstar', 'SonyLIV', 
    'Zee5', 'Voot', 'Alt Balaji', 'MX Player', 'YouTube Originals'
  ]

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type === 'application/pdf' || file.type === 'text/plain') {
        setScriptFile(file)
        setError('')
      } else {
        setError('Please upload a PDF or TXT file')
      }
    }
  }

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !logline.trim()) {
      setError('Title and logline are required')
      return
    }
    setStep(2)
  }

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!scriptFile) {
      setError('Please upload your script')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create project record
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title,
          logline,
          synopsis,
          genre,
          budget_range: budgetRange,
          target_platforms: targetPlatforms,
          owner_id: user.id,
          status: 'draft'
        })
        .select()
        .single()

      if (projectError) throw projectError

      // Upload script file
      const fileExt = scriptFile.name.split('.').pop()
      const fileName = `${project.id}/script.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('scripts')
        .upload(fileName, scriptFile)

      if (uploadError) throw uploadError

      // Record the file upload
      const { error: recordError } = await supabase
        .from('script_uploads')
        .insert({
          project_id: project.id,
          file_path: fileName,
          file_name: scriptFile.name,
          file_size: scriptFile.size
        })

      if (recordError) throw recordError

      // Trigger AI processing (we'll implement this next)
      // await triggerAIProcessing(project.id)

      router.push(`/projects/${project.id}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto px-6 py-4 flex items-center space-x-4">
          <Link href="/dashboard" className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Manthan
            </span>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12">
        {/* Progress Indicator */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-purple-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-purple-600' : 'bg-gray-600'}`}>
                1
              </div>
              <span className="font-semibold">Basic Info</span>
            </div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-purple-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-purple-600' : 'bg-gray-600'}`}>
                2
              </div>
              <span className="font-semibold">Upload Script</span>
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className={`bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-500 ${step === 1 ? 'w-1/2' : 'w-full'}`}></div>
          </div>
        </div>

        {/* Step 1: Basic Information */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">Create Your Project</h1>
              <p className="text-purple-200 text-lg">
                Tell us about your story and we'll help you create a professional pitch
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <form onSubmit={handleBasicInfoSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter your project title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Logline *
                  </label>
                  <textarea
                    required
                    value={logline}
                    onChange={(e) => setLogline(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="A compelling one-sentence summary of your story (e.g., 'A young entrepreneur must choose between love and ambition when her startup threatens her relationship')"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Primary Genre
                    </label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select genre</option>
                      {genres.map((g) => (
                        <option key={g} value={g} className="bg-slate-800">{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Budget Range
                    </label>
                    <select
                      value={budgetRange}
                      onChange={(e) => setBudgetRange(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select budget</option>
                      {budgetRanges.map((range) => (
                        <option key={range} value={range} className="bg-slate-800">{range}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Target Platforms
                  </label>
                  <select
                    value={targetPlatforms}
                    onChange={(e) => setTargetPlatforms(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select primary target</option>
                    {platforms.map((platform) => (
                      <option key={platform} value={platform} className="bg-slate-800">{platform}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Synopsis (Optional)
                  </label>
                  <textarea
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Brief synopsis of your story (this will help our AI create better pitch materials)"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-3"
                >
                  Continue to Script Upload
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Step 2: Script Upload */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">Upload Your Script</h1>
              <p className="text-purple-200 text-lg">
                Upload your screenplay and our AI will create professional pitch materials
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <form onSubmit={handleProjectSubmit} className="space-y-6">
                {/* File Upload Area */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-4">
                    Script File (PDF or TXT) *
                  </label>
                  
                  <div className="border-2 border-dashed border-purple-400/50 rounded-xl p-8 text-center hover:border-purple-400 transition-colors">
                    <input
                      type="file"
                      id="script-upload"
                      accept=".pdf,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="script-upload"
                      className="cursor-pointer flex flex-col items-center space-y-4"
                    >
                      {scriptFile ? (
                        <>
                          <FileText className="w-16 h-16 text-green-400" />
                          <div>
                            <p className="text-white font-semibold">{scriptFile.name}</p>
                            <p className="text-purple-300 text-sm">
                              {(scriptFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <p className="text-purple-200 text-sm">Click to change file</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-16 h-16 text-purple-400" />
                          <div>
                            <p className="text-white font-semibold">Drop your script here</p>
                            <p className="text-purple-200">or click to browse</p>
                          </div>
                          <p className="text-purple-300 text-xs">PDF or TXT files only</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* What happens next */}
                <div className="bg-purple-900/30 rounded-lg p-6 border border-purple-500/30">
                  <div className="flex items-start space-x-3">
                    <Sparkles className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-white font-semibold mb-2">What happens next?</h3>
                      <ul className="text-purple-200 text-sm space-y-2">
                        <li>• Our AI will analyze your script for themes, characters, and story structure</li>
                        <li>• Generate a professional pitch deck tailored for Indian OTT platforms</li>
                        <li>• Create character breakdowns and series adaptation outlines</li>
                        <li>• Expert review and refinement by our team</li>
                        <li>• Direct introductions to relevant buyers and studios</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-white/20 hover:bg-white/10 px-6 py-3 rounded-lg text-purple-200 font-semibold transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !scriptFile}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 px-6 py-3 rounded-lg text-white font-semibold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      'Creating Project...'
                    ) : (
                      <>
                        Create Project & Start AI Processing
                        <Sparkles className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}