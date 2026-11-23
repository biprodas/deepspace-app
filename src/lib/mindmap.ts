/**
 * AI mind maps (docs/features.md F15): the prompt, reading Claude's reply,
 * and laying the tree out as whiteboard shapes. Pure, so it's unit-tested;
 * the server action (src/actions/board.ts) fetches the source and calls
 * Claude, and the board's creator draws the shapes once.
 */

import { z } from 'zod'
import { textHeight, textWidth } from './canvas-shapes'
import { normalizeForMatch } from './generation'

export const MINDMAP_MAX_BRANCHES = 6
export const MINDMAP_MAX_CHILDREN = 4
export const MINDMAP_LABEL_MAX = 40

const label = z.string().trim().min(1).max(MINDMAP_LABEL_MAX)

export const mindMapSchema = z.object({
  root: label,
  branches: z
    .array(
      z.object({
        label,
        /** A sentence from the source this branch is about; dropped if it isn't really there. */
        quote: z.string().trim().max(240).optional(),
        children: z.array(label).max(MINDMAP_MAX_CHILDREN).default([]),
      }),
    )
    .min(2)
    .max(MINDMAP_MAX_BRANCHES),
})

export type MindMap = z.infer<typeof mindMapSchema>

export function buildMindMapPrompt(topic: string, text: string): { system: string; user: string } {
  const system = [
    'You turn study material into a revision mind map that a student can read at a glance.',
    `Return only JSON: {"root": string, "branches": [{"label": string, "quote": string, "children": string[]}]}.`,
    'root: the topic itself, 1 to 3 words.',
    `branches: 4 to ${MINDMAP_MAX_BRANCHES} of the topic's main ideas, in a sensible study order,`,
    'with distinct, non-overlapping labels of 1 to 4 words in the same grammatical form (e.g. all nouns).',
    `children: 2 to ${MINDMAP_MAX_CHILDREN} per branch, each a specific fact, term, example or figure from the source,`,
    'in 2 to 6 words. A child adds information: never repeat the root or its branch label, and no two children say the same thing.',
    `Every label is at most ${MINDMAP_LABEL_MAX} characters, with no trailing full stop.`,
    'quote: one sentence copied exactly from the source that supports the branch.',
    'Use only what the source says.',
  ].join(' ')
  const user = `Topic: ${topic}\n\nSource:\n${text}`
  return { system, user }
}

/** Shortens to the label limit at a word boundary, with an ellipsis. */
export function clampLabel(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= MINDMAP_LABEL_MAX) return t
  const cut = t.slice(0, MINDMAP_LABEL_MAX - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > MINDMAP_LABEL_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`
}

/**
 * Fits a model reply to the limits instead of rejecting it for small
 * overruns: long labels are shortened, extra branches and children are
 * dropped, duplicates and full stops go, and over-long quotes are left out. What can't be fixed (no
 * root, fewer than two branches) still fails validation.
 */
function coerceMindMap(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as { root?: unknown; branches?: unknown }
  const asLabel = (v: unknown) =>
    typeof v === 'string' && v.trim() ? clampLabel(v.trim().replace(/\.$/, '')) : undefined
  const key = (label: string | undefined) => (label ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const branches = Array.isArray(r.branches) ? r.branches : []
  return {
    root: asLabel(r.root),
    branches: branches
      .map((b) => {
        const branch = (b ?? {}) as { label?: unknown; quote?: unknown; children?: unknown }
        const children = Array.isArray(branch.children) ? branch.children : []
        const label = asLabel(branch.label)
        // Children that repeat the branch, or each other, add nothing to the map.
        const seen = new Set([key(label)])
        const unique = children.map(asLabel).filter((c): c is string => {
          if (!c || seen.has(key(c))) return false
          seen.add(key(c))
          return true
        })
        return {
          label,
          quote: typeof branch.quote === 'string' && branch.quote.length <= 240 ? branch.quote : undefined,
          children: unique.slice(0, MINDMAP_MAX_CHILDREN),
        }
      })
      .filter((b, i, all) => b.label && all.findIndex((o) => key(o.label) === key(b.label)) === i)
      .slice(0, MINDMAP_MAX_BRANCHES),
  }
}

/** Reads the JSON from Claude's reply; drops quotes that aren't in the source. Throws a readable error. */
export function parseMindMap(reply: string, sourceText: string): MindMap {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Claude didn’t return a mind map')
  let raw: unknown
  try {
    raw = JSON.parse(reply.slice(start, end + 1))
  } catch {
    throw new Error('Claude returned a mind map that couldn’t be read')
  }
  const parsed = mindMapSchema.safeParse(coerceMindMap(raw))
  if (!parsed.success) throw new Error('Claude returned a mind map in the wrong shape')
  const source = normalizeForMatch(sourceText)
  return {
    root: parsed.data.root,
    branches: parsed.data.branches.map((b) => ({
      ...b,
      quote: b.quote && source.includes(normalizeForMatch(b.quote)) ? b.quote : undefined,
    })),
  }
}

// ─── Layout ──────────────────────────────────────────────

export interface LaidOutShape {
  type: 'text' | 'connector'
  x: number
  y: number
  width: number
  height: number
  props: Record<string, unknown>
}

const BRANCH_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2']
const INK = '#1e293b'

/** How each level of the map looks: font, card padding, widest card before the label wraps. */
const LEVELS = {
  root: { fontSize: 20, fontWeight: 700, padding: 16, maxWidth: 260, radius: 16 },
  branch: { fontSize: 15, fontWeight: 600, padding: 11, maxWidth: 210, radius: 12 },
  child: { fontSize: 14, fontWeight: 400, padding: 9, maxWidth: 230, radius: 10 },
} as const

/** Gaps: root to branches, branch to its children, between children, between branch blocks. */
const GAP = { root: 80, child: 56, childRow: 10, branchBlock: 30 }

/** `color` mixed toward white by `amount` (0–1), as an opaque hex. */
export function pastel(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** A card for `text`, sized to fit it: as wide as the label up to the level's limit, then wrapped. */
function card(text: string, level: keyof typeof LEVELS, style: Record<string, unknown>): LaidOutShape {
  const { fontSize, fontWeight, padding, maxWidth, radius } = LEVELS[level]
  const width = Math.min(maxWidth, Math.ceil(textWidth(text, fontSize, fontWeight)) + padding * 2 + 2)
  const shape: LaidOutShape = {
    type: 'text',
    x: 0,
    y: 0,
    width,
    height: 0,
    props: { text, fontSize, fontWeight, padding, radius, align: 'center', ...style },
  }
  shape.height = textHeight(shape)
  return shape
}

function connector(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: number): LaidOutShape {
  return {
    type: 'connector',
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    props: { stroke, strokeWidth, fill: 'transparent' },
  }
}

/**
 * A balanced left–right layout around (cx, cy), like a printed mind map:
 * the root in the middle, the first half of the branches on the right and
 * the rest on the left, each branch's children stacked beside it. Every
 * card is sized from its measured text and each branch gets a block as
 * tall as its children, so nothing overlaps however long the labels are.
 * Connectors run edge to edge and come first, so they draw under the cards.
 */
export function layoutMindMap(map: MindMap, cx = 600, cy = 420): LaidOutShape[] {
  const links: LaidOutShape[] = []
  const cards: LaidOutShape[] = []

  const root = card(map.root, 'root', { stroke: '#ffffff', fill: '#4338ca' })
  root.x = cx - root.width / 2
  root.y = cy - root.height / 2
  cards.push(root)

  const blocks = map.branches.map((branch, i) => {
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length]
    const node = card(branch.label, 'branch', { stroke: INK, fill: pastel(color, 0.78), border: color })
    const children = branch.children.map((c) =>
      card(c, 'child', { stroke: INK, fill: pastel(color, 0.92), border: pastel(color, 0.55) }),
    )
    const childrenHeight = children.reduce((h, c) => h + c.height, 0) + GAP.childRow * Math.max(0, children.length - 1)
    return { color, node, children, childrenHeight, height: Math.max(node.height, childrenHeight) }
  })

  const half = Math.ceil(blocks.length / 2)
  for (const [side, dir] of [
    [blocks.slice(0, half), 1],
    [blocks.slice(half), -1],
  ] as const) {
    const total = side.reduce((h, b) => h + b.height, 0) + GAP.branchBlock * Math.max(0, side.length - 1)
    let top = cy - total / 2
    for (const block of side) {
      const mid = top + block.height / 2
      const { node, children, color } = block
      // Branch: its near edge GAP.root beyond the root's side.
      const near = cx + dir * (root.width / 2 + GAP.root)
      node.x = dir > 0 ? near : near - node.width
      node.y = mid - node.height / 2
      links.push(connector(cx + (dir * root.width) / 2, cy, near, mid, color, 3))

      // Children: a column beyond the branch, centred on it.
      const far = dir > 0 ? node.x + node.width : node.x
      const childNear = far + dir * GAP.child
      let y = mid - block.childrenHeight / 2
      for (const child of children) {
        child.x = dir > 0 ? childNear : childNear - child.width
        child.y = y
        links.push(connector(far, mid, childNear, y + child.height / 2, color, 2))
        y += child.height + GAP.childRow
      }
      cards.push(node, ...children)
      top += block.height + GAP.branchBlock
    }
  }
  return [...links, ...cards]
}
