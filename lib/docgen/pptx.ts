import PptxGenJS from 'pptxgenjs'
import type { DocumentPrep } from '@/lib/ai/pipeline'
import { indianBrand, splitText } from './templates'

export type PptxOptions = { brand?: ReturnType<typeof indianBrand> }

export async function generatePitchDeckPPTX(prep: DocumentPrep, opts: PptxOptions = {}) {
  const brand = indianBrand(opts.brand)
  const pptx = new PptxGenJS()
  pptx.author = 'Manthan'
  pptx.company = 'Manthan'
  pptx.revision = '1'
  const master = 'INDIA'
  pptx.defineSlideMaster({ title: master, background: { fill: brand.secondary }, objects: [ { text: { text: 'Manthan', options: { x:0.3, y:0.1, fontSize:14, color: '000000' } } } ] })

  // Cover
  let slide = pptx.addSlide({ masterName: master })
  slide.addText('Pitch Deck', { x:0.5, y:1.0, fontSize:36, color:'000000', bold:true })
  slide.addText(prep.merged?.core?.logline || '—', { x:0.5, y:2.0, w:9.0, fontSize:18, color:'000000' })
  slide.addNotes('Indian M&E pitch deck (auto-generated).')

  // Synopsis
  slide = pptx.addSlide({ masterName: master })
  slide.addText('Synopsis', { x:0.5, y:0.6, fontSize:28, color: '000000', bold:true })
  splitText(prep.merged?.core?.synopsis || '', 90).forEach((t, i) => slide.addText(t, { x:0.5, y:1.2 + i*0.35, w:9.0, fontSize:14 }))

  // Characters
  slide = pptx.addSlide({ masterName: master })
  slide.addText('Characters', { x:0.5, y:0.6, fontSize:28, bold:true })
  const chars = Object.entries(prep.merged?.bible?.characters || {})
  let y = 1.2
  for (const [name, c] of chars) {
    slide.addText(String(name), { x:0.5, y, fontSize:16, bold:true }); y += 0.3
    slide.addText(String((c as any)?.motivation || ''), { x:0.5, y, w:9.0, fontSize:12 }); y += 0.5
    if (y > 6.5) { slide = pptx.addSlide({ masterName: master }); y = 0.8 }
  }

  // Outline
  slide = pptx.addSlide({ masterName: master })
  slide.addText('Series Outline', { x:0.5, y:0.6, fontSize:28, bold:true })
  const outline = prep.merged?.market?.outline || []
  y = 1.2
  for (const ep of outline) {
    slide.addText(`Ep ${ep.episode}: ${ep.title}`, { x:0.5, y, fontSize:14, bold:true }); y += 0.3
    splitText(ep.summary || '', 90).forEach((t) => { slide.addText(t, { x:0.5, y, w:9.0, fontSize:12 }); y += 0.3 })
    y += 0.2
    if (y > 6.5) { slide = pptx.addSlide({ masterName: master }); y = 0.8 }
  }

  const b = (await pptx.write('arraybuffer')) as ArrayBuffer
  return b
}

