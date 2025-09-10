import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get('region') || ''
  const language = req.nextUrl.searchParams.get('language') || ''
  const genre = req.nextUrl.searchParams.get('genre') || ''

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  // Prefer RPC if function exists
  const { data, error } = await supabase.rpc('recommend_content', { region, language, genre })
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 's-maxage=30' } })
  return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=120' } })
}

