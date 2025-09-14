import { z } from 'zod'

// Helper to parse sizes like "120k" => 120000
function parseNumberLike(input: string | number | undefined, fallback: number): number {
  if (typeof input === 'number') return input
  if (!input) return fallback
  const trimmed = String(input).trim().toLowerCase()
  const match = trimmed.match(/^(\d+)(k|m)?$/)
  if (!match) return Number.isFinite(Number(trimmed)) ? Number(trimmed) : fallback
  const value = Number(match[1])
  const unit = match[2]
  if (unit === 'k') return value * 1000
  if (unit === 'm') return value * 1000_000
  return value
}

const EnvSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.string().url({ message: 'NEXT_PUBLIC_APP_URL must be a valid URL' }),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({ message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Missing SUPABASE_SERVICE_ROLE_KEY'),

  // AI
  ANTHROPIC_API_KEY: z.string().min(1, 'Missing ANTHROPIC_API_KEY'),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20240620').optional(),

  // Pipeline limits
  FILE_MAX_SIZE_MB: z.string().or(z.number()).default('25'),
  PIPELINE_MAX_TOKENS: z.string().or(z.number()).default('120000'),
}).transform((raw) => {
  return {
    ...raw,
    FILE_MAX_SIZE_MB: parseNumberLike(raw.FILE_MAX_SIZE_MB as any, 25),
    PIPELINE_MAX_TOKENS: parseNumberLike(raw.PIPELINE_MAX_TOKENS as any, 120000),
  }
})

function logHint(msg: string) {
  // Keep logging minimal and server-safe
  // eslint-disable-next-line no-console
  console.warn(`[env] ${msg}`)
}

let parsed: z.infer<typeof EnvSchema> | null = null

try {
  parsed = EnvSchema.parse(process.env)
  // Optional hints for common missing-but-nonfatal values
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    logHint('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Public auth and Realtime may not work in the browser.')
  }
} catch (e: any) {
  const issues = e?.issues as { message: string; path?: (string | number)[] }[] | undefined
  if (issues && Array.isArray(issues)) {
    for (const issue of issues) {
      const where = issue.path && issue.path.length ? ` (${issue.path.join('.')})` : ''
      logHint(`${issue.message}${where}`)
    }
  } else {
    logHint(String(e?.message || e))
  }
  throw new Error('Environment validation failed. See warnings above for missing or invalid keys.')
}

export const env = parsed!
export type Env = typeof env

