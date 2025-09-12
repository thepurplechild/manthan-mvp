import type { DocumentPrep } from '@/lib/ai/pipeline'

export function validatePitch(prep: DocumentPrep) {
  const errors: string[] = []
  const warnings: string[] = []
  if (!prep?.merged?.core?.logline) errors.push('Missing logline')
  if (!prep?.merged?.core?.synopsis) errors.push('Missing synopsis')
  const outline = prep?.merged?.market?.outline || []
  if (!Array.isArray(outline) || outline.length === 0) warnings.push('No outline episodes')
  const chars = prep?.merged?.bible?.characters || {}
  if (!chars || Object.keys(chars).length === 0) warnings.push('No character bible entries')
  return { ok: errors.length === 0, errors, warnings }
}

