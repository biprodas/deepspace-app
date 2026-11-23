import { describe, expect, it } from 'vitest'
import { layoutMindMap, parseMindMap, pastel, type LaidOutShape, type MindMap } from './mindmap'

const source =
  'Photosynthesis turns light into chemical energy. It happens in chloroplasts. Water is split, releasing oxygen.'

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
    const reply = JSON.stringify({
      ...map,
      branches: [{ label: 'A', quote: 'Invented sentence.', children: [] }, map.branches[1]],
    })
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

describe('parseMindMap clean-up', () => {
  it('drops children that repeat their branch or each other, repeated branches, and full stops', () => {
    const reply = JSON.stringify({
      root: 'Cells',
      branches: [
        { label: 'Organelles.', children: ['Nucleus', 'nucleus', 'Organelles', 'Ribosomes.'] },
        { label: 'organelles', children: ['Duplicate branch'] },
        { label: 'Membrane', children: [] },
      ],
    })
    const parsed = parseMindMap(reply, source)
    expect(parsed.branches.map((b) => b.label)).toEqual(['Organelles', 'Membrane'])
    expect(parsed.branches[0].children).toEqual(['Nucleus', 'Ribosomes'])
  })
})

describe('layoutMindMap', () => {
  const shapes = layoutMindMap(map, 0, 0)
  const cards = shapes.filter((s) => s.type === 'text')
  const links = shapes.filter((s) => s.type === 'connector')

  it('makes one card per label and one connector per edge, connectors first', () => {
    expect(cards).toHaveLength(1 + 3 + 4)
    expect(links).toHaveLength(3 + 4)
    expect(shapes.findIndex((s) => s.type === 'text')).toBe(links.length)
  })

  it('centres the root, with the first half of the branches right of it and the rest left', () => {
    const [root, where, , inputs] = cards
    expect(root.props.text).toBe('Photosynthesis')
    expect(root.x + root.width / 2).toBeCloseTo(0)
    expect(root.y + root.height / 2).toBeCloseTo(0)
    expect(where.props.text).toBe('Where')
    expect(where.x).toBeGreaterThan(root.x + root.width)
    // Two of three branches go right (Where, Inputs); Outputs goes left.
    expect(inputs.props.text).toBe('Inputs')
    expect(inputs.x).toBeGreaterThan(0)
    const outputs = cards.find((c) => c.props.text === 'Outputs')!
    expect(outputs.x + outputs.width).toBeLessThan(root.x)
  })

  it('links run from the root’s edge to each branch’s edge', () => {
    const root = cards[0]
    const where = cards[1]
    expect(links[0]).toMatchObject({ x: root.x + root.width, y: 0 })
    expect(links[0].x + links[0].width).toBeCloseTo(where.x)
  })

  it('never overlaps cards, even with a full map of long labels', () => {
    const big: MindMap = {
      root: 'The French Revolution and its legacy',
      branches: Array.from({ length: 6 }, (_, i) => ({
        label: `Causes and consequences part ${i + 1}`,
        children: Array.from({ length: 4 }, (_, j) => `Very specific detail number ${j + 1} of branch ${i + 1}`),
      })),
    }
    const all = layoutMindMap(big, 600, 420).filter((s) => s.type === 'text')
    const overlap = (a: LaidOutShape, b: LaidOutShape) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        expect(overlap(all[i], all[j]), `${all[i].props.text} / ${all[j].props.text}`).toBe(false)
    // Long labels wrap instead of making very wide cards.
    expect(Math.max(...all.map((c) => c.width))).toBeLessThanOrEqual(260)
  })

  it('mixes colours toward white', () => {
    expect(pastel('#000000', 0.5)).toBe('#808080')
    expect(pastel('#2563eb', 0)).toBe('#2563eb')
    expect(pastel('#2563eb', 1)).toBe('#ffffff')
  })
})
