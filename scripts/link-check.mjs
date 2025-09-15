#!/usr/bin/env node
/*
  Dev crawler: follows internal links starting at base (default http://localhost:3000)
  Usage: node scripts/link-check.mjs [baseUrl]
*/
const base = process.argv[2] || process.env.LINK_BASE || 'http://localhost:3000'
const origin = new URL(base).origin

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
    process.exitCode = 1
  }
})()

