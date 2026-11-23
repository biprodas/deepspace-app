/**
 * Turning AI output into note content (Tiptap JSON), and finding a quoted
 * passage in a note. Pure, so it's unit-tested; the note page applies the
 * results through the editor, which syncs them to everyone in the note.
 */

import type { NoteDraft } from './note-ai'

/** Tiptap JSON: just the shapes these builders produce. */
export interface JsonNode {
  type: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
  content?: JsonNode[]
}

/** Text with **bold** runs, as inline nodes. */
export function inline(text: string): JsonNode[] {
  const nodes: JsonNode[] = []
  text.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (!part) return
    const bold = /^\*\*([^*]+)\*\*$/.exec(part)
    if (bold) nodes.push({ type: 'text', text: bold[1], marks: [{ type: 'bold' }] })
    else nodes.push({ type: 'text', text: part })
  })
  return nodes
}

const paragraph = (content: JsonNode[]): JsonNode => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' })
const heading = (level: number, text: string): JsonNode => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const bullets = (items: JsonNode[][]): JsonNode => ({
  type: 'bulletList',
  content: items.map((c) => ({ type: 'listItem', content: [paragraph(c)] })),
})

export function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

/**
 * A drafted note as content: the article's title, the summary, one heading
 * and bullet list per section, key terms, and a link to the source.
 */
export function draftToContent(draft: NoteDraft, sourceTitle: string): JsonNode[] {
  const out: JsonNode[] = [heading(2, sourceTitle)]
  if (draft.summary) out.push(paragraph(inline(draft.summary)))
  for (const section of draft.sections) {
    out.push(heading(3, section.heading), bullets(section.points.map(inline)))
  }
  if (draft.keyTerms.length) {
    out.push(
      heading(3, 'Key terms'),
      bullets(draft.keyTerms.map((t) => [{ type: 'text', text: t.term, marks: [{ type: 'bold' }] }, { type: 'text', text: ` — ${t.meaning}` }])),
    )
  }
  out.push(
    paragraph([
      { type: 'text', text: 'Source: ' },
      {
        type: 'text',
        text: `Wikipedia · ${sourceTitle}`,
        marks: [{ type: 'link', attrs: { href: wikipediaUrl(sourceTitle) } }],
      },
    ]),
  )
  return out
}

/** A suggested addition as content: "- " lines become a bullet list, other lines paragraphs. */
export function insertToContent(text: string): JsonNode[] {
  const out: JsonNode[] = []
  let items: JsonNode[][] = []
  const flush = () => {
    if (items.length) out.push(bullets(items))
    items = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const item = /^[-•*]\s+(.*)$/.exec(line)
    if (item) items.push(inline(item[1]))
    else {
      flush()
      out.push(paragraph(inline(line)))
    }
  }
  flush()
  return out
}

/** A text block of the note: its position in the document and its text. */
export interface TextBlock {
  pos: number
  size: number
  text: string
}

/**
 * Where a quote sits in the note: the document range to select, and the end
 * of its block (to add text after it). Matches ignoring case and spacing
 * differences; null when the note no longer contains it.
 */
export function findQuote(blocks: TextBlock[], quote: string): { from: number; to: number; blockEnd: number } | null {
  const want = quote.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!want) return null
  for (const block of blocks) {
    // Map each character of the spacing-collapsed text back to its offset in the block.
    let flat = ''
    const offsets: number[] = []
    let lastSpace = false
    for (let i = 0; i < block.text.length; i++) {
      const ch = block.text[i]
      const space = /\s/.test(ch)
      if (space && lastSpace) continue
      flat += space ? ' ' : ch.toLowerCase()
      offsets.push(i)
      lastSpace = space
    }
    const at = flat.indexOf(want)
    if (at === -1) continue
    const start = offsets[at]
    const end = offsets[at + want.length - 1] + 1
    // +1: a text block's content starts one position after the block itself.
    return { from: block.pos + 1 + start, to: block.pos + 1 + end, blockEnd: block.pos + block.size }
  }
  return null
}
