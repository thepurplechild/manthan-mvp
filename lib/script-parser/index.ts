import type { ScriptJSON, StandardizedScript } from './types'
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
export function toStandardized(json: ScriptJSON): StandardizedScript {
  const dialogue: StandardizedScript['dialogue'] = []
  const actions: StandardizedScript['actions'] = []
  const transitions: StandardizedScript['transitions'] = []
  for (const s of json.scenes) {
    for (const d of s.dialogues) dialogue.push({ character: d.character, lines: d.lines, sceneId: s.id })
    for (const a of s.action) actions.push({ text: a, sceneId: s.id })
    for (const t of (s.transitions || [])) transitions.push({ text: t, sceneId: s.id })
  }
  return {
    title: json.title,
    authors: json.authors,
    scenes: json.scenes,
    characters: json.characters,
    dialogue,
    actions,
    transitions,
    warnings: json.warnings,
  }
}
