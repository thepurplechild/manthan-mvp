import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generatePitchDeckPDF, generateExecutiveSummaryPDF } from '@/lib/docgen/pdf'
import { generatePitchDeckPPTX } from '@/lib/docgen/pptx'
import { validatePitch } from '@/lib/docgen/quality'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll(){return cookieStore.getAll()}, setAll(cs){ cs.forEach(({name,value,options})=>cookieStore.set(name,value,options)) } } }
  )
  const body = await req.json()
  const { prep, format = 'pdf', projectId } = body
  if (!prep) return NextResponse.json({ error: 'Missing prep' }, { status: 400 })
  const qa = validatePitch(prep)
  try {
    let bytes: ArrayBuffer
    let ext = 'pdf'
    if (format === 'pdf') {
      bytes = generatePitchDeckPDF(prep)
      ext = 'pdf'
    } else if (format === 'summary') {
      bytes = generateExecutiveSummaryPDF(prep)
      ext = 'pdf'
    } else if (format === 'pptx') {
      bytes = await generatePitchDeckPPTX(prep)
      ext = 'pptx'
    } else {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

    const path = `generated-assets/${projectId || 'misc'}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('generated-assets').upload(path, Buffer.from(bytes), { upsert: true, contentType: ext === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, path, qa })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Docgen failed' }, { status: 500 })
  }
}

