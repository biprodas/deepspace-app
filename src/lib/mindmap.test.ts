import { describe, expect, it } from 'vitest'
import { layoutMindMap, nodeWidth, parseMindMap, type MindMap } from './mindmap'

const source = 'Photosynthesis turns light into chemical energy. It happens in chloroplasts. Water is split, releasing oxygen.'

const map: MindMap = {
  root: 'Photosynthesis',
  branches: [
    { label: 'Where', quote: 'It happens in chloroplasts.', children: ['Chloroplasts'] },
    { label: 'Inputs', children: ['Light', 'Water', 'CO2'] },
    { label: 'Outputs', children: [] },
  ],
}

describe('parseMindMap', () => {
  it('reads JSON wrapped in prose and keeps quotes found in the source', () => {
    const reply = `Here you go:\n${JSON.stringify(map)}\nHope it helps.`
    const parsed = parseMindMap(reply, source)
    expect(parsed.root).toBe('Photosynthesis')
    expect(parsed.branches[0].quote).toBe('It happens in chloroplasts.')
  })

  it('drops a quote that is not in the source', () => {
    const reply = JSON.stringify({ ...map, branches: [{ label: 'A', quote: 'Invented sentence.', children: [] }, map.branches[1]] })
    expect(parseMindMap(reply, source).branches[0].quote).toBeUndefined()
  })

  it('fits small overruns to the limits instead of refusing', () => {
    const long = 'The light-dependent reactions in the thylakoid membranes'
    const reply = JSON.stringify({
      root: 'Photosynthesis',
      branches: Array.from({ length: 8 }, (_, i) => ({
        label: i === 0 ? long : `Branch ${i}`,
        quote: 'x'.repeat(300),
        children: ['a', 'b', 'c', 'd', 'e', 'f'],
      })),
    })
    const parsed = parseMindMap(reply, source)
    expect(parsed.branches).toHaveLength(6)
    expect(parsed.branches[0].label.length).toBeLessThanOrEqual(40)
    expect(parsed.branches[0].label.endsWith('…')).toBe(true)
    expect(parsed.branches[0].children).toHaveLength(4)
    expect(parsed.branches[0].quote).toBeUndefined()
  })

  it('refuses replies without a usable map', () => {
    expect(() => parseMindMap('no json here', source)).toThrow('didn’t return a mind map')
    expect(() => parseMindMap('{"root": "x"}', source)).toThrow('wrong shape')
    expect(() => parseMindMap('{"root": ', source)).toThrow('didn’t return a mind map')
  })
})

describe('layoutMindMap', () => {
  const shapes = layoutMindMap(map, 0, 0)
  const nodes = shapes.filter((s) => s.type === 'text')
  const lines = shapes.filter((s) => s.type === 'line')

  it('makes one node per label and one line per edge, lines first', () => {
    expect(nodes).toHaveLength(1 + 3 + 4)
    expect(lines).toHaveLength(3 + 4)
    expect(shapes.findIndex((s) => s.type === 'text')).toBe(lines.length)
  })

  it('centres the root and puts the first branch straight above it', () => {
    const root = nodes[0]
    expect(root.props.text).toBe('Photosynthesis')
    expect(root.x + root.width / 2).toBeCloseTo(0)
    expect(root.y + root.height / 2).toBeCloseTo(0)
    const first = nodes[1]
    expect(first.props.text).toBe('Where')
    expect(first.x + first.width / 2).toBeCloseTo(0)
    expect(first.y + first.height / 2).toBeLessThan(0)
  })

  it('starts each line at its parent node centre', () => {
    expect(lines[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('keeps node widths within bounds', () => {
    expect(nodeWidth('A')).toBe(90)
    expect(nodeWidth('x'.repeat(200))).toBe(340)
  })
})
