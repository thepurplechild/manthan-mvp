import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { AIPipeline } from '@/lib/ai/pipeline'

async function updateStep(supabase: any, ingestion_id: string, name: string, patch: any) {
  await supabase.from('ingestion_steps').update(patch).eq('ingestion_id', ingestion_id).eq('name', name)
}

async function setProgress(supabase: any, ingestion_id: string, pct: number, status?: string) {
  const p: any = { progress: pct }
  if (status) p.status = status
  await supabase.from('ingestions').update(p).eq('id', ingestion_id)
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll(){return cookieStore.getAll()}, setAll(cs){ cs.forEach(({name,value,options})=>cookieStore.set(name,value,options)) } } }
  )
  const body = await req.json()
  const { script, ingestion_id, platform = 'Netflix India', creator = {} } = body
  if (!script) return NextResponse.json({ error: 'Missing script JSON' }, { status: 400 })
  const pipeline = new AIPipeline()

  try {
    if (ingestion_id) await setProgress(supabase, ingestion_id, 20, 'running')
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'core_extraction', { status: 'running', started_at: new Date().toISOString() })
    const core = await pipeline.coreElements(script)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'core_extraction', { status: 'succeeded', finished_at: new Date().toISOString(), output: core })

    if (ingestion_id) await setProgress(supabase, ingestion_id, 40)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'character_bible', { status: 'running', started_at: new Date().toISOString() })
    const bible = await pipeline.characterBible(script, core)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'character_bible', { status: 'succeeded', finished_at: new Date().toISOString(), output: bible })

    if (ingestion_id) await setProgress(supabase, ingestion_id, 60)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'market_adaptation', { status: 'running', started_at: new Date().toISOString() })
    const market = await pipeline.marketAdaptation(core, platform)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'market_adaptation', { status: 'succeeded', finished_at: new Date().toISOString(), output: market })

    if (ingestion_id) await setProgress(supabase, ingestion_id, 75)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'package_assembly', { status: 'running', started_at: new Date().toISOString() })
    const deck = await pipeline.pitchDeck(core, bible, market, creator)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'package_assembly', { status: 'succeeded', finished_at: new Date().toISOString(), output: deck })

    if (ingestion_id) await setProgress(supabase, ingestion_id, 85)
    const visuals = await pipeline.visualConcepts(core)

    if (ingestion_id) await setProgress(supabase, ingestion_id, 95)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'final_package', { status: 'running', started_at: new Date().toISOString() })
    const prep = await pipeline.documentPrep(core, bible, market, deck, visuals)
    if (ingestion_id) await updateStep(supabase, ingestion_id, 'final_package', { status: 'succeeded', finished_at: new Date().toISOString(), output: prep })

    if (ingestion_id) await setProgress(supabase, ingestion_id, 100, 'succeeded')
    return NextResponse.json({ ok: true, core, bible, market, deck, visuals, prep })
  } catch (e: any) {
    if (ingestion_id) await setProgress(supabase, ingestion_id, 100, 'failed')
    return NextResponse.json({ error: e?.message || 'AI pipeline failed' }, { status: 500 })
  }
}

