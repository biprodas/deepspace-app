/**
 * Board shape geometry (docs/features.md F15), kept free of React so it can
 * be unit-tested: text wrapping, bounding boxes, pen strokes, arrowheads,
 * resizing and the stroke/fill styles the toolbar offers.
 *
 * Shapes are DeepSpace canvas shapes: `type`, a box (`x`, `y`, `width`,
 * `height`) and free-form `props`. Lines, arrows and connectors (the curved
 * links in a mind map) keep a *signed* box,
 * from their start point (x, y) to their end (x + width, y + height); every
 * other shape's box is normal (positive width and height).
 */

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow' | 'connector' | 'path' | 'text' | 'note'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** The shape fields geometry needs (a subset of DeepSpace's CanvasShapeClient). */
export interface ShapeLike extends Box {
  type: string
  props: Record<string, unknown>
}

export const STROKE_WIDTHS = [2, 4, 7] as const
export const DEFAULT_STROKE_WIDTH = 2
export const TEXT_FONT_SIZE = 16
/** Mind-map nodes were drawn at 14px before text shapes had a size. */
export const LEGACY_TEXT_FONT_SIZE = 14
export const NOTE_SIZE = { width: 200, height: 160 }
export const NOTE_PADDING = 14
export const TEXT_PADDING = 8
/** Average glyph width as a share of the font size (matches the mind-map layout's estimate). */
const CHAR_WIDTH = 0.56
export const LINE_HEIGHT = 1.35
/** Pen strokes keep at most this many points, so a long scribble stays a small record. */
export const MAX_PEN_POINTS = 1500

export const isSegment = (type: string) => type === 'line' || type === 'arrow' || type === 'connector'

/** SVG path for a connector: an S-curve leaving and arriving horizontally. */
export function connectorPath(shape: Box): string {
  const midX = shape.x + shape.width / 2
  return `M${shape.x} ${shape.y}C${midX} ${shape.y} ${midX} ${shape.y + shape.height} ${shape.x + shape.width} ${shape.y + shape.height}`
}

/** A colour from the palette at low opacity, for fills and sticky notes. */
export function tint(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}2e` : color
}

/** The normal (positive) box around a shape, for selection and hit tests. */
export function boundsOf(shape: Box): Box {
  return {
    x: Math.min(shape.x, shape.x + shape.width),
    y: Math.min(shape.y, shape.y + shape.height),
    width: Math.abs(shape.width),
    height: Math.abs(shape.height),
  }
}

/** The box spanned by two corner points. */
export function boxFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}

/** The box around several boxes (for fit-to-content and export), or null when there are none. */
export function unionBounds(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null
  const all = boxes.map(boundsOf)
  const x = Math.min(...all.map((b) => b.x))
  const y = Math.min(...all.map((b) => b.y))
  const right = Math.max(...all.map((b) => b.x + b.width))
  const bottom = Math.max(...all.map((b) => b.y + b.height))
  return { x, y, width: right - x, height: bottom - y }
}

export const BOARD_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

let measureContext: CanvasRenderingContext2D | null | undefined

/**
 * Text width at `fontSize` in the board's font. In the browser this measures
 * the real glyphs, so saved text wraps where it did while being typed;
 * elsewhere (unit tests) it estimates from an average glyph width.
 */
export function textWidth(text: string, fontSize: number, fontWeight = 400): number {
  if (measureContext === undefined) {
    measureContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  // Bold glyphs run about 6% wider than regular ones.
  if (!measureContext) return text.length * fontSize * CHAR_WIDTH * (fontWeight >= 600 ? 1.06 : 1)
  measureContext.font = `${fontWeight} ${fontSize}px ${BOARD_FONT}`
  return measureContext.measureText(text).width
}

/**
 * Word-wraps `text` to lines no wider than `maxWidth` at `fontSize`, keeping
 * the writer's own line breaks. A word longer than a line is split.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number, fontWeight = 400): string[] {
  const fits = (s: string) => textWidth(s, fontSize, fontWeight) <= maxWidth
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && fits(`${line} ${word}`)) {
        line += ` ${word}`
        continue
      }
      if (line) lines.push(line)
      // A word wider than a line breaks wherever it has to.
      while (word.length > 1 && !fits(word)) {
        let cut = word.length - 1
        while (cut > 1 && !fits(word.slice(0, cut))) cut--
        lines.push(word.slice(0, cut))
        word = word.slice(cut)
      }
      line = word
    }
    lines.push(line)
  }
  return lines
}

export const fontSizeOf = (shape: ShapeLike) =>
  typeof shape.props.fontSize === 'number' ? shape.props.fontSize : LEGACY_TEXT_FONT_SIZE

export const fontWeightOf = (shape: ShapeLike) =>
  typeof shape.props.fontWeight === 'number' ? shape.props.fontWeight : 400

/** Inner padding of a text box or note (mind-map nodes set their own). */
export const paddingOf = (shape: ShapeLike) =>
  typeof shape.props.padding === 'number' ? shape.props.padding : shape.type === 'note' ? NOTE_PADDING : TEXT_PADDING

/** Height a text box or note needs to show all its text at its width. */
export function textHeight(shape: ShapeLike): number {
  const fontSize = fontSizeOf(shape)
  const padding = paddingOf(shape)
  const lines = wrapText(
    String(shape.props.text ?? ''),
    shape.width - padding * 2,
    fontSize,
    fontWeightOf(shape),
  ).length
  return Math.ceil(lines * fontSize * LINE_HEIGHT + padding * 2)
}

// ─── Pen strokes ─────────────────────────────────────────

/**
 * Turns the canvas points of a pen stroke into a `path` shape: the box
 * around them, points relative to that box (rounded, thinned to
 * MAX_PEN_POINTS), and the box size they were drawn at (w0/h0), so a resized
 * stroke scales instead of being redrawn.
 */
export function penShape(points: { x: number; y: number }[], stroke: string, strokeWidth: number) {
  const step = Math.ceil(points.length / MAX_PEN_POINTS)
  const kept = points.filter((_, i) => i % step === 0 || i === points.length - 1)
  const box = unionBounds(kept.map((p) => ({ ...p, width: 0, height: 0 })))!
  const width = Math.max(box.width, 1)
  const height = Math.max(box.height, 1)
  const flat = kept.flatMap((p) => [Math.round((p.x - box.x) * 10) / 10, Math.round((p.y - box.y) * 10) / 10])
  return {
    type: 'path' as const,
    x: box.x,
    y: box.y,
    width,
    height,
    props: { points: flat, w0: width, h0: height, stroke, strokeWidth, fill: 'transparent' },
  }
}

/** SVG path data for a pen stroke's relative points: smoothed through segment midpoints. */
export function penPathData(flat: number[]): string {
  if (flat.length < 2) return ''
  if (flat.length < 6) {
    const [x, y] = flat
    const [x2, y2] = flat.length >= 4 ? [flat[2], flat[3]] : [x + 0.01, y]
    return `M${x} ${y}L${x2} ${y2}`
  }
  let d = `M${flat[0]} ${flat[1]}`
  for (let i = 2; i < flat.length - 2; i += 2) {
    const mx = (flat[i] + flat[i + 2]) / 2
    const my = (flat[i + 1] + flat[i + 3]) / 2
    d += `Q${flat[i]} ${flat[i + 1]} ${mx} ${my}`
  }
  return `${d}L${flat[flat.length - 2]} ${flat[flat.length - 1]}`
}

// ─── Arrows ──────────────────────────────────────────────

/** The arrowhead's two barbs at a segment's end, as an SVG path. */
export function arrowHeadPath(shape: Box, strokeWidth: number): string {
  const ex = shape.x + shape.width
  const ey = shape.y + shape.height
  const length = Math.hypot(shape.width, shape.height)
  if (length === 0) return ''
  const size = Math.min(10 + strokeWidth * 2.5, length * 0.6)
  const angle = Math.atan2(shape.height, shape.width)
  const spread = Math.PI / 7
  const left = { x: ex - size * Math.cos(angle - spread), y: ey - size * Math.sin(angle - spread) }
  const right = { x: ex - size * Math.cos(angle + spread), y: ey - size * Math.sin(angle + spread) }
  return `M${left.x} ${left.y}L${ex} ${ey}L${right.x} ${right.y}`
}

// ─── Resizing ────────────────────────────────────────────

/** Handles on a selected shape: four corners for a box, two ends for a line or arrow. */
export type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'start' | 'end'

export function handlesFor(shape: ShapeLike): { handle: Handle; x: number; y: number }[] {
  if (isSegment(shape.type)) {
    return [
      { handle: 'start', x: shape.x, y: shape.y },
      { handle: 'end', x: shape.x + shape.width, y: shape.y + shape.height },
    ]
  }
  const b = boundsOf(shape)
  return [
    { handle: 'nw', x: b.x, y: b.y },
    { handle: 'ne', x: b.x + b.width, y: b.y },
    { handle: 'sw', x: b.x, y: b.y + b.height },
    { handle: 'se', x: b.x + b.width, y: b.y + b.height },
  ]
}

const MIN_SIZE = 8

/**
 * The shape's new box while a handle is dragged to `to`: a corner moves
 * against the opposite (fixed) corner; a line's end moves on its own.
 */
export function resizeBox(shape: ShapeLike, handle: Handle, to: { x: number; y: number }): Box {
  if (handle === 'start') {
    const end = { x: shape.x + shape.width, y: shape.y + shape.height }
    return { x: to.x, y: to.y, width: end.x - to.x, height: end.y - to.y }
  }
  if (handle === 'end') return { x: shape.x, y: shape.y, width: to.x - shape.x, height: to.y - shape.y }
  const b = boundsOf(shape)
  const anchor = {
    x: handle === 'nw' || handle === 'sw' ? b.x + b.width : b.x,
    y: handle === 'nw' || handle === 'ne' ? b.y + b.height : b.y,
  }
  const box = boxFromPoints(anchor, to)
  return { ...box, width: Math.max(box.width, MIN_SIZE), height: Math.max(box.height, MIN_SIZE) }
}
