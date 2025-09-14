// Thin wrapper to load pdfjs-dist safely in Next (SSR + client)
type PDFJS = {
  GlobalWorkerOptions?: { workerSrc?: string }
  getDocument: (opts: { data: Buffer | Uint8Array | ArrayBuffer; isEvalSupported?: boolean; useSystemFonts?: boolean }) => { promise: Promise<any> }
  setPDFNetworkStreamFactory?: (x: unknown) => void
}

let _pdfjs: PDFJS | null = null

export async function loadPdfjs(): Promise<PDFJS> {
  if (_pdfjs) return _pdfjs
  const pdfjs = (await import('pdfjs-dist/build/pdf.min.mjs')) as unknown as PDFJS
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
  if (isBrowser) {
    try {
      const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs')).default as string
      pdfjs.GlobalWorkerOptions && (pdfjs.GlobalWorkerOptions.workerSrc = workerSrc)
    } catch {
      pdfjs.GlobalWorkerOptions && (pdfjs.GlobalWorkerOptions.workerSrc = '')
    }
  } else {
    pdfjs.GlobalWorkerOptions && (pdfjs.GlobalWorkerOptions.workerSrc = '')
    try { pdfjs.setPDFNetworkStreamFactory?.(null) } catch {}
  }
  _pdfjs = pdfjs
  return pdfjs
}

