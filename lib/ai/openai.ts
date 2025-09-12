// Minimal OpenAI chat client wrapper with JSON parsing and retries
export type ChatCall = {
  model?: string
  system?: string
  user: string
  temperature?: number
}

export class OpenAIClient {
  private apiKey: string
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('Missing OPENAI_API_KEY')
    }
  }

  async chatJSON<T = unknown>({ model = 'gpt-4o-mini', system, user, temperature = 0.2 }: ChatCall, retries = 2): Promise<{ json: T; raw: string }> {
    const body = {
      model,
      temperature,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
    }
    let lastErr: any
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`OpenAI error ${res.status}: ${txt}`)
        }
        const data = await res.json() as any
        const raw = data.choices?.[0]?.message?.content?.trim?.() || ''
        // Attempt JSON parse; accept fenced code blocks
        const jsonStr = raw.replace(/^```(json)?/i, '').replace(/```$/i, '').trim()
        const parsed = JSON.parse(jsonStr) as T
        return { json: parsed, raw }
      } catch (e: any) {
        lastErr = e
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    throw lastErr
  }
}

