"use client";

import { toast } from "@/components/Toaster";

export default function ProjectActions({ id }: { id: string }) {
  const del = async () => {
    if (!confirm('Delete this project?')) return;
    const r = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (r.ok) { toast('success','Deleted'); window.location.href = '/projects'; }
    else { toast('error', (await r.json()).error || 'Delete failed') }
  }
  const share = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast('success','Link copied')
  }
  return (
    <div className="flex gap-2">
      <a href={`/projects/new?clone=${id}`} className="btn-royal">Edit</a>
      <button onClick={share} className="btn-outline-indian">Share</button>
      <button onClick={del} className="btn-outline-indian">Delete</button>
    </div>
  )
}

