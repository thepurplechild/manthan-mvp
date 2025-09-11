import type { ScriptJSON } from './types'
import { parsePdfToScriptJSON } from './pdf'
import { parseDocxToScriptJSON } from './docx'
import { parseScreenplayText } from './text'

export async function parseScriptFromBuffer(filename: string, buffer: Buffer, mime?: string): Promise<{ json: ScriptJSON; rawText: string; warnings: string[] }> {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf' || mime === 'application/pdf') return parsePdfToScriptJSON(buffer)
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDocxToScriptJSON(buffer)
  // Plain text fallback
  const text = buffer.toString('utf-8')
  const json = parseScreenplayText(text)
  return { json, rawText: text, warnings: json.warnings || [] }
}

export * from './types'

