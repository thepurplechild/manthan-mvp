import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from 'next/link'
import { Plus, FileText, Clock, CheckCircle, BarChart3, Upload, Eye, Download, Sparkles, Newspaper, TrendingUp, Building2 } from 'lucide-react'

export default async function Dashboard() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      script_uploads (*),
      generated_assets (*)
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Recent activity (uploads/assets)
  interface ProjectWithUploadsAndAssets {
    id: string;
    title: string;
    script_uploads?: Array<{ uploaded_at: string; file_name?: string }>;
    generated_assets?: Array<{ created_at: string; asset_type: string }>;
    genre?: string[];
  }
  
  const recentUploads = (projects || [])
    .flatMap((p: ProjectWithUploadsAndAssets) => (p.script_uploads || []).map((u) => ({
      type: 'upload' as const,
      projectId: p.id,
      projectTitle: p.title,
      at: u.uploaded_at,
      label: u.file_name || 'Script upload'
    })))
  const recentAssets = (projects || [])
    .flatMap((p: ProjectWithUploadsAndAssets) => (p.generated_assets || []).map((a) => ({
      type: 'asset' as const,
      projectId: p.id,
      projectTitle: p.title,
      at: a.created_at,
      label: a.asset_type
    })))
  const recentActivity = [...recentUploads, ...recentAssets]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5)

  // Market trends from your genres
  const genreCounts: Record<string, number> = {}
  for (const p of projects || []) {
    const project = p as ProjectWithUploadsAndAssets;
    if (Array.isArray(project.genre)) {
      for (const g of project.genre) {
        if (!g) continue
        genreCounts[g] = (genreCounts[g] || 0) + 1
      }
    }
  }
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Pull 2-3 insights from indian_market_trends
  const { data: trends } = await supabase
    .from('indian_market_trends')
    .select('region,trending_genres,seasonal_prefs')
    .order('updated_at', { ascending: false })
    .limit(3)

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
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Manthan
            </span>
          </Link>
          <div className="flex items-center space-x-6">
            <div className="text-purple-200">
              Welcome, <span className="text-white font-semibold">{profile?.full_name}</span>
            </div>
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
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Your Creative Dashboard</h1>
          <p className="text-purple-200 text-lg">Manage your projects, track progress, and watch your stories come to life.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/projects/new" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-4 py-2 rounded-xl text-white">
              <Plus className="w-4 h-4" /> New Project
            </Link>
            <Link href="/test-ingestion" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-white border border-white/20">
              <Upload className="w-4 h-4" /> Upload Script
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">{projects?.length || 0}</span>
            </div>
            <h3 className="text-purple-200 font-semibold">Total Projects</h3>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                {projects?.filter(p => p.status === 'in_review').length || 0}
              </span>
            </div>
            <h3 className="text-purple-200 font-semibold">In Review</h3>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                {projects?.filter(p => p.status === 'active').length || 0}
              </span>
            </div>
            <h3 className="text-purple-200 font-semibold">Active</h3>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-600 w-12 h-12 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">--</span>
            </div>
            <h3 className="text-purple-200 font-semibold">Success Rate</h3>
          </div>
        </div>

        {/* Projects Section */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Your Projects</h2>
          <Link 
            href="/projects/new"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-6 py-3 rounded-full text-white font-semibold flex items-center gap-2 transition-all transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            New Project
          </Link>
        </div>

        {/* India-focused widgets */}
        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white font-semibold">
                <TrendingUp className="w-5 h-5" /> Market Trends
              </div>
              <span className="text-purple-200 text-sm">Your genres</span>
            </div>
            {topGenres.length > 0 ? (
              <div className="space-y-3">
                {topGenres.map(([g, c]) => (
                  <div key={g} className="flex items-center justify-between">
                    <span className="text-white/90">{g}</span>
                    <span className="text-purple-200">{c}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-purple-200">Add genres to your projects to see trends.</p>
            )}
            {/* Global trends */}
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-white/80 font-semibold mb-2">Regional Insights</p>
              <ul className="space-y-1 text-purple-200 text-sm">
                {(trends || []).map((t: { region: string; trending_genres?: string[] }, idx: number) => (
                  <li key={idx}>• {t.region}: {(t.trending_genres || []).slice(0,3).join(', ')}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Building2 className="w-5 h-5" /> Platform Status
              </div>
              <span className="text-purple-200 text-sm">Connect data</span>
            </div>
            <ul className="space-y-2 text-purple-200">
              <li>Netflix India — Actively acquiring</li>
              <li>Prime Video India — Selective</li>
              <li>Disney+ Hotstar — Actively acquiring</li>
              <li>Zee5/SonyLIV — Genre dependent</li>
            </ul>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white font-semibold">
                <BarChart3 className="w-5 h-5" /> Revenue Tracker
              </div>
              <span className="text-purple-200 text-sm">Placeholder</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-white">—</div>
                <div className="text-purple-300 text-sm">Gross</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">—</div>
                <div className="text-purple-300 text-sm">Estimates</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">—</div>
                <div className="text-purple-300 text-sm">Pipelines</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity & Community */}
        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-2 text-white font-semibold mb-4">
              <Sparkles className="w-5 h-5" /> Recent Activity
            </div>
            {recentActivity.length > 0 ? (
              <ul className="space-y-3">
                {recentActivity.map((a, idx) => (
                  <li key={idx} className="flex items-center justify-between text-purple-200">
                    <span>
                      {a.type === 'upload' ? 'Upload' : 'Asset'} • {a.label} • <span className="text-white">{a.projectTitle}</span>
                    </span>
                    <span className="text-xs">{new Date(a.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-purple-300">No recent activity yet.</p>
            )}
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-2 text-white font-semibold mb-4">
              <Newspaper className="w-5 h-5" /> Community Updates
            </div>
            <ul className="space-y-2 text-purple-200">
              <li>• New OTT pitch windows opening next month</li>
              <li>• Genre trends: Crime thrillers, slice-of-life web series</li>
              <li>• Connect your industry feed to see more</li>
            </ul>
          </div>
        </div>

        {/* Projects List */}
        <div className="space-y-6">
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <div key={project.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{project.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-2 ${getStatusColor(project.status)}`}>
                        {getStatusIcon(project.status)}
                        {project.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    {project.logline && (
                      <p className="text-purple-200 text-lg mb-4">{project.logline}</p>
                    )}
                    <div className="flex items-center space-x-6 text-sm text-purple-300">
                      <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                      {project.genre && <span>Genre: {Array.isArray(project.genre) ? project.genre.slice(0,2).join(', ') : project.genre}</span>}
                      {project.character_breakdowns?.india_metadata?.languages?.length ? (
                        <span>Lang: {project.character_breakdowns.india_metadata.languages.slice(0,2).join(', ')}</span>
                      ) : null}
                      {project.target_platforms ? (
                        <span>
                          Platforms: {Array.isArray(project.target_platforms)
                            ? project.target_platforms.slice(0, 2).join(', ')
                            : String(project.target_platforms)}
                        </span>
                      ) : null}
                      {project.script_uploads?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Upload className="w-4 h-4" />
                          Script Uploaded
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-colors"
                      title="View Project"
                    >
                      <Eye className="w-5 h-5 text-white" />
                    </Link>
                    {project.generated_assets?.length > 0 && (
                      <button 
                        className="bg-green-600/20 hover:bg-green-600/30 p-3 rounded-lg transition-colors border border-green-500/30"
                        title="Download Assets"
                      >
                        <Download className="w-5 h-5 text-green-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center space-x-8">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${project.script_uploads?.length > 0 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                    <span className="text-sm text-purple-200">Script</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${project.generated_assets?.length > 0 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                    <span className="text-sm text-purple-200">AI Pitch Deck</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${project.status === 'in_review' || project.status === 'active' ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                    <span className="text-sm text-purple-200">Expert Review</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${project.status === 'active' ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                    <span className="text-sm text-purple-200">Live Pitching</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="bg-white/5 rounded-2xl p-12 border border-white/10">
                <FileText className="w-16 h-16 text-purple-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-4">No Projects Yet</h3>
                <p className="text-purple-200 mb-8 max-w-md mx-auto">
                  Ready to turn your script into a professional pitch? Create your first project to get started.
                </p>
                <Link 
                  href="/projects/new"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-full text-white font-semibold inline-flex items-center gap-3 transition-all transform hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Project
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
