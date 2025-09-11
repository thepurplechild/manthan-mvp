import { NextRequest, NextResponse } from 'next/server'
import { parseScriptFromBuffer } from '@/lib/script-parser'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  try {
    const { json, rawText, warnings } = await parseScriptFromBuffer(file.name, buf, file.type)
    return NextResponse.json({ json, warnings, length: rawText.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Parse failed' }, { status: 500 })
  }
}

