// lib/pdf/loader.ts

// ---- Minimal typings (no `any`) ----
type GetDocumentParams =
  | { data?: Uint8Array | ArrayBuffer; url?: string; isEvalSupported?: boolean; useSystemFonts?: boolean }
  | Uint8Array
  | ArrayBuffer
  | string;

type LoadingTask<T = PDFDocumentProxy> = { promise: Promise<T> };

type PDFPageProxy = unknown;

type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy: () => Promise<void> | void;
};

interface PdfJsLike {
  getDocument: (src: GetDocumentParams) => LoadingTask;
  GlobalWorkerOptions: { workerSrc: string };
}

let cachedLib: PdfJsLike | null = null;

// Try several entrypoints across pdfjs-dist versions & builds.
async function importPdfJs(): Promise<PdfJsLike> {
  // 1) Root entry (preferred in newer versions)
  try {
    const m = (await import("pdfjs-dist")) as unknown as { default?: PdfJsLike } & Partial<PdfJsLike>;
    const lib = m.default ?? (m as PdfJsLike);
    if (lib && typeof lib.getDocument === 'function' && lib.GlobalWorkerOptions !== undefined) {
      return lib;
    }
  } catch (_) {
    // Continue to next attempt
  }
  
  // 2) Build .mjs
  try {
    const m = (await import("pdfjs-dist/build/pdf.mjs")) as unknown as { default?: PdfJsLike } & Partial<PdfJsLike>;
    const lib = m.default ?? (m as PdfJsLike);
    if (lib && typeof lib.getDocument === 'function' && lib.GlobalWorkerOptions !== undefined) {
      return lib;
    }
  } catch (_) {
    // Continue to next attempt
  }
  
  // 3) Build non-min .js (final attempt)
  try {
    const m = (await import("pdfjs-dist/build/pdf.js")) as unknown as { default?: PdfJsLike } & Partial<PdfJsLike>;
    const lib = m.default ?? (m as PdfJsLike);
    if (lib && typeof lib.getDocument === 'function' && lib.GlobalWorkerOptions !== undefined) {
      return lib;
    }
  } catch (_) {
    // Final fallback failed
  }
  
  throw new Error('Unable to load PDF.js from any known entry point');
}

async function resolveWorkerUrl(): Promise<string> {
  // Try min .js → .js → min .mjs → .mjs
  try {
    return (await import("pdfjs-dist/build/pdf.worker.min.js")).default as string;
  } catch (_) {
    try {
      return (await import("pdfjs-dist/build/pdf.worker.js")).default as string;
    } catch (_) {
      try {
        return (await import("pdfjs-dist/build/pdf.worker.min.mjs")).default as string;
      } catch (_) {
        return (await import("pdfjs-dist/build/pdf.worker.mjs")).default as string;
      }
    }
  }
}

/**
 * Dynamically load pdfjs in a way that is safe for SSR/Next.js.
 * - Client: set GlobalWorkerOptions.workerSrc to emitted asset URL.
 * - Server: clear workerSrc.
 */
export async function loadPdfjs(): Promise<PdfJsLike> {
  if (cachedLib) return cachedLib;

  const lib = await importPdfJs();
  
  // Add null checks to prevent "Cannot read properties of undefined" errors
  if (!lib) {
    throw new Error('Failed to load PDF.js library');
  }
  
  if (!lib.GlobalWorkerOptions) {
    throw new Error('PDF.js GlobalWorkerOptions not available');
  }
  
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  if (isBrowser) {
    try {
      const workerUrl = await resolveWorkerUrl();
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
    } catch (error) {
      console.warn('Failed to resolve PDF worker URL:', error);
      lib.GlobalWorkerOptions.workerSrc = "";
    }
  } else {
    lib.GlobalWorkerOptions.workerSrc = "";
  }

  cachedLib = lib;
  return lib;
}

// Optional helper
export async function openPdfFromBuffer(data: Uint8Array | ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false });
  const doc = await task.promise;
  return doc;
}