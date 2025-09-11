import * as mammoth from 'mammoth'
import type { ScriptJSON } from './types'
import { parseScreenplayText } from './text'

export async function parseDocxToScriptJSON(buffer: Buffer): Promise<{ json: ScriptJSON; rawText: string; warnings: string[] }> {
  const warnings: string[] = []
  try {
    const { value } = await mammoth.extractRawText({ buffer })
    const text = value || ''
    const json = parseScreenplayText(text)
    return { json, rawText: text, warnings }
  } catch (e: any) {
    warnings.push(`mammoth error: ${e?.message||e}`)
    const json = parseScreenplayText('')
    json.warnings = warnings
    return { json, rawText: '', warnings }
  }
}

