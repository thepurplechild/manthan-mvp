"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type StepStatus = 'queued'|'pending'|'running'|'failed'|'succeeded'|'skipped'|'completed'
export type StepName = 'core_extraction'|'character_bible'|'market_adaptation'|'package_assembly'|'visuals'|'final_package'

export interface PipelineStep {
  name: StepName
  status: StepStatus
  startedAt?: string
  finishedAt?: string
  output?: any
  error?: string
}

export interface PipelineState {
  ingestionId?: string
  projectId?: string
  progress: number
  status: string
  steps: PipelineStep[]
  assets: { storage_path?: string; kind?: string }[]
}

export function usePipelineProgress(projectId: string | undefined) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<PipelineState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const [docsReady, setDocsReady] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/pipeline-status?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const json = await res.json()
      setState(json.data)
      return json.data as PipelineState
    } catch (e: any) {
      setError(String(e?.message || e))
      return null
    }
  }, [projectId])

  const start = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/process-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
      if (!res.ok) throw new Error(`Start failed: ${res.status}`)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const generateDocuments = useCallback(async (s: PipelineState) => {
    // If already have assets, skip
    if (!s || (s.assets && s.assets.length > 0)) return
    // Find step outputs for assembly
    const core = s.steps.find(x => x.name === 'core_extraction')?.output || {}
    const characters = s.steps.find(x => x.name === 'character_bible')?.output || {}
    const market = s.steps.find(x => x.name === 'market_adaptation')?.output || {}
    const pitch = s.steps.find(x => x.name === 'package_assembly')?.output || {}
    const visuals = s.steps.find(x => x.name === 'visuals')?.output || {}
    if (!s.projectId) return
    const payload = {
      projectId: s.projectId,
      data: {
        title: core?.title || 'Pitch Deck',
        logline: core?.logline,
        synopsis: core?.synopsis,
        themes: core?.themes,
        genres: core?.genres,
        characters: characters?.characters,
        marketTags: (market?.recommendations || []).map((r: any) => r.platform)
      }
    }
    const res = await fetch('/api/generate-documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) {
      setDocsReady(true)
      await fetchStatus()
    }
  }, [fetchStatus])

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    ;(async () => {
      const current = await fetchStatus()
      if (!current || current.status !== 'succeeded') {
        await start()
      }
      if (pollRef.current) clearInterval(pollRef.current as any)
      pollRef.current = setInterval(async () => {
        const s = await fetchStatus()
        const done = s && (s.status === 'succeeded' || s.steps?.every(st => st.status === 'succeeded'))
        if (done && s) {
          clearInterval(pollRef.current as any)
          if (!docsReady) await generateDocuments(s)
        }
      }, 2000) as any
    })()
    return () => { if (pollRef.current) clearInterval(pollRef.current as any) }
  }, [projectId, start, fetchStatus, docsReady, generateDocuments])

  const getSignedUrl = useCallback(async (path: string, expiresIn = 3600) => {
    const { data, error } = await supabase.storage.from('generated-assets').createSignedUrl(path, expiresIn)
    if (error) throw error
    return data.signedUrl
  }, [supabase])

  const retry = useCallback(async () => {
    await start()
  }, [start])

  return { state, loading, error, start, retry, getSignedUrl }
}

