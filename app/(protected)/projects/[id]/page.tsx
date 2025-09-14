import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AssetList } from '@/components/projects/AssetList'
import { OutputList } from '@/components/projects/OutputList'
import { ReprocessDialog } from '@/components/projects/ReprocessDialog'

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const projectId = params.id
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, status, processing_status, quality_score, last_run_at, created_at')
    .eq('id', projectId)
    .single()
  if (!project) redirect('/projects')

  const { data: outputs } = await supabase
    .from('generated_content')
    .select('step, payload, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const { data: assets } = await supabase
    .from('generated_assets')
    .select('kind, storage_path, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  async function share(path: string) {
    'use server'
    // This is a placeholder; client-side uses /api/assets/share
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <div className="flex gap-2 items-center">
          <ReprocessDialog projectId={projectId} />
          <Link href="/projects" className="px-3 py-1.5 rounded bg-slate-200 text-slate-900 text-sm">Back</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">AI Outputs</h2>
            <OutputList outputs={outputs || []} />
          </section>
        </div>
        <div className="lg:col-span-1">
          <section>
            <h2 className="text-lg font-semibold mb-2">Documents</h2>
            {/* client-side component will use /api/assets/share to copy link */}
            <AssetList assets={assets || []} onShare={async ()=>{}} />
          </section>
        </div>
      </div>
    </div>
  )
}

