import { describe, expect, it } from 'vitest'
import {
  arrowHeadPath,
  boundsOf,
  handlesFor,
  MAX_PEN_POINTS,
  penPathData,
  penShape,
  resizeBox,
  textHeight,
  tint,
  unionBounds,
  wrapText,
} from './canvas-shapes'

describe('wrapText', () => {
  it('wraps words to the width and keeps the writer’s line breaks', () => {
    // 16px × 0.56 ≈ 9px a glyph, so 100px holds 11 characters.
    expect(wrapText('the cell membrane is thin', 100, 16)).toEqual(['the cell', 'membrane is', 'thin'])
    expect(wrapText('one\ntwo', 400, 16)).toEqual(['one', 'two'])
    expect(wrapText('', 400, 16)).toEqual([''])
  })

  it('splits a word longer than a line', () => {
    expect(wrapText('abcdefghijklmnop', 50, 16)).toEqual(['abcde', 'fghij', 'klmno', 'p'])
  })
})

describe('textHeight', () => {
  it('grows with the number of wrapped lines', () => {
    const one = textHeight({ type: 'note', x: 0, y: 0, width: 200, height: 0, props: { text: 'short', fontSize: 16 } })
    const three = textHeight({
      type: 'note',
      x: 0,
      y: 0,
      width: 200,
      height: 0,
      props: { text: 'a\nb\nc', fontSize: 16 },
    })
    expect(three).toBeGreaterThan(one)
  })
})

describe('boxes', () => {
  it('normalises a line’s signed box', () => {
    expect(boundsOf({ x: 100, y: 50, width: -40, height: 30 })).toEqual({ x: 60, y: 50, width: 40, height: 30 })
  })

  it('unions boxes, and is null for none', () => {
    expect(
      unionBounds([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 50, y: -5, width: -20, height: 5 },
      ]),
    ).toEqual({ x: 0, y: -5, width: 50, height: 15 })
    expect(unionBounds([])).toBeNull()
  })
})

describe('penShape', () => {
  it('stores points relative to their box, with the size they were drawn at', () => {
    const shape = penShape(
      [
        { x: 110, y: 220 },
        { x: 130, y: 200 },
        { x: 150, y: 260 },
      ],
      '#ef4444',
      4,
    )
    expect(shape).toMatchObject({ type: 'path', x: 110, y: 200, width: 40, height: 60 })
    expect(shape.props).toMatchObject({ points: [0, 20, 20, 0, 40, 60], w0: 40, h0: 60, stroke: '#ef4444' })
  })

  it('thins very long strokes', () => {
    const points = Array.from({ length: MAX_PEN_POINTS * 3 }, (_, i) => ({ x: i, y: i % 7 }))
    expect(penShape(points, '#000000', 2).props.points.length / 2).toBeLessThanOrEqual(MAX_PEN_POINTS + 1)
  })

  it('draws a dot for a single click', () => {
    expect(penPathData([5, 5])).toMatch(/^M5 5L/)
  })
})

describe('arrowHeadPath', () => {
  it('puts the point at the segment’s end', () => {
    expect(arrowHeadPath({ x: 0, y: 0, width: 100, height: 0 }, 2)).toContain('L100 0L')
    expect(arrowHeadPath({ x: 0, y: 0, width: 0, height: 0 }, 2)).toBe('')
  })
})

describe('resizing', () => {
  const rect = { type: 'rect', x: 100, y: 100, width: 80, height: 40, props: {} }
  const line = { type: 'line', x: 0, y: 0, width: 100, height: 50, props: {} }

  it('offers corners for boxes and ends for lines', () => {
    expect(handlesFor(rect).map((h) => h.handle)).toEqual(['nw', 'ne', 'sw', 'se'])
    expect(handlesFor(line).map((h) => h.handle)).toEqual(['start', 'end'])
  })

  it('moves a corner against the opposite one, and flips past it', () => {
    expect(resizeBox(rect, 'se', { x: 300, y: 200 })).toEqual({ x: 100, y: 100, width: 200, height: 100 })
    expect(resizeBox(rect, 'se', { x: 50, y: 60 })).toEqual({ x: 50, y: 60, width: 50, height: 40 })
  })

  it('moves one end of a line and keeps the other', () => {
    expect(resizeBox(line, 'start', { x: 20, y: 30 })).toEqual({ x: 20, y: 30, width: 80, height: 20 })
    expect(resizeBox(line, 'end', { x: -10, y: 5 })).toEqual({ x: 0, y: 0, width: -10, height: 5 })
  })
})

describe('tint', () => {
  it('adds transparency to palette colours only', () => {
    expect(tint('#22c55e')).toBe('#22c55e2e')
    expect(tint('transparent')).toBe('transparent')
  })
})
