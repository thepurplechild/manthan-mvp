import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status, processing_status, quality_score, last_run_at, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">Your Projects</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(projects || []).map((p: any) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="border rounded p-4 bg-white hover:shadow">
            <div className="font-semibold text-slate-800 mb-1">{p.title}</div>
            <div className="text-xs text-slate-500 mb-2">Created {new Date(p.created_at).toLocaleString()}</div>
            <div className="flex items-center gap-2 text-sm">
              <StatusChip status={p.processing_status || 'n/a'} />
              {p.quality_score!=null && <span className="text-slate-600">Quality: {(p.quality_score*100).toFixed(0)}%</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const color = status==='completed'?'bg-green-100 text-green-700':status==='running'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-700'
  return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{status}</span>
}

