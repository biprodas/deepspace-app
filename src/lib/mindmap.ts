/**
 * AI mind maps (docs/features.md F15): the prompt, reading Claude's reply,
 * and laying the tree out as whiteboard shapes. Pure, so it's unit-tested;
 * the server action (src/actions/board.ts) fetches the source and calls
 * Claude, and the board's creator draws the shapes once.
 */

import { z } from 'zod'
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
    'You turn study material into a revision mind map.',
    `Return only JSON: {"root": string, "branches": [{"label": string, "quote": string, "children": string[]}]}.`,
    `root is the topic in a few words. 3 to ${MINDMAP_MAX_BRANCHES} branches for the main ideas,`,
    `each with up to ${MINDMAP_MAX_CHILDREN} children for key facts or terms.`,
    `Every label is at most ${MINDMAP_LABEL_MAX} characters: a short phrase, not a sentence.`,
    'quote is one sentence copied exactly from the source that supports the branch.',
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
 * dropped, and over-long quotes are left out. What can't be fixed (no
 * root, fewer than two branches) still fails validation.
 */
function coerceMindMap(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as { root?: unknown; branches?: unknown }
  const asLabel = (v: unknown) => (typeof v === 'string' && v.trim() ? clampLabel(v) : undefined)
  const branches = Array.isArray(r.branches) ? r.branches : []
  return {
    root: asLabel(r.root),
    branches: branches
      .map((b) => {
        const branch = (b ?? {}) as { label?: unknown; quote?: unknown; children?: unknown }
        const children = Array.isArray(branch.children) ? branch.children : []
        return {
          label: asLabel(branch.label),
          quote: typeof branch.quote === 'string' && branch.quote.length <= 240 ? branch.quote : undefined,
          children: children.map(asLabel).filter(Boolean).slice(0, MINDMAP_MAX_CHILDREN),
        }
      })
      .filter((b) => b.label)
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
  type: 'text' | 'line'
  x: number
  y: number
  width: number
  height: number
  props: Record<string, unknown>
}

const NODE_HEIGHT = 36
const BRANCH_RADIUS = 280
const CHILD_RADIUS = 190
/** Spread of a branch's children around its direction, in radians. */
const CHILD_SPREAD = 0.9
const BRANCH_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2']

/** Roughly fits the label at the canvas's 14px font. */
export const nodeWidth = (text: string) => Math.min(340, Math.max(90, Math.round(text.length * 7.8 + 28)))

function node(text: string, cx: number, cy: number, stroke: string, fill: string): LaidOutShape {
  const width = nodeWidth(text)
  return { type: 'text', x: cx - width / 2, y: cy - NODE_HEIGHT / 2, width, height: NODE_HEIGHT, props: { text, stroke, fill } }
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string): LaidOutShape {
  return { type: 'line', x: x1, y: y1, width: x2 - x1, height: y2 - y1, props: { stroke, strokeWidth: 2, fill: 'transparent' } }
}

/**
 * A radial layout around (cx, cy): the root in the middle, branches on a
 * circle, each branch's children fanned out beyond it. Lines come first so
 * they draw under the nodes.
 */
export function layoutMindMap(map: MindMap, cx = 600, cy = 420): LaidOutShape[] {
  const lines: LaidOutShape[] = []
  const nodes: LaidOutShape[] = [node(map.root, cx, cy, '#ffffff', '#4338ca')]
  const n = map.branches.length
  map.branches.forEach((branch, i) => {
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length]
    // Start at the top and go clockwise, so the first branch reads first.
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    const bx = cx + BRANCH_RADIUS * Math.cos(angle)
    const by = cy + BRANCH_RADIUS * Math.sin(angle)
    lines.push(line(cx, cy, bx, by, color))
    nodes.push(node(branch.label, bx, by, color, '#ffffff'))

    const k = branch.children.length
    branch.children.forEach((child, j) => {
      const offset = k === 1 ? 0 : -CHILD_SPREAD / 2 + (CHILD_SPREAD * j) / (k - 1)
      const ca = angle + offset
      const x = bx + CHILD_RADIUS * Math.cos(ca)
      const y = by + CHILD_RADIUS * Math.sin(ca)
      lines.push(line(bx, by, x, y, color))
      nodes.push(node(child, x, y, color, 'transparent'))
    })
  })
  return [...lines, ...nodes]
}
