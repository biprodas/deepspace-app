import { describe, expect, it } from 'vitest'
import { addGameToEntry, rankEntries } from './leaderboard'

const standing = (rank: number, score: number, correctCount = 2) => ({
  roomId: 'r1',
  userId: 'ana',
  score,
  correctCount,
  correctMs: 1000,
  rank,
})

describe('addGameToEntry', () => {
  it('starts a new entry from the first game', () => {
    expect(addGameToEntry(undefined, { roomId: 'r1', standing: standing(1, 1800), displayName: 'Ana', playerCount: 3 })).toEqual({
      userId: 'ana',
      displayName: 'Ana',
      totalScore: 1800,
      games: 1,
      wins: 1,
      correctAnswers: 2,
      roomIds: ['r1'],
    })
  })

  it('adds later games and keeps the newest display name', () => {
    const first = addGameToEntry(undefined, { roomId: 'r1', standing: standing(2, 900), displayName: 'Ana', playerCount: 3 })
    const second = addGameToEntry(first, { roomId: 'r2', standing: standing(1, 700, 1), displayName: 'Ana B', playerCount: 2 })
    expect(second).toMatchObject({ displayName: 'Ana B', totalScore: 1600, games: 2, wins: 1, correctAnswers: 3, roomIds: ['r1', 'r2'] })
  })

  it('never counts the same room twice', () => {
    const once = addGameToEntry(undefined, { roomId: 'r1', standing: standing(1, 900), displayName: 'Ana', playerCount: 2 })
    expect(addGameToEntry(once, { roomId: 'r1', standing: standing(1, 900), displayName: 'Ana', playerCount: 2 })).toBe(once)
  })

  it('does not count a solo game as a win', () => {
    expect(addGameToEntry(undefined, { roomId: 'r1', standing: standing(1, 900), displayName: 'Ana', playerCount: 1 }).wins).toBe(0)
  })
})

describe('rankEntries', () => {
  it('orders by score, then wins, then fewer games', () => {
    const e = (displayName: string, totalScore: number, wins: number, games: number) => ({ displayName, totalScore, wins, games })
    expect(rankEntries([e('c', 900, 0, 1), e('a', 1000, 0, 2), e('b', 1000, 1, 3), e('d', 1000, 1, 2)]).map((x) => x.displayName)).toEqual([
      'd',
      'b',
      'a',
      'c',
    ])
  })
})
