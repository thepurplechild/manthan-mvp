"use client";

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function FocusOnPathChange() {
  const path = usePathname()
  useEffect(() => {
    const main = document.getElementById('main-content') as HTMLElement | null
    if (main) {
      main.focus()
    }
  }, [path])
  return null
}

