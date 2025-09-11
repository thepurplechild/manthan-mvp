import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll(){return cookieStore.getAll()}, setAll(cs){cs.forEach(({name,value,options})=>cookieStore.set(name,value,options))} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const payload = {
    owner_id: user.id,
    title: body.title,
    logline: body.logline || null,
    synopsis: body.synopsis || null,
    genre: Array.isArray(body.genre) ? body.genre : [],
    target_platforms: Array.isArray(body.target_platforms) ? body.target_platforms : [],
    budget_range: body.budget_range || null,
    status: 'draft'
  }
  const { data, error } = await supabase.from('projects').insert(payload).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

