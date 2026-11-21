/**
 * All-time leaderboard totals (docs/features.md F11). Pure: the game
 * actions call it when a game finishes, with the server's final standings.
 */

import type { LeaderboardEntry, Standing } from '../schemas/game-types'

/**
 * Adds one finished game to a player's totals. Idempotent per room: a game
 * already in `roomIds` changes nothing, so a retried finish can't
 * double-count. A win needs at least one opponent.
 */
export function addGameToEntry(
  entry: LeaderboardEntry | undefined,
  game: { roomId: string; standing: Standing; displayName: string; playerCount: number },
): LeaderboardEntry {
  const base: LeaderboardEntry = entry ?? {
    userId: game.standing.userId,
    displayName: game.displayName,
    totalScore: 0,
    games: 0,
    wins: 0,
    correctAnswers: 0,
    roomIds: [],
  }
  if (base.roomIds.includes(game.roomId)) return base
  return {
    ...base,
    displayName: game.displayName,
    totalScore: base.totalScore + game.standing.score,
    games: base.games + 1,
    wins: base.wins + (game.standing.rank === 1 && game.playerCount > 1 ? 1 : 0),
    correctAnswers: base.correctAnswers + game.standing.correctCount,
    roomIds: [...base.roomIds, game.roomId],
  }
}

/** Board order: total score, then wins, then fewer games (better average), then name. */
export function rankEntries<T extends Pick<LeaderboardEntry, 'totalScore' | 'wins' | 'games' | 'displayName'>>(
  entries: T[],
): T[] {
  return [...entries].sort(
    (a, b) =>
      b.totalScore - a.totalScore || b.wins - a.wins || a.games - b.games || a.displayName.localeCompare(b.displayName),
  )
}
