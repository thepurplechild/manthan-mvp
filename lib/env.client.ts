import { z } from 'zod'

const isDev = process.env.NODE_ENV !== 'production'

const ClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('INVALID URL: NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_APP_URL: z.string().refine((v) => {
    try {
      const u = new URL(v)
      return isDev ? true : u.protocol === 'https:'
    } catch {
      return false
    }
  }, 'INVALID URL: NEXT_PUBLIC_APP_URL'),
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

export function getClientEnv() {
  const parsed = ClientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  })
  if (!parsed.success) {
    const formatted = formatIssues(parsed.error.issues)
    // eslint-disable-next-line no-console
    console.warn('[env:client] Missing/invalid environment variables:\n' + formatted)
    throw new Error('Environment validation failed:\n' + formatted)
  }
  return parsed.data
}

