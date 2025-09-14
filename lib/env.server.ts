import { z } from 'zod'

function parseNumberLike(input: unknown, fallback: number): number {
  if (typeof input === 'number') return input
  if (typeof input !== 'string') return fallback
  const t = input.trim().toLowerCase()
  const m = t.match(/^(\d+)(k|m)?$/)
  if (!m) return Number.isFinite(Number(t)) ? Number(t) : fallback
  const v = Number(m[1])
  const u = m[2]
  if (u === 'k') return v * 1_000
  if (u === 'm') return v * 1_000_000
  return v
}

const ServerSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'MISSING: ANTHROPIC_API_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'MISSING: SUPABASE_SERVICE_ROLE_KEY'),
  FILE_MAX_SIZE_MB: z.union([z.string(), z.number()]).optional().default(25),
  PIPELINE_MAX_TOKENS: z.union([z.string(), z.number()]).optional().default(120000),
})

function formatIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((i) => {
      const path = i.path && i.path.length ? ` (${i.path.join('.')})` : ''
      const msg = i.message || 'Invalid'
      return `- ${msg}${path}`
    })
    .join('\n')
}

export function getServerEnv() {
  const parsed = ServerSchema.safeParse(process.env)
  if (!parsed.success) {
    const formatted = formatIssues(parsed.error.issues)
        console.error('[env:server] Missing/invalid environment variables:\n' + formatted)
    throw new Error('Environment validation failed:\n' + formatted)
  }
  const raw = parsed.data
  return {
    ANTHROPIC_API_KEY: raw.ANTHROPIC_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY,
    FILE_MAX_SIZE_MB: parseNumberLike(raw.FILE_MAX_SIZE_MB, 25),
    PIPELINE_MAX_TOKENS: parseNumberLike(raw.PIPELINE_MAX_TOKENS, 120000),
  }
}

