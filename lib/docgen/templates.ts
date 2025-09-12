export type Brand = { primary: string; secondary: string; accent: string; text: string }

export function indianBrand(override?: Partial<Brand>): Brand {
  return {
    primary: '#FF6B35', // saffron
    secondary: '#FFD700', // gold
    accent: '#1E3A8A', // royal blue
    text: '#1F2937',
    ...override,
  }
}

export function splitText(text: string, max = 90): string[] {
  const words = (text || '').split(/\s+/)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w }
    else line += ' ' + w
  }
  if (line.trim()) out.push(line.trim())
  return out
}

