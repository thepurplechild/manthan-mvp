import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientView from './view'

export default async function ResultsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const projectId = searchParams?.projectId
  if (!projectId) {
    redirect('/dashboard')
  }

  return <ClientView projectId={projectId} />
}

