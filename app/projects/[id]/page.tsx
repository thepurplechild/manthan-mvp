// app/projects/[id]/page.tsx - Project Detail Page
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Download, Clock, CheckCircle, Sparkles, Eye, Upload } from 'lucide-react'

interface ProjectDetailProps {
  params: {
    id: string
  }
}

export default async function ProjectDetailPage({ params }: ProjectDetailProps) {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Get project with all related data
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      profiles(*),
      script_uploads(*),
      generated_assets(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !project) {
    notFound()
  }

  // Check if user owns this project or is founder
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const canView = project.owner_id === session.user.id || userProfile?.role === 'founder'
  
  if (!canView) {
    redirect('/dashboard')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      case 'submitted': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'in_review': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileText className="w-4 h-4" />
      case 'submitted': return <Upload className="w-4 h-4" />
      case 'in_review': return <Clock className="w-4 h-4" />
      case 'active': return <CheckCircle className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
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
          
          {userProfile?.role === 'founder' && project.owner_id !== session.user.id && (
            <div className="bg-purple-600/20 px-4 py-2 rounded-full border border-purple-500/30">
              <span className="text-purple-200 text-sm font-semibold">Founder View</span>
            </div>
          )}
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12">
        {/* Project Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-4">{project.title}</h1>
              {project.logline && (
                <p className="text-xl text-purple-200 mb-4 leading-relaxed">{project.logline}</p>
              )}
              <div className="flex items-center space-x-4 text-sm text-purple-300">
                <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                {project.genre && <span>• {project.genre}</span>}
                {project.budget_range && <span>• {project.budget_range}</span>}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium border flex items-center gap-2 ${getStatusColor(project.status)}`}>
                {getStatusIcon(project.status)}
                {project.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-white font-semibold mb-4">Project Progress</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${project.script_uploads?.length > 0 ? 'bg-green-600' : 'bg-gray-600'}`}>
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-purple-200 font-medium">Script Uploaded</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${project.generated_assets?.length > 0 ? 'bg-green-600' : 'bg-gray-600'}`}>
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-purple-200 font-medium">AI Processing</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${project.status === 'in_review' || project.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}`}>
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <span className="text-purple-200 font-medium">Expert Review</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${project.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}`}>
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-purple-200 font-medium">Live Pitching</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Project Details */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6">Project Details</h2>
              
              {project.synopsis && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-purple-200 mb-3">Synopsis</h3>
                  <p className="text-purple-100 leading-relaxed">{project.synopsis}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {project.target_platforms && (
                  <div>
                    <h3 className="text-lg font-semibold text-purple-200 mb-2">Target Platform</h3>
                    <p className="text-purple-100">{project.target_platforms}</p>
                  </div>
                )}
                
                {project.budget_range && (
                  <div>
                    <h3 className="text-lg font-semibold text-purple-200 mb-2">Budget Range</h3>
                    <p className="text-purple-100">{project.budget_range}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Assets */}
            {project.generated_assets && project.generated_assets.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">Generated Pitch Materials</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {project.generated_assets.map((asset) => (
                    <div key={asset.id} className="bg-white/5 rounded-lg p-6 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-white font-semibold capitalize">
                            {asset.asset_type.replace('_', ' ')}
                          </h3>
                          <p className="text-purple-300 text-sm">
                            Version {asset.version} • {new Date(asset.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="bg-purple-600 hover:bg-purple-700 p-2 rounded-lg transition-colors">
                          <Download className="w-5 h-5 text-white" />
                        </button>
                      </div>
                      <div className="text-purple-200 text-sm">
                        Professional pitch materials generated by AI and refined by experts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Processing Status */}
            {project.script_uploads?.length > 0 && (!project.generated_assets || project.generated_assets.length === 0) && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="animate-spin">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">AI Processing in Progress</h2>
                    <p className="text-purple-200">We're analyzing your script and creating pitch materials</p>
                  </div>
                </div>
                
                <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                  <h3 className="text-purple-200 font-semibold mb-2">What's happening:</h3>
                  <ul className="text-purple-300 text-sm space-y-1">
                    <li>• Analyzing story structure and themes</li>
                    <li>• Extracting character profiles and relationships</li>
                    <li>• Generating professional pitch deck</li>
                    <li>• Creating series adaptation outline</li>
                    <li>• Preparing materials for expert review</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Uploaded Script */}
            {project.script_uploads && project.script_uploads.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-4">Uploaded Script</h3>
                {project.script_uploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-8 h-8 text-purple-400" />
                      <div>
                        <p className="text-white font-medium">{upload.file_name}</p>
                        <p className="text-purple-300 text-sm">
                          {upload.file_size ? `${(upload.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                        </p>
                        <p className="text-purple-300 text-xs">
                          Uploaded {new Date(upload.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button className="text-purple-400 hover:text-purple-300 transition-colors">
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Project Owner Info (for founders) */}
            {userProfile?.role === 'founder' && project.owner_id !== session.user.id && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-4">Creator</h3>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {project.profiles?.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-semibold">{project.profiles?.full_name}</p>
                    <p className="text-purple-300 text-sm capitalize">{project.profiles?.role}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Next Steps</h3>
              <div className="space-y-3 text-sm">
                {project.status === 'draft' && project.script_uploads?.length === 0 && (
                  <p className="text-purple-200">Upload your script to begin AI processing</p>
                )}
                {project.script_uploads?.length > 0 && (!project.generated_assets || project.generated_assets.length === 0) && (
                  <p className="text-purple-200">AI is processing your script. This usually takes 5-10 minutes.</p>
                )}
                {project.generated_assets?.length > 0 && project.status === 'draft' && (
                  <p className="text-purple-200">Your pitch materials are ready for expert review. Our team will reach out soon.</p>
                )}
                {project.status === 'in_review' && (
                  <p className="text-purple-200">Expert review in progress. We'll refine your materials and identify target buyers.</p>
                )}
                {project.status === 'active' && (
                  <p className="text-purple-200">Your project is live! We're actively pitching to relevant buyers and will keep you updated on progress.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}