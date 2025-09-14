'use client'

import { useEffect, useState } from 'react'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [ingestionId, setIngestionId] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (ingestionId) {
      // Poll ingestion status every 2s
      timer = setInterval(async () => {
        const r = await fetch(`/api/ingestions/status?id=${ingestionId}`)
        if (r.ok) {
          const j = await r.json()
          setProgress(j.progress)
          setStatus(j.status)
          if (j.status === 'succeeded' || j.status === 'failed') clearInterval(timer)
        }
      }, 2000)
    }
    return () => timer && clearInterval(timer)
  }, [ingestionId])

  const upload = async () => {
    setError(null)
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/uploads', { method: 'POST', body: fd })
    const j = await r.json()
    if (!r.ok) { setError(j.error || 'Upload failed'); return }
    setIngestionId(j.ingestion_id)
    setStatus('queued')
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Upload Script</h1>
      <input type="file" accept=".pdf,.txt,.docx" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button className="ml-3 px-4 py-2 bg-purple-600 text-white rounded" disabled={!file} onClick={upload}>Upload</button>
      {error && <p className="text-red-600 mt-3">{error}</p>}
      {ingestionId && (
        <div className="mt-6">
          <p className="text-sm text-gray-300">Ingestion: {ingestionId}</p>
          <div className="w-full bg-gray-700 h-2 rounded">
            <div className="h-2 bg-purple-500 rounded" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm mt-2">Status: {status} • {progress}%</p>
        </div>
      )}
    </div>
  )
}
