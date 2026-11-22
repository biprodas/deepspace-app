/**
 * Appending to a shared note from outside the editor (docs/features.md F14,
 * "Add to notes" on a reveal). Notes are Tiptap documents stored as a Yjs
 * XML fragment named 'default' (src/components/notes/editor/useDocEditor.ts);
 * these blocks use the same node names Tiptap's StarterKit does, so they
 * show up as ordinary headings and paragraphs for everyone editing.
 */

import * as Y from 'yjs'
import type { Question, Round } from '../schemas/game-types'

export const NOTE_FRAGMENT = 'default'

export type NoteBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string; bold?: boolean }
  | { type: 'blockquote'; text: string }

function textNode(text: string, bold?: boolean): Y.XmlText {
  const t = new Y.XmlText()
  t.insert(0, text, bold ? { bold: {} } : undefined)
  return t
}

function toXml(block: NoteBlock): Y.XmlElement {
  if (block.type === 'heading') {
    const el = new Y.XmlElement('heading')
    el.setAttribute('level', block.level as unknown as string)
    el.insert(0, [textNode(block.text)])
    return el
  }
  if (block.type === 'blockquote') {
    const quote = new Y.XmlElement('blockquote')
    const p = new Y.XmlElement('paragraph')
    p.insert(0, [textNode(block.text)])
    quote.insert(0, [p])
    return quote
  }
  const p = new Y.XmlElement('paragraph')
  p.insert(0, [textNode(block.text, block.bold)])
  return p
}

/** Appends blocks to the end of the note in one transaction (one undo step, one sync). */
export function appendToNote(doc: Y.Doc, blocks: NoteBlock[]): void {
  const fragment = doc.getXmlFragment(NOTE_FRAGMENT)
  doc.transact(() => fragment.push(blocks.map(toXml)))
}

/** A revealed question as note blocks: the question, the answer, why, and the source line. */
export function revealBlocks(question: Pick<Question, 'prompt' | 'options'>, round: Pick<Round, 'roundNumber' | 'correctIndex' | 'explanation' | 'sourceQuote' | 'sourceUrl'>): NoteBlock[] {
  const blocks: NoteBlock[] = [{ type: 'heading', level: 3, text: `Q${round.roundNumber}. ${question.prompt}` }]
  const answer = round.correctIndex !== undefined ? question.options[round.correctIndex] : undefined
  if (answer) blocks.push({ type: 'paragraph', text: `Answer: ${answer}`, bold: true })
  if (round.explanation) blocks.push({ type: 'paragraph', text: round.explanation })
  if (round.sourceQuote) {
    blocks.push({ type: 'blockquote', text: round.sourceUrl ? `${round.sourceQuote} (${round.sourceUrl})` : round.sourceQuote })
  }
  return blocks
}
