import { describe, expect, it } from 'vitest'
import { computeStandings, elapsedMs, points } from './scoring'

describe('points', () => {
  it.each([
    [0, 1000],
    [5_000, 875],
    [10_000, 750],
    [20_000, 500],
  ])('a correct answer after %i ms of 20 s scores %i', (elapsed, expected) => {
    expect(points(true, elapsed, 20_000)).toBe(expected)
  })

  it('clamps elapsed time into the time limit', () => {
    expect(points(true, -50, 20_000)).toBe(1000)
    expect(points(true, 20_300, 20_000)).toBe(500)
  })

  it('scores a wrong answer 0', () => {
    expect(points(false, 0, 20_000)).toBe(0)
  })
})

describe('elapsedMs', () => {
  const round = { deadline: 30_000, timeLimitMs: 20_000 }

  it('measures from the remaining time', () => {
    expect(elapsedMs(round, 15_000)).toBe(5_000)
  })

  it('does not count paused time (deadline was pushed back)', () => {
    // Started at 0 with 20 s, paused 10 s → deadline 30 s; answered 5 s after resume.
    expect(elapsedMs(round, 25_000)).toBe(15_000)
  })

  it('clamps to [0, timeLimitMs]', () => {
    expect(elapsedMs(round, 0)).toBe(0)
    expect(elapsedMs(round, 30_250)).toBe(20_000)
  })
})

describe('computeStandings', () => {
  const players = [
    { userId: 'ana', joinedAt: 1 },
    { userId: 'ben', joinedAt: 2 },
    { userId: 'cy', joinedAt: 3 },
    { userId: 'dee', joinedAt: 4, removed: true },
  ]

  it('sums points and ranks by score', () => {
    const standings = computeStandings(players, [
      { userId: 'ana', correct: true, points: 900, answerMs: 4_000 },
      { userId: 'ben', correct: true, points: 1000, answerMs: 0 },
      { userId: 'ben', correct: false, points: 0, answerMs: 1_000 },
    ])
    expect(standings).toEqual([
      { userId: 'ben', score: 1000, correctCount: 1, correctMs: 0, rank: 1 },
      { userId: 'ana', score: 900, correctCount: 1, correctMs: 4_000, rank: 2 },
      { userId: 'cy', score: 0, correctCount: 0, correctMs: 0, rank: 3 },
    ])
  })

  it('breaks a score tie by less time on correct answers', () => {
    const ranked = computeStandings(players, [
      { userId: 'ana', correct: true, points: 800, answerMs: 9_000 },
      { userId: 'ben', correct: true, points: 800, answerMs: 7_000 },
      // Time on wrong answers does not count.
      { userId: 'ben', correct: false, points: 0, answerMs: 9_000 },
    ])
    expect(ranked.map((s) => s.userId)).toEqual(['ben', 'ana', 'cy'])
  })

  it('then by earlier join', () => {
    const ranked = computeStandings(players, [
      { userId: 'cy', correct: true, points: 800, answerMs: 5_000 },
      { userId: 'ana', correct: true, points: 800, answerMs: 5_000 },
    ])
    expect(ranked.map((s) => s.userId)).toEqual(['ana', 'cy', 'ben'])
  })

  it('leaves out removed players and answers from unknown users', () => {
    const ranked = computeStandings(players, [
      { userId: 'dee', correct: true, points: 1000, answerMs: 0 },
      { userId: 'ghost', correct: true, points: 1000, answerMs: 0 },
    ])
    expect(ranked.map((s) => s.userId)).toEqual(['ana', 'ben', 'cy'])
    expect(ranked.every((s) => s.score === 0)).toBe(true)
  })

  it('is stable across recomputes (idempotent reveal)', () => {
    const answers = [{ userId: 'ana', correct: true, points: 700, answerMs: 1 }]
    expect(computeStandings(players, answers)).toEqual(computeStandings(players, answers))
  })
})
