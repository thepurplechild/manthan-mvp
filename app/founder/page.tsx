// app/founder/page.tsx - Complete TypeScript fix
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Eye, 
  Download,
  Plus,
  Filter,
  Search
} from 'lucide-react'

// Local type definitions
interface Profile {
  id: string
  full_name: string | null
  role: string
  created_at: string
}

interface ScriptUpload {
  id: string
  project_id: string
  file_path: string
  file_name: string | null
  file_size: number | null
  uploaded_at: string
}

interface GeneratedAsset {
  id: string
  project_id: string
  asset_type: string
  asset_url: string | null
  version: number
  created_at: string
}

interface ProjectWithRelations {
  id: string
  owner_id: string
  title: string
  status: string
  logline: string | null
  synopsis: string | null
  genre: string | null
  character_breakdowns: unknown | null
  budget_range: string | null
  target_platforms: string | null
  created_at: string
  profiles?: Profile | null
  script_uploads?: ScriptUpload[] | null
  generated_assets?: GeneratedAsset[] | null
}

interface PlatformMandate {
  id: string
  platform_name: string
  mandate_description: string
  tags: string | null
  source: string | null
  created_by: string | null
  created_at: string
}

interface DealPipeline {
  id: string
  project_id: string
  target_buyer_name: string
  status: string
  feedback_notes: string | null
  updated_at: string
  projects?: {
    title: string
    profiles?: Profile | null
  } | null
}

export default async function FounderDashboard() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Check if user is founder
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role !== 'founder') {
    redirect('/dashboard')
  }

  // Get all projects with creator info
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      profiles!projects_owner_id_fkey(*),
      script_uploads(*),
      generated_assets(*)
    `)
    .order('created_at', { ascending: false })

  // Get platform mandates
  const { data: mandates } = await supabase
    .from('platform_mandates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  // Get deal pipeline entries
  const { data: deals } = await supabase
    .from('deal_pipeline')
    .select(`
      *,
      projects(title, profiles!projects_owner_id_fkey(full_name))
    `)
    .order('updated_at', { ascending: false })
    .limit(10)

  const typedProjects = (projects || []) as ProjectWithRelations[]
  const typedMandates = (mandates || []) as PlatformMandate[]
  const typedDeals = (deals || []) as DealPipeline[]

  // Calculate stats
  const totalProjects = typedProjects.length
  const activeProjects = typedProjects.filter((p: ProjectWithRelations) => p.status === 'active').length
  const projectsInReview = typedProjects.filter((p: ProjectWithRelations) => p.status === 'in_review').length
  const totalDeals = typedDeals.length

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400'
      case 'submitted': return 'bg-blue-500/20 text-blue-400'
      case 'in_review': return 'bg-yellow-500/20 text-yellow-400'
      case 'active': return 'bg-green-500/20 text-green-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getDealStatusColor = (status: string): string => {
    switch (status) {
      case 'introduced': return 'bg-blue-500/20 text-blue-400'
      case 'in_discussion': return 'bg-yellow-500/20 text-yellow-400'
      case 'deal_closed': return 'bg-green-500/20 text-green-400'
      case 'passed': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-black/20">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <div className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Manthan
              </span>
            </div>
            <div className="bg-purple-600/20 px-4 py-2 rounded-full border border-purple-500/30">
              <span className="text-purple-200 text-sm font-semibold">Founder Command Center</span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-purple-200 hover:text-white transition-colors">
              Creator View
            </Link>
            <form action="/auth/signout" method="post">
              <button 
                type="submit"
                className="text-purple-200 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Command Center</h1>
          <p className="text-purple-200 text-lg">
            Manage all projects, track deals, and oversee the Manthan marketplace
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-white">{totalProjects}</span>
            </div>
            <h3 className="text-purple-200 font-semibold">Total Projects</h3>
            <p className="text-purple-300 text-sm">All creator submissions</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-yellow-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-white">{projectsInReview}</span>
            </div>
            <h3 className="text-purple-200 font-semibold">In Review</h3>
            <p className="text-purple-300 text-sm">Awaiting curation</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-white">{activeProjects}</span>
            </div>
            <h3 className="text-purple-200 font-semibold">Active</h3>
            <p className="text-purple-300 text-sm">Being pitched</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-white">{totalDeals}</span>
            </div>
            <h3 className="text-purple-200 font-semibold">Active Deals</h3>
            <p className="text-purple-300 text-sm">In pipeline</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Projects Overview */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">All Projects</h2>
                <div className="flex items-center space-x-3">
                  <button className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors">
                    <Filter className="w-5 h-5 text-purple-200" />
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors">
                    <Search className="w-5 h-5 text-purple-200" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {typedProjects.length > 0 ? (
                  typedProjects.slice(0, 8).map((project: ProjectWithRelations) => (
                    <div key={project.id} className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                              {project.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          {project.logline && (
                            <p className="text-purple-200 text-sm mb-3">{project.logline}</p>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-purple-300">
                            <span>by {project.profiles?.full_name || 'Unknown'}</span>
                            <span>• {new Date(project.created_at).toLocaleDateString()}</span>
                            {project.genre && <span>• {project.genre}</span>}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="bg-purple-600 hover:bg-purple-700 p-2 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4 text-white" />
                          </Link>
                          {project.generated_assets && project.generated_assets.length > 0 && (
                            <button className="bg-green-600 hover:bg-green-700 p-2 rounded-lg transition-colors">
                              <Download className="w-4 h-4 text-white" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Project Status Indicators */}
                      <div className="flex items-center space-x-6 text-xs">
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${project.script_uploads && project.script_uploads.length > 0 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                          <span className="text-purple-300">Script</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${project.generated_assets && project.generated_assets.length > 0 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                          <span className="text-purple-300">AI Assets</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${project.status === 'in_review' || project.status === 'active' ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                          <span className="text-purple-300">Expert Review</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Projects Yet</h3>
                    <p className="text-purple-200">Projects from creators will appear here</p>
                  </div>
                )}
              </div>

              {typedProjects.length > 8 && (
                <div className="mt-6 text-center">
                  <button className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg text-white font-semibold transition-colors">
                    View All {typedProjects.length} Projects
                  </button>
                </div>
              )}
            </div>

            {/* Deal Pipeline */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Deal Pipeline</h2>
                <Link 
                  href="/founder/pipeline"
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-white font-semibold transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Deal
                </Link>
              </div>

              <div className="space-y-4">
                {typedDeals.length > 0 ? (
                  typedDeals.map((deal: DealPipeline) => (
                    <div key={deal.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-white font-medium">{deal.projects?.title || 'Unknown Project'}</h3>
                          <p className="text-purple-300 text-sm">
                            Pitched to: <span className="font-medium">{deal.target_buyer_name}</span>
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDealStatusColor(deal.status)}`}>
                          {deal.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      {deal.feedback_notes && (
                        <p className="text-purple-200 text-sm mt-2 italic">&quot;{deal.feedback_notes}&quot;</p>
                      )}
                      <p className="text-purple-400 text-xs mt-2">
                        Updated {new Date(deal.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Deals Yet</h3>
                    <p className="text-purple-200">Start pitching projects to build your pipeline</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link 
                  href="/founder/mandates"
                  className="w-full bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 px-4 py-3 rounded-lg text-purple-200 hover:text-white transition-all flex items-center gap-3"
                >
                  <Plus className="w-5 h-5" />
                  Add Platform Mandate
                </Link>
                <Link 
                  href="/founder/pipeline"
                  className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 px-4 py-3 rounded-lg text-blue-200 hover:text-white transition-all flex items-center gap-3"
                >
                  <TrendingUp className="w-5 h-5" />
                  Manage Pipeline
                </Link>
                <Link 
                  href="/founder/creators"
                  className="w-full bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 px-4 py-3 rounded-lg text-green-200 hover:text-white transition-all flex items-center gap-3"
                >
                  <Users className="w-5 h-5" />
                  View All Creators
                </Link>
              </div>
            </div>

            {/* Recent Platform Mandates */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Recent Platform Intel</h3>
              <div className="space-y-4">
                {typedMandates.length > 0 ? (
                  typedMandates.map((mandate: PlatformMandate) => (
                    <div key={mandate.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-white font-medium text-sm">{mandate.platform_name}</h4>
                        <span className="text-purple-400 text-xs">
                          {new Date(mandate.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-purple-200 text-sm">{mandate.mandate_description}</p>
                      {mandate.tags && (
                        <p className="text-purple-400 text-xs mt-2">Tags: {mandate.tags}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-purple-300 text-sm">No platform mandates yet</p>
                    <Link 
                      href="/founder/mandates"
                      className="text-purple-400 hover:text-purple-300 text-sm underline"
                    >
                      Add your first mandate
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">System Status</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-purple-200">AI Processing</span>
                  <span className="text-green-400">Operational</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-200">File Uploads</span>
                  <span className="text-green-400">Operational</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-200">Database</span>
                  <span className="text-green-400">Operational</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-200">Email Notifications</span>
                  <span className="text-yellow-400">Pending Setup</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}