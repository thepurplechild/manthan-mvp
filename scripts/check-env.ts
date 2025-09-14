/* eslint-disable no-console */
import { getServerEnv, getClientEnv } from '../lib/env'

async function main() {
  let ok = true
  try {
    getServerEnv()
    console.log('✅ Server env OK')
  } catch (e: unknown) {
    ok = false
    console.error('❌ Server env error')
    console.error(e instanceof Error ? e.message : String(e))
  }

  try {
    getClientEnv()
    console.log('✅ Client env OK')
  } catch (e: unknown) {
    ok = false
    console.error('❌ Client env error')
    console.error(e instanceof Error ? e.message : String(e))
  }

  if (!ok) process.exit(1)
}

main().catch((e: unknown) => {
  console.error('❌ Unexpected error in check-env')
  console.error(e instanceof Error ? e.stack || e.message : String(e))
  process.exit(1)
})
