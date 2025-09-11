import { randomUUID } from 'crypto'
import type { ScriptJSON, Scene } from './types'

const SCENE_HEADING_REGEX = /^(?:(INT|EXT|I\/E|INT\.\/EXT)\.?)([^\n]*)$/i
const TRANSITION_REGEX = /(CUT TO:|FADE (IN|OUT):|SMASH CUT:|MATCH CUT:|DISSOLVE TO:|BACK TO:)/i

function isAllCaps(line: string) {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (!letters) return false
  return letters === letters.toUpperCase()
}

function isCharacterCue(line: string) {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > 40) return false
  if (SCENE_HEADING_REGEX.test(trimmed)) return false
  if (TRANSITION_REGEX.test(trimmed)) return false
  return isAllCaps(trimmed)
}

export function parseScreenplayText(text: string): ScriptJSON {
  const lines = text.split(/\r?\n/)
  const scenes: Scene[] = []
  const charactersSet = new Set<string>()
  const warnings: string[] = []

  let currentScene: Scene | null = null
  let i = 0
  while (i < lines.length) {
    let line = lines[i].replace(/\t/g, '  ')
    const raw = line
    line = line.trimEnd()

    // Scene headings (including variants)
    if (SCENE_HEADING_REGEX.test(line) || /^scene\s+\d+[:\-]?/i.test(line) || /^[\[\(]?(Scene|दृश्य)/i.test(line)) {
      if (currentScene) scenes.push(currentScene)
      currentScene = { id: randomUUID(), heading: line, action: [], dialogues: [], transitions: [] }
      i++; continue
    }

    // Transitions
    if (TRANSITION_REGEX.test(line)) {
      if (!currentScene) {
        currentScene = { id: randomUUID(), heading: 'UNTITLED SCENE', action: [], dialogues: [], transitions: [] }
      }
      currentScene.transitions!.push(line.trim())
      i++; continue
    }

    // Character + dialogue block
    if (isCharacterCue(line)) {
      const character = line.trim()
      charactersSet.add(character)
      i++
      const dialogueLines: string[] = []
      while (i < lines.length) {
        const d = lines[i].trimEnd()
        if (d.trim() === '') break
        // Stop at next character cue or scene heading
        if (isCharacterCue(d) || SCENE_HEADING_REGEX.test(d)) break
        dialogueLines.push(d)
        i++
      }
      if (!currentScene) currentScene = { id: randomUUID(), heading: 'UNTITLED SCENE', action: [], dialogues: [], transitions: [] }
      currentScene.dialogues.push({ character, lines: dialogueLines })
      continue
    }

    // Action
    if (line.trim() !== '') {
      if (!currentScene) currentScene = { id: randomUUID(), heading: 'UNTITLED SCENE', action: [], dialogues: [], transitions: [] }
      currentScene.action.push(raw.trim())
    }
    i++
  }
  if (currentScene) scenes.push(currentScene)

  const characters = Array.from(charactersSet).map((name) => ({ name }))

  // Title/author heuristic from first lines
  let title: string | undefined
  let authors: string[] | undefined
  for (let j = 0; j < Math.min(25, lines.length); j++) {
    const l = lines[j].trim()
    if (!title && l.length >= 3 && l.length < 80 && !SCENE_HEADING_REGEX.test(l)) title = l
    if (/^by\s+(.+)/i.test(l)) {
      const m = l.match(/^by\s+(.+)/i)
      if (m) authors = [m[1]]
    }
  }

  return { title, authors, scenes, characters, warnings }
}

