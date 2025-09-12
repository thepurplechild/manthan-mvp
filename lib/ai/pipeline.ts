import { OpenAIClient } from './openai'
import type { ScriptJSON } from '@/lib/script-parser'

export type CoreElements = { logline: string; synopsis: string; themes: string[]; characters: { name: string; description?: string }[] }
export type CharacterBible = { characters: Record<string, { motivation: string; conflicts: string[]; relationships: string[]; arc: string; cultural_background?: string }> }
export type MarketAdaptation = { platform: string; outline: { episode: number; title: string; summary: string }[] }
export type PitchDeck = { title_page: any; logline: string; why_now: string; characters: any[]; outline: any[]; positioning: string; creator_bio: string }
export type VisualConcepts = { concepts: { type: 'scene'|'character'|'location'; description: string }[] }
export type DocumentPrep = { merged: any; quality?: number }

const SYSTEM = 'You are an expert Indian media development executive and story analyst. Always output strict JSON matching the requested schema.'

function scoreQuality(obj: any) {
  let score = 0
  if (obj?.logline) score += 2
  if (obj?.synopsis?.length > 200) score += 2
  if (Array.isArray(obj?.themes) && obj.themes.length) score += 1
  return Math.min(10, 5 + score)
}

export class AIPipeline {
  private client: OpenAIClient
  constructor(apiKey?: string) { this.client = new OpenAIClient(apiKey) }

  async coreElements(script: ScriptJSON): Promise<CoreElements> {
    const user = `Analyze the following screenplay JSON (scenes, characters). Extract core elements.
Return JSON with keys: {"logline": string, "synopsis": string, "themes": string[], "characters": [{"name": string, "description": string}]}.
Screenplay JSON:\n${JSON.stringify(script).slice(0, 20000)}`
    const { json } = await this.client.chatJSON<CoreElements>({ system: SYSTEM, user })
    return json
  }

  async characterBible(script: ScriptJSON, core: CoreElements): Promise<CharacterBible> {
    const user = `Create a detailed character bible for the following characters in an Indian context.
Return: {"characters": { "<NAME>": {"motivation": string, "conflicts": string[], "relationships": string[], "arc": string, "cultural_background": string } }}
Characters: ${JSON.stringify(core.characters)}\nSynopsis: ${core.synopsis}`
    const { json } = await this.client.chatJSON<CharacterBible>({ system: SYSTEM, user })
    return json
  }

  async marketAdaptation(core: CoreElements, platform: string): Promise<MarketAdaptation> {
    const user = `Adapt the story for ${platform} (India). Produce a 10-episode outline.
Return: {"platform": string, "outline": [{"episode": number, "title": string, "summary": string}]}
Synopsis: ${core.synopsis}\nThemes: ${JSON.stringify(core.themes)}`
    const { json } = await this.client.chatJSON<MarketAdaptation>({ system: SYSTEM, user })
    return json
  }

  async pitchDeck(core: CoreElements, bible: CharacterBible, market: MarketAdaptation, creator: { name?: string; bio?: string }): Promise<PitchDeck> {
    const user = `Create pitch deck content as JSON with sections: {"title_page": any, "logline": string, "why_now": string, "characters": any[], "outline": any[], "positioning": string, "creator_bio": string}.
Use Indian M&E context.
Inputs:\n${JSON.stringify({ core, bible, market, creator }).slice(0, 15000)}`
    const { json } = await this.client.chatJSON<PitchDeck>({ system: SYSTEM, user })
    return json
  }

  async visualConcepts(core: CoreElements, genre?: string, setting?: string): Promise<VisualConcepts> {
    const user = `Generate visual concept descriptions.
Return: {"concepts": [{"type": "scene"|"character"|"location", "description": string}]}.
Themes: ${JSON.stringify(core.themes)}\nGenre: ${genre||''}\nSetting: ${setting||''}`
    const { json } = await this.client.chatJSON<VisualConcepts>({ system: SYSTEM, user })
    return json
  }

  async documentPrep(core: CoreElements, bible: CharacterBible, market: MarketAdaptation, deck: PitchDeck, visuals: VisualConcepts): Promise<DocumentPrep> {
    const merged = { core, bible, market, deck, visuals }
    return { merged, quality: scoreQuality(core) }
  }
}

