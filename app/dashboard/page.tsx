import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from 'next/link'
import { Plus, FileText, Clock, CheckCircle, BarChart3, Upload, Eye, Download } from 'lucide-react'

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
          <h1 className="text-4xl font-bold text-white mb-4">Your Creative Dashboard</h1>
          <p className="text-purple-200 text-lg">
            Manage your projects, track progress, and watch your stories come to life.
          </p>
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
                      {project.genre && <span>Genre: {project.genre}</span>}
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