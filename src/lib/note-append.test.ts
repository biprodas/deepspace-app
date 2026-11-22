import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { NOTE_FRAGMENT, appendToNote, revealBlocks } from './note-append'

const question = { prompt: 'What makes ATP?', options: ['Ribosome', 'Mitochondrion', 'Nucleus', 'Golgi'] }
const round = {
  roundNumber: 2,
  correctIndex: 1,
  explanation: 'Mitochondria run cellular respiration.',
  sourceQuote: 'The mitochondrion is the powerhouse of the cell.',
  sourceUrl: 'https://en.wikipedia.org/wiki/Mitochondrion',
}

describe('revealBlocks', () => {
  it('writes the question, answer, explanation and source', () => {
    expect(revealBlocks(question, round)).toEqual([
      { type: 'heading', level: 3, text: 'Q2. What makes ATP?' },
      { type: 'paragraph', text: 'Answer: Mitochondrion', bold: true },
      { type: 'paragraph', text: 'Mitochondria run cellular respiration.' },
      {
        type: 'blockquote',
        text: 'The mitochondrion is the powerhouse of the cell. (https://en.wikipedia.org/wiki/Mitochondrion)',
      },
    ])
  })

  it('skips what the round does not have', () => {
    expect(revealBlocks(question, { roundNumber: 1 })).toEqual([{ type: 'heading', level: 3, text: 'Q1. What makes ATP?' }])
  })
})

describe('appendToNote', () => {
  it('appends Tiptap nodes after existing content', () => {
    const doc = new Y.Doc()
    appendToNote(doc, [{ type: 'paragraph', text: 'first' }])
    appendToNote(doc, revealBlocks(question, round))
    const xml = doc.getXmlFragment(NOTE_FRAGMENT).toString()
    expect(xml.startsWith('<paragraph>first</paragraph><heading level="3">Q2. What makes ATP?</heading>')).toBe(true)
    expect(xml).toContain('<paragraph><bold>Answer: Mitochondrion</bold></paragraph>')
    expect(xml).toContain('<blockquote><paragraph>The mitochondrion')
  })
})
