/* eslint-disable no-console */
import { getServerEnv, getClientEnv } from '../lib/env'

async function main() {
  let ok = true
  try {
    getServerEnv()
    console.log('✅ Server env OK')
  } catch (e: any) {
    ok = false
    console.error('❌ Server env error')
    console.error(String(e?.message || e))
  }

  try {
    getClientEnv()
    console.log('✅ Client env OK')
  } catch (e: any) {
    ok = false
    console.error('❌ Client env error')
    console.error(String(e?.message || e))
  }

  if (!ok) process.exit(1)
}

main().catch((e) => {
  console.error('❌ Unexpected error in check-env')
  console.error(e)
  process.exit(1)
})
