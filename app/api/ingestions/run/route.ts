import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ingestFile } from '@/lib/ingestion/core'
import { rateLimit } from '@/lib/rate-limit'

type StepName = 'script_preprocess'|'core_extraction'|'character_bible'|'market_adaptation'|'package_assembly'|'final_package'

export async function POST(req: NextRequest) {
  const { ingestion_id } = await req.json()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`run:${ip}`, 20, 60000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfter/1000)) } })
  }
  if (!ingestion_id) return NextResponse.json({ error: 'Missing ingestion_id' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      }
    }
  )

  // Fetch ingestion & steps
  const { data: ingestion, error } = await supabase.from('ingestions').select('*').eq('id', ingestion_id).single()
  if (error || !ingestion) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })

  // Update status running
  await supabase.from('ingestions').update({ status: 'running', progress: 5 }).eq('id', ingestion_id)

  const updateStep = async (name: StepName, status: 'running'|'succeeded'|'failed', output?: any, err?: string) => {
    const patch: any = { status }
    if (status === 'running') patch.started_at = new Date().toISOString()
    if (status === 'succeeded') patch.finished_at = new Date().toISOString(), patch.output = output || {}
    if (status === 'failed') patch.finished_at = new Date().toISOString(), patch.error = err || 'failed'
    await supabase.from('ingestion_steps').update(patch).eq('ingestion_id', ingestion_id).eq('name', name)
  }

  const setProgress = async (pct: number) => {
    await supabase.from('ingestions').update({ progress: pct }).eq('id', ingestion_id)
  }

  // Download source file from storage
  // source_file_url stores the storage path
  const path: string = ingestion.source_file_url
  const dl = await supabase.storage.from('scripts').download(path)
  if (dl.error) {
    await supabase.from('ingestions').update({ status: 'failed', error: dl.error.message }).eq('id', ingestion_id)
    return NextResponse.json({ error: dl.error.message }, { status: 500 })
  }
  const fileBlob = dl.data
  const arrayBuf = await fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)

  try {
    await updateStep('script_preprocess','running')
    const res = await ingestFile(path.split('/').pop() || 'script', buffer, undefined, { extractMetadata: true })
    await updateStep('script_preprocess','succeeded', { metadata: res.content?.metadata, contentType: res.content?.contentType })
    await setProgress(25)

    await updateStep('core_extraction','running')
    const core = {
      logline: res.content?.metadata.title ? `${res.content?.metadata.title} — a compelling story` : 'A compelling story',
      synopsis: (res.content?.textContent || '').slice(0, 1200),
      themes: ['ambition','identity','family'],
      genres: Array.isArray((res as any).content?.metadata?.genre) ? (res as any).content?.metadata?.genre : [],
      main_characters: []
    }
    await updateStep('core_extraction','succeeded', core)
    await setProgress(45)

    await updateStep('character_bible','running')
    const bible = { characters: [{ name: 'Protagonist', arc: 'from doubt to purpose' }] }
    await updateStep('character_bible','succeeded', bible)
    await setProgress(60)

    await updateStep('market_adaptation','running')
    const market = { recommendations: [{ platform: 'Disney+ Hotstar', note: 'Family-friendly positioning' }] }
    await updateStep('market_adaptation','succeeded', market)
    await setProgress(75)

    await updateStep('package_assembly','running')
    const outline = { deck_outline: ['Title','Logline','Synopsis','Characters','Market Fit','Budget'], budget: { range: '₹1Cr–₹5Cr' } }
    await updateStep('package_assembly','succeeded', outline)
    await setProgress(90)

    await updateStep('final_package','running')
    const pkgSummary = { summary: { ...core, ...bible, ...market, ...outline } }
    // Optionally: upload a JSON summary as artifact
    const artifactPath = `generated-assets/${ingestion.user_id}/${ingestion_id}/summary.json`
    await supabase.storage.from('generated-assets').upload(artifactPath, Buffer.from(JSON.stringify(pkgSummary.summary, null, 2)), { contentType: 'application/json', upsert: true })
    await supabase.from('packages').insert({ ingestion_id, summary: pkgSummary.summary, artifacts: [{ path: artifactPath, type: 'summary' }] })
    await updateStep('final_package','succeeded', { artifacts: [{ path: artifactPath }] })
    await supabase.from('ingestions').update({ status: 'succeeded', progress: 100 }).eq('id', ingestion_id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    await supabase.from('ingestions').update({ status: 'failed', error: String(e?.message || e) }).eq('id', ingestion_id)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
