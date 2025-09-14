import type { CoreElements, CharactersResult } from '@/types/pipeline'

export function buildMarketPrompt(core: CoreElements, chars: CharactersResult) {
  const system = 'You are an Indian entertainment strategist. Respond in strict JSON.'
  const prompt = `Given the core elements and characters, propose an India-focused market adaptation. Return JSON with keys: recommendations (array of { platform, note }), variants (array of { format: 'OTT'|'Film'|'Shorts', angle }).\n\nCORE:\n${JSON.stringify(core)}\n\nCHARACTERS:\n${JSON.stringify(chars)}`
  return { system, prompt }
}

