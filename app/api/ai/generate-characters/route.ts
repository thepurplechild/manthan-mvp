import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { stepGenerateCharacters } from '@/lib/ai/steps'
import { CoreElements, CharactersResult } from '@/types/pipeline'

const Body = z.object({
  projectId: z.string().optional(),
  ingestionId: z.string().optional(),
  core: CoreElements,
  forceReprocess: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`ai:characters:${ip}`, 20, 60000)
  if (!rl.allowed) return NextResponse.json({ code: 'rate_limited', message: 'Too many requests', hint: `Retry in ${Math.ceil(rl.retryAfter/1000)}s` }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ code: 'unauthorized', message: 'Sign in required' }, { status: 401 })

  const body = Body.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ code: 'bad_request', message: 'Invalid payload', hint: body.error.issues.map(i=>i.message).join('; ') }, { status: 400 })

  try {
    const res: CharactersResult = await stepGenerateCharacters(body.data.core)
    return NextResponse.json({ ok: true, result: res })
  } catch (e: any) {
    return NextResponse.json({ code: 'ai_failed', message: String(e?.message || e), retriable: true }, { status: 500 })
  }
}

