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
