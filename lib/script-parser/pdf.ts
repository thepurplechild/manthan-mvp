import pdfParse from 'pdf-parse'
import type { ScriptJSON } from './types'
import { parseScreenplayText } from './text'

async function tryOCR(buffer: Buffer): Promise<string | null> {
  if (process.env.ENABLE_OCR !== '1') return null
  try {
    // Dynamic import to avoid bundling if not enabled
    const { createWorker } = await import('tesseract.js') as any
    const worker = await createWorker()
    await worker.loadLanguage('eng')
    await worker.initialize('eng')
    // Note: OCR on PDFs requires rasterization; this is a placeholder that will likely fail without conversion.
    // In production, convert PDF pages to images (e.g., using pdf-poppler) then run OCR per image.
    const { data } = await worker.recognize(buffer)
    await worker.terminate()
    return data?.text || null
  } catch {
    return null
  }
}

export async function parsePdfToScriptJSON(buffer: Buffer): Promise<{ json: ScriptJSON; rawText: string; warnings: string[] }> {
  const warnings: string[] = []
  const parsed = await pdfParse(buffer).catch((e: any) => { warnings.push(`pdf-parse error: ${e?.message||e}`); return { text: '' } as any })
  let text = parsed?.text || ''
  if (!text || text.trim().length < 50) {
    warnings.push('PDF appears to contain little or no text. Attempting OCR (if enabled).')
    const ocr = await tryOCR(buffer)
    if (ocr && ocr.trim().length > 50) text = ocr
  }
  if (!text || text.trim().length < 10) warnings.push('Unable to extract text from PDF. Consider uploading DOCX/TXT or enabling OCR with page rasterization.')
  const json = parseScreenplayText(text)
  json.warnings = [...(json.warnings||[]), ...warnings]
  return { json, rawText: text, warnings }
}

