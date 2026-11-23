import { describe, expect, it } from 'vitest'
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX } from './game-rules'
import { POLL_TEMPLATES, percentages, tallyVotes } from './polls'

describe('tallyVotes', () => {
  it('counts each choice', () => {
    expect(tallyVotes([0, 2, 2, 1, 2], 3)).toEqual([1, 1, 3])
  })

  it('returns zeros with no votes', () => {
    expect(tallyVotes([], 4)).toEqual([0, 0, 0, 0])
  })

  it('ignores choices outside the options', () => {
    expect(tallyVotes([-1, 3, 1.5, 0], 3)).toEqual([1, 0, 0])
  })
})

describe('percentages', () => {
  it('rounds each share', () => {
    expect(percentages([1, 2])).toEqual([33, 67])
  })

  it('is all zeros when nobody voted', () => {
    expect(percentages([0, 0, 0])).toEqual([0, 0, 0])
  })
})

describe('POLL_TEMPLATES', () => {
  it.each(POLL_TEMPLATES)('$label fits the poll limits', (t) => {
    expect(t.question.length).toBeLessThanOrEqual(POLL_QUESTION_MAX)
    expect(t.options.length).toBeGreaterThanOrEqual(POLL_MIN_OPTIONS)
    expect(t.options.length).toBeLessThanOrEqual(POLL_MAX_OPTIONS)
    for (const o of t.options) expect(o.length).toBeLessThanOrEqual(POLL_OPTION_MAX)
  })
})
