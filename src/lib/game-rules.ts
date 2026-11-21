/**
 * Game limits shared by server actions and screens (docs/features.md F3–F4,
 * docs/trd.md §6).
 */

/** Answers received up to this long after the deadline still count. */
export const GRACE_MS = 300

export const MAX_PLAYERS = 50

/** Allowed question time limits, in seconds. */
export const TIME_LIMITS = [10, 20, 30, 60] as const
export type TimeLimit = (typeof TIME_LIMITS)[number]
export const DEFAULT_TIME_LIMIT: TimeLimit = 20

export const OPTION_COUNT = 4
export const MAX_POINTS = 1000

// ─── AI generation (docs/trd.md §8) ──────────────────────

export const MIN_QUESTIONS = 5
export const MAX_QUESTIONS = 10
export const MAX_TOPICS = 3
export const MAX_NOTES_CHARS = 20_000
/** Per Wikipedia topic, to keep the prompt within budget. */
export const MAX_TOPIC_CHARS = 12_000
/** Generations a user may start per rolling 24 hours (credit guard). */
export const DAILY_GENERATION_LIMIT = 10
