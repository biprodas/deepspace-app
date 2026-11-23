import { describe, expect, it } from 'vitest'
import { buildNoteReviewPrompt, MAX_SUGGESTIONS, parseNoteDraft, parseNoteReview } from './note-ai'
import { draftToContent, findQuote, inline, insertToContent, wikipediaUrl } from './note-content'

const draftReply = JSON.stringify({
  summary: 'Photosynthesis turns light into chemical energy.',
  sections: [
    { heading: 'Where it happens', points: ['It happens in the **chloroplasts**.', 'Mostly in leaves.'] },
    { heading: 'Inputs', points: ['Light, water and carbon dioxide.'] },
  ],
  keyTerms: [{ term: 'Chlorophyll', meaning: 'The green pigment that absorbs light.' }],
})

describe('parseNoteDraft', () => {
  it('reads JSON wrapped in prose', () => {
    const draft = parseNoteDraft(`Here are your notes:\n${draftReply}\nGood luck!`)
    expect(draft.sections).toHaveLength(2)
    expect(draft.keyTerms[0].term).toBe('Chlorophyll')
  })

  it('fits overruns: extra sections and points dropped, long points cut', () => {
    const reply = JSON.stringify({
      sections: Array.from({ length: 10 }, (_, i) => ({ heading: `S${i}`, points: Array(9).fill('x'.repeat(400)) })),
    })
    const draft = parseNoteDraft(reply)
    expect(draft.sections).toHaveLength(6)
    expect(draft.sections[0].points).toHaveLength(6)
    expect(draft.sections[0].points[0].length).toBeLessThanOrEqual(240)
    expect(draft.summary).toBe('')
  })

  it('refuses a reply with fewer than two usable sections', () => {
    expect(() => parseNoteDraft('{"sections": [{"heading": "Only", "points": ["one"]}]}')).toThrow('wrong shape')
    expect(() => parseNoteDraft('no json')).toThrow('didn’t return')
  })
})

describe('parseNoteReview', () => {
  const note = 'Photosynthesis happens in the mitochondria.\nIt makes glucose.'

  it('keeps quotes found in the note and drops invented ones', () => {
    const review = parseNoteReview(
      JSON.stringify({
        summary: 'Good start.',
        suggestions: [
          {
            kind: 'mistake',
            title: 'Fix the organelle',
            detail: 'It is the chloroplast.',
            quote: 'happens in the  MITOCHONDRIA',
          },
          { kind: 'unclear', title: 'Say which sugar', detail: 'Be specific.', quote: 'a sentence that is not there' },
        ],
      }),
      note,
    )
    expect(review.suggestions[0].quote).toBeDefined()
    expect(review.suggestions[1].quote).toBeUndefined()
  })

  it('keeps "insert" only for missing points, drops unknown kinds, and caps the count', () => {
    const many = Array.from({ length: 12 }, () => ({
      kind: 'missing',
      title: 'Add inputs',
      detail: 'Water and CO2.',
      insert: '- Water\n- CO2',
    }))
    const review = parseNoteReview(
      JSON.stringify({
        suggestions: [
          { kind: 'unclear', title: 'T', detail: 'D', insert: 'nope' },
          { kind: 'praise', title: 'T', detail: 'D' },
          ...many,
        ],
      }),
      note,
    )
    expect(review.suggestions).toHaveLength(MAX_SUGGESTIONS)
    expect(review.suggestions[0].insert).toBeUndefined()
    expect(review.suggestions[1].insert).toBe('- Water\n- CO2')
  })

  it('keeps a replacement only for a found quote of a mistake or unclear passage that changes it', () => {
    const review = parseNoteReview(
      JSON.stringify({
        suggestions: [
          {
            kind: 'mistake',
            title: 'Fix',
            detail: 'D',
            quote: 'in the mitochondria',
            replacement: 'in the chloroplasts',
          },
          { kind: 'mistake', title: 'Fix', detail: 'D', quote: 'not in the note', replacement: 'x' },
          { kind: 'unclear', title: 'Same', detail: 'D', quote: 'It makes glucose', replacement: 'it makes  glucose' },
          { kind: 'structure', title: 'Reorder', detail: 'D', quote: 'It makes glucose', replacement: 'y' },
        ],
      }),
      note,
    )
    expect(review.suggestions.map((s) => s.replacement)).toEqual([
      'in the chloroplasts',
      undefined,
      undefined,
      undefined,
    ])
  })

  it('judges accuracy against a source only when one is given', () => {
    expect(buildNoteReviewPrompt('n').system).toContain('well-established knowledge')
    const withSource = buildNoteReviewPrompt('n', { title: 'Photosynthesis', text: 'src' })
    expect(withSource.system).toContain('only against the source')
    expect(withSource.user).toContain('Source (Photosynthesis)')
  })
})

describe('note content', () => {
  it('turns **bold** runs into bold text', () => {
    expect(inline('In the **chloroplast**.')).toEqual([
      { type: 'text', text: 'In the ' },
      { type: 'text', text: 'chloroplast', marks: [{ type: 'bold' }] },
      { type: 'text', text: '.' },
    ])
  })

  it('lays a draft out as title, summary, sections, key terms and a source link', () => {
    const content = draftToContent(parseNoteDraft(draftReply), 'Photosynthesis')
    expect(content.map((n) => n.type)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'bulletList',
      'heading',
      'bulletList',
      'heading',
      'bulletList',
      'paragraph',
    ])
    const source = content[content.length - 1].content![1]
    expect(source.marks![0].attrs!.href).toBe(wikipediaUrl('Photosynthesis'))
    expect(wikipediaUrl('Calvin cycle')).toBe('https://en.wikipedia.org/wiki/Calvin_cycle')
  })

  it('turns "- " lines into a bullet list and other lines into paragraphs', () => {
    expect(insertToContent('Inputs:\n- Water\n- CO2').map((n) => n.type)).toEqual(['paragraph', 'bulletList'])
  })

  it('finds a quote ignoring case and extra spaces, with its document range', () => {
    const blocks = [
      { pos: 0, size: 12, text: 'Intro line' },
      { pos: 12, size: 40, text: 'It happens   in the Mitochondria.' },
    ]
    const hit = findQuote(blocks, 'happens in the mitochondria')!
    expect(hit).toEqual({ from: 12 + 1 + 3, to: 12 + 1 + 32, blockEnd: 52 })
    expect(findQuote(blocks, 'not in the note')).toBeNull()
  })
})
