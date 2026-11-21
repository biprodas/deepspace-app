# Study Arena — Implementation Plan

Companion to [features.md](./features.md) (what), [trd.md](./trd.md) (how)
and [schema.md](./schema.md) (data). This doc says **in what order** the work
is built and settles the gaps the TRD left open.

Landing and auth pages are done. Everything below is still to build.

---

## 1. Approach: foundation first, then feature by feature

Not "all backend, then all frontend":

- Schemas, the action plumbing and the pure logic (scoring, validation) are
  shared by every feature, so they go first, once (**M0**).
- After that, each feature is a **vertical slice**: its server actions + its
  screens + its tests, ending in something demoable and deployable. A server
  action nobody calls is untested guesswork, and every "done when" in
  features.md is end-to-end (two browsers, curl refusals), so it can only be
  checked per slice.
- The order follows [features.md §8](./features.md#8-build-order-5-days): the
  game loop runs on hand-written questions before AI generation exists, so
  the riskiest, most external piece (Claude + Wikipedia) can slip without
  blocking the core.

Each milestone is its own PR and leaves `main` deployable. Every action
follows [trd.md §6](./trd.md#6-server-actions): Zod parse → load + role check
on the server → state check → `tools.*` writes →
`{ success, data: { …, serverNow } }`.

| Milestone | Scope | Features |
|---|---|---|
| M0 | Schemas, action plumbing, scoring | — |
| M1 | Quizzes with hand-written questions | F2 (minus AI) |
| M2 | Rooms and lobby | F3, F9 |
| M3 | Game loop, reveal, final — **then first deploy** | F4–F6 |
| M4 | AI generation | F2 (AI path) |
| M5 | Resilience and UI states | F7, F8 |
| M6 | Should-haves | F10, F11, data inspector |

---

## 2. Decisions this plan settles

1. **Job → record write path** (trd §8 "verify on Day 3"): export
   `createActionTools` from `src/server/action-routes.ts` and call it from
   `src/jobs.ts` with `userId = job.enqueuedBy`. Both integrations are
   developer-billed, so `callIntegration` uses `env.APP_OWNER_JWT` and needs
   no caller JWT. No follow-up action and no batched-sync fallback.
2. **Jobs can be enqueued by any member** over the JobRoom socket
   (`authorizeWrite` in `worker.ts`), which would bypass the daily cap. The
   job handler trusts nothing in its payload except a `generationId`: it
   loads that `generations` row, requires `status === 'pending'` and
   `userId === job.enqueuedBy`, flips it to `running`, and only then spends
   credits.
3. **Timestamps** (`startedAt`, `deadline`, `joinedAt`, …) are epoch-ms
   `number` columns, not ISO text: deadline/elapsed arithmetic and the client
   countdown use them directly.
4. **Question order in a game:** `startQuestion` picks the lowest-`order`
   approved question of the quiz that has no round in this room yet. "Last
   question" means none is left after this one.
5. **Skip:** `skipQuestion` marks the current round `skipped` and immediately
   starts the next round (`question → question`); if none is left, it
   recomputes standings and sets `final`.
6. **Paused room:** answers and reveal are refused while `paused`; the host
   resumes first. `endRoom` works from any non-terminal state.
7. **Standings** include every non-removed player (0-score rows too), so the
   final screen and ranks are complete.

---

## 3. Milestones

### M0 — Foundation (backend only, no UI)

- `src/schemas/quiz-schemas.ts` (`quizzes`, `questions`, `answer_keys`,
  `generations`) and `src/schemas/game-schemas.ts` (`rooms`, `rounds`,
  `room_players`, `answers`, `standings`), built with the column helpers
  in `schema-helpers.ts`; record types and enums in `game-types.ts`.
  Permissions per [trd.md §4](./trd.md#4-data-model):
  `create/update/delete: false` for every client role; `read: true` except
  `answer_keys` (`'own'`, `ownerField: 'ownerId'`), `generations` and
  `answers` (`'own'`, `ownerField: 'userId'`). `uniqueOn` per trd §4.
  Registered in `src/schemas.ts`; `usersSchema` keeps read `'own'`.
- `src/actions/` — `index.ts` spreads one map per area (`game.ts` now;
  `quiz.ts`, `room.ts` in M1–M2). `src/actions/shared.ts`:
  `defineAction(zodSchema, run)` (parses params, maps thrown
  `ActionError`s to `{ success: false, error, code }`, adds `serverNow`),
  `unwrap`, `findRecord` / `getRecord` / `queryRecords`, `isDuplicate`,
  `requireQuizOwner`, `requireHost`, `requireHostOrCoHost`.
- `src/lib/scoring.ts` — `elapsedMs()` (from the remaining time, so paused
  time doesn't count), `points()`, `computeStandings(players, answers)`
  (score desc → `correctMs` asc → `joinedAt` asc). Limits in
  `src/lib/game-rules.ts`: `GRACE_MS = 300`, `MAX_PLAYERS = 50`,
  `TIME_LIMITS = [10, 20, 30, 60]`.
- `src/lib/actions-client.ts` — typed `callAction<T>(name, params)` for
  `POST /api/actions/<name>` with the user's bearer token.
- `getServerTime` action.
- Tests: `src/lib/scoring.test.ts` (formula bounds 500–1000, clamping,
  pauses, ties); `src/schemas.test.ts` (SDK schema lint, no client writes,
  owner-only reads on `answer_keys` / `answers` / `generations`).
- **Done when:** `npm run validate` passes, the dev server starts, and the
  collections exist in the RecordRoom.

### M1 — Quizzes with hand-written questions (F2 minus AI)

- Actions (`quiz.ts`), one verb each: `createQuiz` (manual: title only,
  status `ready`), `renameQuiz`, `deleteQuiz` (drains `questions` +
  `answer_keys`), `addQuestion` (hand-written, so it starts approved),
  `updateQuestion` (any subset of fields + `approved`; writes `questions`
  and `answer_keys` together), `moveQuestion` (swap `order` with a
  neighbour), `deleteQuestion`. All but `createQuiz` are owner-only, and
  every edit is refused while a room of the quiz is live (`quiz_in_play`),
  so answers can't change mid-game.
- Input rules in `src/lib/quiz-input.ts`, shared by the actions and the
  form: 4 non-empty options, distinct ignoring case/spacing, correct index
  0–3, time limit 10/20/30/60 s.
- UI: `quizzes/index.tsx` (my quizzes), `quizzes/new.tsx` (replaces the
  placeholder), `quizzes/[quizId].tsx` editor reading `questions` + own
  `answer_keys` via `useQuery`; `components/quiz/QuestionCard` and
  `QuestionForm`; `lib/use-action.ts` (pending state + refusal toasts).
  Nav entry "Quizzes".
- Tests: `quiz-input.test.ts`; `tests/quizzes.spec.ts` — owner action path,
  invalid input refused, editor UI, and (2 accounts) every quiz action
  refused for another user. `tests/helpers/actions.ts` calls actions with a
  real bearer token, like curl would.
- **Done when:** a host builds a quiz by hand and approves its questions.

### M2 — Rooms and lobby (F3, F9)

- Actions (`room.ts`): `createRoom` (owner, quiz `ready`, ≥ 1 approved
  question; `mintJoinCode` uses the `parseJoinCode` alphabet minus
  look-alikes 0/O/1/I/L, retries on a `uniqueOn` clash), `joinRoom`
  (idempotent; host/co-hosts get `role: 'host'`; refuses removed / full /
  `final` / `cancelled`; sets `firstRoundNumber`; display name from
  `users`), `removePlayer`, `addCoHost` (lobby only: a promoted player's
  row is deleted, since co-hosts can't answer), `removeCoHost`, and
  `endRoom` (moved up from M3: without it a lobby could never close and
  its quiz stayed frozen).
- UI: `rooms/[roomId].tsx` picks the screen from the viewer's role (host /
  co-host / player / removed / outsider) and room status, all live via
  `lib/use-room.ts`; `components/room/HostLobby` (projector: big code,
  invite link, roster with remove / make co-host, end game),
  `PlayerLobby` (phone: "you're in", roster, host-offline banner),
  `PlayerList` with online dots from ``usePresenceRoom(`room:<id>`)``;
  `join/[code].tsx` joins once and redirects, or explains the refusal.
  The quiz editor gets "Host a game" and an "Open games" list.
- Tests: `tests/rooms.spec.ts` — code format, host can't play, quiz frozen
  while open, end game, bad codes; with 2 accounts: live join, offline on
  leave, idempotent rejoin, remove → refused, host-only actions refused,
  co-host promotion.
- **Done when:** features.md F3's "done when".

### M3 — Game loop, reveal, final (F4–F6): the core claim

- Actions (`game.ts`): `startQuestion`, `submitAnswer`, `revealQuestion`,
  `skipQuestion`, `pauseRoom`, `resumeRoom` (`endRoom` landed in M2) —
  rules as in trd §5–6 plus decisions 4–7. `submitAnswer` takes `userId`
  only from the action context, scores against `answer_keys` with the
  server's receive time, returns only `locked` (never correctness), and
  relies on `uniqueOn [roundId, userId]` for the double-answer race; a
  double "start" is stopped by `uniqueOn [roomId, roundNumber]`.
  `revealQuestion` waits for deadline + grace, so no valid late answer can
  land after the reveal. Standings are recomputed from answers on
  `revealed` rounds only, so skipped rounds never score.
- `queryRecords` follows the room's `nextOffset` paging, so a recompute
  never works from a partial list.
- `src/lib/clock.ts` — 3-sample offset (`getServerTime`) +
  `useCountdown(deadline, offset, frozenMs)`.
- UI (`components/game/`): `HostGame` (projector: prompt, clock, tiles;
  pause / resume / skip / reveal, unlocked at deadline + grace like the
  server / next / end), `PlayerGame` (phone: big tiles → "answer locked
  in", late-joiner and paused states, result at reveal, host-offline
  banner), `RevealPanel` (correct option, distribution, explanation, quote
  + link or "From your notes"), `StandingsList`, `FinalScreen` (podium,
  rankings, "questions to review" from own `answers` + public `rounds`;
  also shown, with results so far, when a game is ended early).
  `rooms/[roomId].tsx` switches on room status.
- Tests: `tests/game.spec.ts` — host answer, reveal before deadline,
  non-host start/reveal, duplicate, non-current round, late (real 10 s
  deadline) → all refused; no explanation or `correctIndex` value in any
  frame the player receives before reveal (F5); answer on screen survives
  a refresh and host + player render identical standings; pause blocks
  answers, resume restores them, skip scores nothing; with 3 accounts, two
  players' standings and tie order match.
- **Then deploy**, after the source-control decision in
  [trd.md §12](./trd.md#12-deployment-and-configuration).
- **Done when:** features.md F4–F6 "done when", on the deployed URL.

### M4 — AI generation (F2 AI path)

- `src/lib/generation.ts` — Wikipedia HTML → text (quote-aware tag
  scanner: Wikipedia's `data-mw` attributes contain raw `>`; drops tables,
  infoboxes, navboxes, figures, citations, styles; stops at "See also" /
  "References"), truncation, prompt (source delimited as data), reply
  parsing, per-draft checks (shape, 4 distinct options, index, no repeats,
  quote really in the source), and `draftQuestions` (draft → check → one
  retry for the rejects with their reasons → drop the rest).
- `createQuiz` is a discriminated union on `sourceType` (`manual` /
  `wikipedia` 1–3 topics / `notes` 200–20,000 chars; 5–10 questions;
  difficulty). AI modes check the credit guard (one run at a time, 10 per
  rolling 24 h); Wikipedia topics are then resolved to article titles
  *before* anything is created, and a miss is refused as `topic_not_found`
  with a fuzzy-search (`term~`) suggestion the builder offers as a one-click
  fix ("Photosysthesis" → "Photosynthesis"); then it creates the quiz
  `generating` + a `pending` `generations` row holding the resolved titles
  or the notes, then `enqueueJob(…, 'generate-questions',
  { generationId }, { enqueuedBy, maxAttempts: 1 })`.
- `src/jobs.ts` — `generate-questions`: decision 2's guard → fetch sources
  (`wikipedia/get-page-content` for each resolved title, 12k chars per
  topic) → `anthropic/chat-completion` (`claude-sonnet-5-5`, temperature
  0.3) via `draftQuestions` → write unapproved `questions` + `answer_keys`
  → quiz `ready`/`failed` with `sourceUrls`; the row gets `stage` as it
  goes, then `droppedCount`, tokens and `completedAt`, or `error`.
- `regenerateQuestion` — same pipeline with count 1 from the quiz's
  original inputs; the new draft takes the old one's place and time limit,
  and the old one is removed only after the new one passed the checks.
- Liveness: the job stamps `heartbeatAt` every 15 s. A pending/running run
  silent for 60 s (worker recycled mid-call, deploy) is settled as failed
  ("interrupted") the next time the user starts a run, and the editor shows
  it as interrupted instead of spinning, so a dead job never blocks anyone.
- The job queue is closed to browsers (decision 2 hardened): `AppJobRoom`
  `authorizeRead`/`authorizeWrite` return false, so progress is shown from
  the owner-only `generations` row rather than `useJobs`.
- UI: builder with Wikipedia / notes / by-hand tabs, question-count slider,
  difficulty; editor shows `GenerationBanner` (progress, failure reason,
  dropped count), "Approve all drafts", per-question "Regenerate", and each
  answer's source sentence + link.
- Tests: `generation.test.ts` (HTML fixture shaped like Wikipedia's,
  quote matching, prompt, reply parsing, the retry loop with a scripted
  model; no live spend); `tests/generation.spec.ts` (every bad request
  refused before queueing; regenerate refused for non-owners and manual
  quizzes; builder validates client-side).
- **Done when:** features.md F2's "done when".

### M5 — Resilience and UI states (F7, F8)

- Refresh/reconnect restore (everything renders from `rooms` + the current
  round + own `answers`), offline markers, "host disconnected" banner, late
  joiners, error screens (generation failed, room full, removed, finished).
- Tests: refresh mid-question for player and host in `collab.spec.ts`.
- **Done when:** features.md F7's "done when".

### M6 — Should-haves (only after M3 is deployed and verified)

Game history (F10), all-time leaderboard (F11, `npx deepspace add
leaderboard`), owner-only `exportData` + `/admin/data`
([trd.md §13](./trd.md#13-data-storage-and-observability)).

---

## 4. Files

- **New:** `src/schemas/*.ts`, `src/actions/{shared,quiz,room,game}.ts`,
  `src/lib/{game-rules,scoring,generation,clock,actions-client}.ts`
  (+ `.test.ts`),
  pages under `src/pages/(app)/(protected)/{quizzes,rooms}/`.
- **Changed:** `src/schemas.ts`, `src/actions/index.ts`, `src/jobs.ts`,
  `src/server/action-routes.ts` (export `createActionTools`), `src/nav.ts`,
  `join/[code].tsx`, `quizzes/new.tsx`, `tests/api.spec.ts`,
  `tests/collab.spec.ts`.
- **Reused:** `parseJoinCode` / `joinPath` (`src/lib/join-code.ts`), UI
  primitives in `src/components/ui`, `lookupOwn` / `enqueueJob` from
  `deepspace/worker`.

## 5. Verification (every milestone)

`npm run validate` → `npx deepspace test run all` → a manual two-browser run
of the milestone's "done when" → commit and PR. From M3 on, also
`npx deepspace deploy` and repeat the flow on the deployed URL. The
[features.md §7](./features.md#7-verification) checklist is the final gate.
