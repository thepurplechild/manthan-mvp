#!/usr/bin/env node
/*
  Nav & Link Checker
  - Optionally boots dev server (set START_DEV=1) if base is unreachable
  - Crawls internal links starting at base (default http://localhost:3000)
  - Validates Next.js <Link href> destinations exist in app/ tree
  Usage: node scripts/link-check.mjs [baseUrl]
*/
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const base = process.argv[2] || process.env.LINK_BASE || 'http://localhost:3000'
const origin = new URL(base).origin

async function wait(ms){ return new Promise(r => setTimeout(r, ms)) }
async function ping(url){ try{ const r = await fetch(url,{method:'HEAD'}); return r.ok } catch{ return false } }

let devProc = null
if (process.env.START_DEV === '1') {
  const ok = await ping(base)
  if (!ok) {
    console.log('Starting dev server...')
    devProc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','dev'], { stdio: 'inherit' })
    for (let i=0;i<60;i++){ if (await ping(base)) break; await wait(1000) }
  }
}

const visited = new Set()
const queue = [base]
const results = []

function normalize(url) {
  const u = new URL(url, origin)
  u.hash = ''
  return u.toString()
}

function extractLinks(html, currentUrl) {
  const links = new Set()
  const hrefRegex = /href=\"([^\"]+)\"/g
  let m
  while ((m = hrefRegex.exec(html))) {
    const href = m[1]
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    const abs = new URL(href, currentUrl).toString()
    if (abs.startsWith(origin) && !abs.includes('/api/')) links.add(abs)
  }
  return [...links]
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const status = res.status
    let body = ''
    if (res.headers.get('content-type')?.includes('text/html')) body = await res.text()
    results.push({ url, status })
    if (status < 400 && body) {
      const links = extractLinks(body, url)
      for (const l of links) if (!visited.has(l)) queue.push(l)
    }
  } catch (e) {
    results.push({ url, status: 0, error: String(e) })
  }
}

function walk(dir, acc=[]) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (/[jt]sx?$/.test(f)) acc.push(p)
  }
  return acc
}

function collectRoutes(root='app'){
  const routes = new Set(['/'])
  function rec(path, urlPrefix=''){
    for (const f of readdirSync(path)){
      const fp = join(path,f)
      const st = statSync(fp)
      if (st.isDirectory()) rec(fp, urlPrefix + '/' + f)
      else if (f === 'page.tsx' || f === 'page.jsx') routes.add(urlPrefix || '/')
      else if (f === 'route.ts' || f === 'route.js') routes.add(urlPrefix)
    }
  }
  if (existsSync(root)) rec(root, '')
  return routes
}

function collectLinkHrefs(){
  const files = walk(process.cwd())
  const out = []
  const rx = /<Link[^>]*href=\"([^\"]+)\"/g
  for (const file of files){
    if (file.includes(sep+'node_modules'+sep)) continue
    const txt = readFileSync(file,'utf8')
    let m; while((m = rx.exec(txt))){ const href = m[1]; if (href.startsWith('/') && !href.startsWith('/api')) out.push({ file, href }) }
  }
  return out
}

;(async () => {
  while (queue.length) {
    const url = normalize(queue.shift())
    if (visited.has(url)) continue
    visited.add(url)
    await fetchPage(url)
  }
  const broken = results.filter(r => r.status >= 400 || r.status === 0)
  console.log('\nLink Check Summary (base:', base, ')')
  console.table(results.map(r => ({ url: r.url, status: r.status || 'ERR' })))
  if (broken.length) {
    console.error('\nBroken routes:')
    console.table(broken.map(r => ({ url: r.url, status: r.status || 'ERR' })))
  }

  const routes = collectRoutes('app')
  const links = collectLinkHrefs()
  const missing = links.filter(l => !routes.has(l.href))
  if (missing.length){
    console.error('\nMissing route targets from <Link href>:')
    console.table(missing.map(m => ({ href: m.href, file: m.file })))
  }

  if (broken.length || missing.length) process.exitCode = 1
  if (devProc) devProc.kill()
})()
