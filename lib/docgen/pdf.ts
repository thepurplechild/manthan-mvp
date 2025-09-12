import jsPDF from 'jspdf'
import type { DocumentPrep } from '@/lib/ai/pipeline'
import { indianBrand, splitText } from './templates'

export type PdfOptions = { brand?: ReturnType<typeof indianBrand> }

export function generatePitchDeckPDF(prep: DocumentPrep, opts: PdfOptions = {}) {
  const brand = indianBrand(opts.brand)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  function header(title: string) {
    doc.setFillColor(brand.primary)
    doc.rect(0, 0, pageW, 60, 'F')
    doc.setTextColor('#ffffff')
    doc.setFontSize(18)
    doc.text(title, 40, 38)
    doc.setTextColor(brand.text)
  }

  // Cover page
  header('Pitch Deck')
  doc.setFontSize(28)
  doc.text(prep.merged?.core?.logline || 'Project Manthan', 40, 140, { maxWidth: pageW - 80 })
  doc.setFontSize(12)
  doc.text('Indian Media & Entertainment', 40, 170)

  doc.addPage()
  header('Synopsis')
  doc.setFontSize(12)
  splitText(prep.merged?.core?.synopsis || '—', 95).forEach((line, i) => doc.text(line, 40, 120 + i * 18))

  doc.addPage()
  header('Characters')
  const chars = Object.entries(prep.merged?.bible?.characters || {})
  let y = 120
  for (const [name, c] of chars) {
    doc.setFontSize(14)
    doc.text(name, 40, y)
    y += 16
    doc.setFontSize(11)
    splitText((c as any)?.motivation || '', 95).forEach((line) => { doc.text(line, 40, y); y += 14 })
    y += 10
    if (y > pageH - 100) { doc.addPage(); header('Characters (cont.)'); y = 120 }
  }

  doc.addPage()
  header('Series Outline')
  const outline = prep.merged?.market?.outline || []
  y = 120
  for (const ep of outline) {
    doc.setFontSize(13)
    doc.text(`Ep ${ep.episode}: ${ep.title}`, 40, y); y += 16
    doc.setFontSize(11)
    splitText(ep.summary || '', 95).forEach((line) => { doc.text(line, 40, y); y += 14 })
    y += 10
    if (y > pageH - 100) { doc.addPage(); header('Series Outline (cont.)'); y = 120 }
  }

  return doc.output('arraybuffer') as ArrayBuffer
}

export function generateExecutiveSummaryPDF(prep: DocumentPrep, opts: PdfOptions = {}) {
  const brand = indianBrand(opts.brand)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  function title(t: string, y: number) {
    doc.setFontSize(16); doc.setTextColor(brand.primary); doc.text(t, 40, y); doc.setTextColor('#000')
  }
  doc.setFontSize(22); doc.text('Executive Summary', 40, 80)
  title('Logline', 120); doc.setFontSize(11); splitText(prep.merged?.core?.logline||'—', 95).forEach((l,i)=>doc.text(l,40,140+i*14))
  title('Market Potential', 200); doc.setFontSize(11); doc.text('India OTT growth and genre trends (placeholder).',40,220,{maxWidth:pageW-80})
  title('Comparables', 260); doc.text('- Example Indian series/movie comps',40,280)
  title('Budget & Timeline', 320); doc.text('Budget estimate and milestones (placeholder).',40,340)
  return doc.output('arraybuffer') as ArrayBuffer
}

