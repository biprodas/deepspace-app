/**
 * Game limits shared by server actions and screens (docs/features.md F3–F4,
 * docs/trd.md §6).
 */

/** Answers received up to this long after the deadline still count. */
export const GRACE_MS = 300

export const MAX_PLAYERS = 50

/** People one `invitePlayers` call may invite, and invites per room (email credit guard). */
export const MAX_INVITES_PER_CALL = 10
export const MAX_INVITES_PER_ROOM = 50

// ─── Study spaces ────────────────────────────────────────

export const SPACE_NAME_MAX = 60
export const SPACE_DESCRIPTION_MAX = 280
export const MAX_SPACE_MEMBERS = 100
export const MAX_INVITES_PER_SPACE = 100
/** Spaces one user may own (keeps the per-account storage in check). */
export const MAX_OWNED_SPACES = 20
export const NOTE_TITLE_MAX = 80
export const MAX_NOTES_PER_SPACE = 200
export const BOARD_TITLE_MAX = 80
export const MAX_BOARDS_PER_SPACE = 100
/** AI mind maps one user may generate per rolling 24 hours (credit guard). */
export const DAILY_MINDMAP_LIMIT = 5

// ─── Polls ───────────────────────────────────────────────

export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 6
export const POLL_QUESTION_MAX = 140
export const POLL_OPTION_MAX = 60

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
