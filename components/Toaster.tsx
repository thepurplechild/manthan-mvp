'use client'

import { useEffect, useState } from 'react'

type Toast = { id: number; type: 'success'|'error'|'info'; message: string }

export function toast(type: Toast['type'], message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('toast', { detail: { type, message } }))
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    const handler = (e: any) => {
      const id = Date.now()
      setToasts((t) => [...t, { id, type: e.detail.type, message: e.detail.message }])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
    }
    window.addEventListener('toast', handler as any)
    return () => window.removeEventListener('toast', handler as any)
  }, [])
  return (
    <div aria-live="polite" className="fixed z-[100] bottom-4 right-4 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-soft text-sm text-white ${t.type==='success'?'bg-green-600':t.type==='error'?'bg-red-600':'bg-slate-700'}`}>{t.message}</div>
      ))}
    </div>
  )
}

