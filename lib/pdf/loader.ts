// lib/pdf/loader.ts

// Minimal, local typings to avoid `any` while staying framework-agnostic.
type GetDocumentParams =
  | { data?: Uint8Array | ArrayBuffer; url?: string; isEvalSupported?: boolean; useSystemFonts?: boolean }
  | Uint8Array
  | ArrayBuffer
  | string;

type LoadingTask<T = PDFDocumentProxy> = { promise: Promise<T> };

type PDFPageProxy = unknown; // refine if you need page typing

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

/**
 * Dynamically load pdfjs-dist in a way that is safe for SSR and the Next.js bundler.
 * - On the client, set GlobalWorkerOptions.workerSrc to the emitted worker URL.
 * - On the server, clear workerSrc.
 */
export async function loadPdfjs(): Promise<PdfJsLike> {
  if (cachedLib) return cachedLib;

  // Some bundlers default-export the lib, others export as namespace.
  const mod: unknown = await import("pdfjs-dist/build/pdf.min.js");
  const maybe = mod as { default?: PdfJsLike } & Partial<PdfJsLike>;
  const lib: PdfJsLike = (maybe.default ?? (maybe as PdfJsLike));

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  if (isBrowser) {
    // Importing the worker returns a URL string thanks to next.config asset/resource rule.
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.js")).default as string;
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
  } else {
    lib.GlobalWorkerOptions.workerSrc = "";
  }

  cachedLib = lib;
  return lib;
}

/**
 * Example helper (optional): extract text/pages quickly.
 * Keep if you call it elsewhere; otherwise remove to keep file minimal.
 */
export async function openPdfFromBuffer(data: Uint8Array | ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false });
  const doc = await task.promise;
  return doc;
}