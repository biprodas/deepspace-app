# Study Arena — Implementation Plan

Companion to [features.md](./features.md) (what), [trd.md](./trd.md) (how)
and [schema.md](./schema.md) (data). This doc says **in what order** the work
is built and settles the gaps the TRD left open.

**Status (2026-11-23):** **deployed** at <https://studyarena.app.space/>.
The live release is #2 (`rel_01M83PAKCVECTWHD04X22D8ZYB`, 2026-11-23 07:53
UTC), built from `main` at `a0fcb01`; the first deploy was #1 on
2026-11-22 (`rel_01M8141SF8M370K8H3ME7CHYC8`). The live release has the
code for M0–M8 and the landing update. Still open: `OWNER_USER_ID` isn't set
on the live app, and the hand-checked parts of
[features.md §7](./features.md#7-verification) haven't been done. See
[§6 Next steps](#6-next-steps).

`[x]` = in the code, with tests where the milestone names them.
`[ ]` = not done yet, or only a person can check it.

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

| Milestone | Scope | Features | Status |
|---|---|---|---|
| M0 | Schemas, action plumbing, scoring | — | ✅ `b8e3607` |
| M1 | Quizzes with hand-written questions | F2 (minus AI) | ✅ `eda7da7` |
| M2 | Rooms and lobby | F3, F9 | ✅ `cbed918`, `1377ce7` |
| M3 | Game loop, reveal, final — **then first deploy** | F4–F6 | 🟡 code `004a640`; deployed, hand checks on the live URL still open |
| M4 | AI generation | F2 (AI path) | ✅ `abd204a` |
| M5 | Resilience and UI states | F7, F8 | ✅ `9444230` |
| M6 | Should-haves | F10, F11, data inspector | ✅ `95ed439` |
| — | Focus mode, page titles, favicon (unplanned polish) | F8 | ✅ `eab58c9` |
| M7 | Study together: polls and reactions, spaces, notes, whiteboards and AI mind maps | F12–F15 | ✅ PR #5, PR #6 |
| M8 | Admin console, audit log, settings | F16–F18 | ✅ PR #5 |
| — | Landing update (study spaces, link-preview image, structured data) | F8 | ✅ `a0fcb01` |

---

## 2. Decisions this plan settles

- [x] 1. **Job → record write path** (trd §8 "verify on Day 3"): export
   `createActionTools` from `src/server/action-routes.ts` and call it from
   `src/jobs.ts` with `userId = job.enqueuedBy`. Both integrations are
   developer-billed, so `callIntegration` uses `env.APP_OWNER_JWT` and needs
   no caller JWT. No follow-up action and no batched-sync fallback.
- [x] 2. **Jobs can be enqueued by any member** over the JobRoom socket
   (`authorizeWrite` in `worker.ts`), which would bypass the daily cap. The
   job handler trusts nothing in its payload except a `generationId`: it
   loads that `generations` row, requires `status === 'pending'` and
   `userId === job.enqueuedBy`, flips it to `running`, and only then spends
   credits. (M4 went further: browsers can't use the job queue at all.)
- [x] 3. **Timestamps** (`startedAt`, `deadline`, `joinedAt`, …) are epoch-ms
   `number` columns, not ISO text: deadline/elapsed arithmetic and the client
   countdown use them directly.
- [x] 4. **Question order in a game:** `startQuestion` picks the lowest-`order`
   approved question of the quiz that has no round in this room yet. "Last
   question" means none is left after this one.
- [x] 5. **Skip:** `skipQuestion` marks the current round `skipped` and immediately
   starts the next round (`question → question`); if none is left, it
   recomputes standings and sets `final`.
- [x] 6. **Paused room:** answers and reveal are refused while `paused`; the host
   resumes first. `endRoom` works from any non-terminal state.
- [x] 7. **Standings** include every non-removed player (0-score rows too), so the
   final screen and ranks are complete.
- [x] 8. **Source control** (trd §12): **GitHub.** The first deploy latched
   the app to GitHub for good, so never run `deepspace push`. DeepSpace lists
   the linked repo as `biprodas/studyarena-ds` while `origin` is
   `biprodas/studyarena`; if those aren't the same (renamed) repo, deploys
   don't come from `origin`.

---

## 3. Milestones

### M0 — Foundation (backend only, no UI) ✅

- [x] `src/schemas/quiz-schemas.ts` (`quizzes`, `questions`, `answer_keys`,
  `generations`) and `src/schemas/game-schemas.ts` (`rooms`, `rounds`,
  `room_players`, `answers`, `standings`), built with the column helpers
  in `schema-helpers.ts`; record types and enums in `game-types.ts`.
  Permissions per [trd.md §4](./trd.md#4-data-model):
  `create/update/delete: false` for every client role; `read: true` except
  `answer_keys` (`'own'`, `ownerField: 'ownerId'`), `generations` and
  `answers` (`'own'`, `ownerField: 'userId'`). `uniqueOn` per trd §4.
  Registered in `src/schemas.ts`; `usersSchema` keeps read `'own'`.
- [x] `src/actions/` — `index.ts` spreads one map per area (`game.ts` now;
  `quiz.ts`, `room.ts` in M1–M2). `src/actions/shared.ts`:
  `defineAction(zodSchema, run)` (parses params, maps thrown
  `ActionError`s to `{ success: false, error, code }`, adds `serverNow`),
  `unwrap`, `findRecord` / `getRecord` / `queryRecords`, `isDuplicate`,
  `requireQuizOwner`, `requireHost`, `requireHostOrCoHost`.
- [x] `src/lib/scoring.ts` — `elapsedMs()` (from the remaining time, so paused
  time doesn't count), `points()`, `computeStandings(players, answers)`
  (score desc → `correctMs` asc → `joinedAt` asc). Limits in
  `src/lib/game-rules.ts`: `GRACE_MS = 300`, `MAX_PLAYERS = 50`,
  `TIME_LIMITS = [10, 20, 30, 60]`.
- [x] `src/lib/actions-client.ts` — typed `callAction<T>(name, params)` for
  `POST /api/actions/<name>` with the user's bearer token.
- [x] `getServerTime` action.
- [x] Tests: `src/lib/scoring.test.ts` (formula bounds 500–1000, clamping,
  pauses, ties); `src/schemas.test.ts` (SDK schema lint, no client writes,
  owner-only reads on `answer_keys` / `answers` / `generations`).
- [x] **Done when:** `npm run validate` passes, the dev server starts, and the
  collections exist in the RecordRoom.

### M1 — Quizzes with hand-written questions (F2 minus AI) ✅

- [x] Actions (`quiz.ts`), one verb each: `createQuiz` (manual: title only,
  status `ready`), `renameQuiz`, `deleteQuiz` (drains `questions` +
  `answer_keys`), `addQuestion` (hand-written, so it starts approved),
  `updateQuestion` (any subset of fields + `approved`; writes `questions`
  and `answer_keys` together), `moveQuestion` (swap `order` with a
  neighbour), `deleteQuestion`. All but `createQuiz` are owner-only, and
  every edit is refused while a room of the quiz is live (`quiz_in_play`),
  so answers can't change mid-game.
- [x] Input rules in `src/lib/quiz-input.ts`, shared by the actions and the
  form: 4 non-empty options, distinct ignoring case/spacing, correct index
  0–3, time limit 10/20/30/60 s.
- [x] UI: `quizzes/index.tsx` (my quizzes), `quizzes/new.tsx` (replaces the
  placeholder), `quizzes/[quizId].tsx` editor reading `questions` + own
  `answer_keys` via `useQuery`; `components/quiz/QuestionCard` and
  `QuestionForm`; `lib/use-action.ts` (pending state + refusal toasts).
  Nav entry "Quizzes".
- [x] Tests: `quiz-input.test.ts`; `tests/quizzes.spec.ts` — owner action path,
  invalid input refused, editor UI, and (2 accounts) every quiz action
  refused for another user. `tests/helpers/actions.ts` calls actions with a
  real bearer token, like curl would.
- [x] **Done when:** a host builds a quiz by hand and approves its questions.

### M2 — Rooms and lobby (F3, F9) ✅

- [x] Actions (`room.ts`): `createRoom` (owner, quiz `ready`, ≥ 1 approved
  question; returns the host's oldest open game of the quiz instead of
  making a second room, so a repeated "Host a game" never splits players; `mintJoinCode` uses the `parseJoinCode` alphabet minus
  look-alikes 0/O/1/I/L, retries on a `uniqueOn` clash), `joinRoom`
  (idempotent; host/co-hosts get `role: 'host'`; refuses removed / full /
  `final` / `cancelled`; sets `firstRoundNumber`; display name from
  `users`), `removePlayer`, `addCoHost` (lobby only: a promoted player's
  row is deleted, since co-hosts can't answer), `removeCoHost`, and
  `endRoom` (moved up from M3: without it a lobby could never close and
  its quiz stayed frozen).
- [x] UI: `rooms/[roomId].tsx` picks the screen from the viewer's role (host /
  co-host / player / removed / outsider) and room status, all live via
  `lib/use-room.ts`; `components/room/HostLobby` (projector: big code,
  invite link, roster with remove / make co-host, end game),
  `PlayerLobby` (phone: "you're in", roster, host-offline banner),
  `PlayerList` with online dots from ``usePresenceRoom(`room:<id>`)``;
  `join/[code].tsx` joins once and redirects, or explains the refusal.
  The quiz editor gets "Host a game" and an "Open games" list.
- [x] Tests: `tests/rooms.spec.ts` — code format, host can't play, quiz frozen
  while open, end game, bad codes; with 2 accounts: live join, offline on
  leave, idempotent rejoin, remove → refused, host-only actions refused,
  co-host promotion.
- [x] **Done when:** features.md F3's "done when".

### M3 — Game loop, reveal, final (F4–F6): the core claim 🟡

- [x] Actions (`game.ts`): `startQuestion`, `submitAnswer`, `revealQuestion`,
  `skipQuestion`, `pauseRoom`, `resumeRoom` (`endRoom` landed in M2) —
  rules as in trd §5–6 plus decisions 4–7. `submitAnswer` takes `userId`
  only from the action context, scores against `answer_keys` with the
  server's receive time, returns only `locked` (never correctness), and
  relies on `uniqueOn [roundId, userId]` for the double-answer race; a
  double "start" is stopped by `uniqueOn [roomId, roundNumber]`.
  `revealQuestion` waits for deadline + grace, so no valid late answer can
  land after the reveal. Standings are recomputed from answers on
  `revealed` rounds only, so skipped rounds never score.
- [x] `queryRecords` follows the room's `nextOffset` paging, so a recompute
  never works from a partial list.
- [x] `src/lib/clock.ts` — 3-sample offset (`getServerTime`) +
  `useCountdown(deadline, offset, frozenMs)`.
- [x] UI (`components/game/`): `HostGame` (projector: prompt, clock, tiles;
  pause / resume / skip / reveal, unlocked at deadline + grace like the
  server / next / end), `PlayerGame` (phone: big tiles → "answer locked
  in", late-joiner and paused states, result at reveal, host-offline
  banner), `RevealPanel` (correct option, distribution, explanation, quote
  + link or "From your notes"), `StandingsList`, `FinalScreen` (podium,
  rankings, "questions to review" from own `answers` + public `rounds`;
  also shown, with results so far, when a game is ended early).
  `rooms/[roomId].tsx` switches on room status.
- [x] Tests: `tests/game.spec.ts` — host answer, reveal before deadline,
  non-host start/reveal, duplicate, non-current round, late (real 10 s
  deadline) → all refused; no explanation or `correctIndex` value in any
  frame the player receives before reveal (F5); answer on screen survives
  a refresh and host + player render identical standings; pause blocks
  answers, resume restores them, skip scores nothing; with 3 accounts, two
  players' standings and tie order match.
- [x] **Then deploy**, after the source-control decision in
  [trd.md §12](./trd.md#12-deployment-and-configuration) (decision 8).
  First deployed 2026-11-22; live release #2 since 2026-11-23.
- [ ] **Done when:** features.md F4–F6 "done when", on the deployed URL.
  (Works locally; still has to be checked on the deployed URL.)

### M4 — AI generation (F2 AI path) ✅

- [x] `src/lib/generation.ts` — Wikipedia HTML → text (quote-aware tag
  scanner: Wikipedia's `data-mw` attributes contain raw `>`; drops tables,
  infoboxes, navboxes, figures, citations, styles; stops at "See also" /
  "References"), truncation, prompt (source delimited as data), reply
  parsing, per-draft checks (shape, 4 distinct options, index, no repeats,
  quote really in the source), and `draftQuestions` (draft → check → one
  retry for the rejects with their reasons → drop the rest).
- [x] `createQuiz` is a discriminated union on `sourceType` (`manual` /
  `wikipedia` 1–3 topics / `notes` 200–20,000 chars; 5–10 questions;
  difficulty). AI modes check the credit guard (one run at a time, 10 per
  rolling 24 h); Wikipedia topics are then resolved to article titles
  *before* anything is created, and a miss is refused as `topic_not_found`
  with a fuzzy-search (`term~`) suggestion the builder offers as a one-click
  fix ("Photosysthesis" → "Photosynthesis"); then it creates the quiz
  `generating` + a `pending` `generations` row holding the resolved titles
  or the notes, then `enqueueJob(…, 'generate-questions',
  { generationId }, { enqueuedBy, maxAttempts: 1 })`.
- [x] `src/jobs.ts` — `generate-questions`: decision 2's guard → fetch sources
  (`wikipedia/get-page-content` for each resolved title, 12k chars per
  topic) → `anthropic/chat-completion` (`claude-sonnet-5-5`, temperature
  0.3) via `draftQuestions` → write unapproved `questions` + `answer_keys`
  → quiz `ready`/`failed` with `sourceUrls`; the row gets `stage` as it
  goes, then `droppedCount`, tokens and `completedAt`, or `error`.
- [x] `regenerateQuestion` — same pipeline with count 1 from the quiz's
  original inputs; the new draft takes the old one's place and time limit,
  and the old one is removed only after the new one passed the checks.
- [x] Liveness: the job stamps `heartbeatAt` every 15 s. A pending/running run
  silent for 60 s (worker recycled mid-call, deploy) is settled as failed
  ("interrupted") the next time the user starts a run, and the editor shows
  it as interrupted instead of spinning, so a dead job never blocks anyone.
- [x] The job queue is closed to browsers (decision 2 hardened): `AppJobRoom`
  `authorizeRead`/`authorizeWrite` return false, so progress is shown from
  the owner-only `generations` row rather than `useJobs`.
- [x] UI: builder with Wikipedia / notes / by-hand tabs, question-count slider,
  difficulty; editor shows `GenerationBanner` (progress, failure reason,
  dropped count), "Approve all drafts", per-question "Regenerate", and each
  answer's source sentence + link.
- [x] Tests: `generation.test.ts` (HTML fixture shaped like Wikipedia's,
  quote matching, prompt, reply parsing, the retry loop with a scripted
  model; no live spend); `tests/generation.spec.ts` (every bad request
  refused before queueing; regenerate refused for non-owners and manual
  quizzes; builder validates client-side).
- [x] **Done when:** features.md F2's "done when".

### M5 — Resilience and UI states (F7, F8) ✅

- [x] Already in place from M2–M4: refresh restore (screens render only from
  `rooms` + current round + own `answers`), "host disconnected" banners,
  late joiners (`firstRoundNumber`), and the error screens (generation
  failed / interrupted, room full, removed, finished).
- [x] Added: `ConnectionBanner` above every room state ("Reconnecting… your
  answers and score are safe"). Fixed a real blank-out: on a dropped socket
  the SDK re-subscribes with status `loading` but keeps the records, and
  `useRoom` treated that as a first load, swapping the game for "Loading
  room…"; it now counts only a first load as loading.
- [x] Added: offline markers in the host's in-game standings (score kept).
- [x] Added: a real `/home` — code field plus "Your games" (open rooms you host
  or play in, most recent first, idle > 24 h hidden, max 5) with
  Rejoin links, so closing the tab isn't the end of the game.
- [x] Tests: `tests/resilience.spec.ts` — host refresh mid-question and while
  paused (clock stays frozen), late joiner sits out then plays, removed
  mid-game is shown out and refused, a player who leaves shows offline with
  their score kept and gets back in from /home, and a socket cut by the
  test shows the banner, keeps the screen, and recovers into the new
  question.
- [x] **Done when:** features.md F7's "done when".

### M6 — Should-haves (only after M3 is deployed and verified) ✅

Built before the first deploy, at the user's request.

- [x] **All-time leaderboard (F11) — not `npx deepspace add leaderboard`.**
  That feature lets users submit their own scores (admins edit them), which
  breaks "the client never owns the score". Instead a server-only
  `leaderboard` collection (`uniqueOn [userId]`) is updated in `finish()`
  from the final `standings`: total score, games, wins (rank 1 with at
  least one opponent), correct answers. `addGameToEntry` records each
  counted `roomId`, so a repeated finish can't double-count; games ended
  early never count; a board failure is logged and never blocks the end of
  a game. Page: `/leaderboard`.
- [x] **History (F10):** `/history` lists finished games played (your rank of
  N and points, or "Removed") and hosted (player count). Each row opens the
  room's final screen, where the host now sees "How each question went"
  (accuracy per question and the hardest questions, from the public reveal
  fields of `rounds` via `lib/game-report.ts`).
- [x] **Data inspector (trd §13):** `exportData` refuses anyone but
  `env.OWNER_USER_ID` and returns every game collection (pasted notes left
  out, only their length kept); `/admin/data` (nav: admins) shows counts,
  recent rooms and a JSON download.
- [x] Tests: `leaderboard.test.ts`, `game-report.test.ts`;
  `tests/history.spec.ts` — a finished game raises the player's board
  total and an ended one doesn't, history shows rank and the host's
  breakdown, and `exportData` / `/admin/data` refuse non-owners.
- [ ] The owner path of `exportData` / `/admin/data` can't be automated (test
  accounts are never the owner). Check it by hand once `OWNER_USER_ID` is
  set on the deployed app.

### Extra — Focus mode, titles, favicon (not in the plan) ✅

- [x] Focus mode: in a lobby or live game the app nav is replaced by
  `components/room/FocusBar` (logo, quiz, code, colour mode, Leave / Exit to
  quiz); the results screen keeps the nav.
- [x] One `<title>` per page from `lib/page-title.tsx`; `APP_NAME` is
  StudyArena.
- [x] `favicon.svg` / `.ico` / `apple-touch-icon`, theme-color, and og tags
  for the app shell (`/join/CODE` link previews) via `prerender.ts`.

---

## 4. Files

- **New:** `src/schemas/*.ts`, `src/actions/{shared,quiz,room,game,admin}.ts`,
  `src/lib/{game-rules,scoring,generation,clock,actions-client,leaderboard,game-report}.ts`
  (+ `.test.ts`),
  pages under `src/pages/(app)/(protected)/{quizzes,rooms,admin}/`,
  `history.tsx`, `leaderboard.tsx`.
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

---

## 6. Next steps

In order. The app is deployed, so everything below can be checked on
<https://studyarena.app.space/>.

1. [ ] **Re-run the full gate on `main`:** `npm run validate` and
   `npx deepspace test run all`. The last saved Playwright run covered only
   a filtered subset (`--grep "who has answered|forged or late|refresh|pause
   freezes"`), so run the whole suite and fix anything that fails.
2. [x] **Decide source control** (decision 8, trd §12): GitHub. Confirm the
   linked repo `biprodas/studyarena-ds` is `origin` (`biprodas/studyarena`),
   renamed.
3. [x] **Deploy:** release #1 on 2026-11-22, release #2 (live) on
   2026-11-23. The landing page serves the new description and `/og.png`.
   - [ ] **Set `OWNER_USER_ID`** on the live app: `npx deepspace secrets`
     lists none. Without it the admin console (`/admin`, including its data
     page) refuses everyone, the daily
     audit-log prune runs with no user, and the notes/boards membership check
     calls the records room with an empty user. Set it, then open a note and
     a board on the live site to confirm both connect.
   - [ ] Check that `wikipedia` and `anthropic` are still developer-billed.
4. [ ] **Check M3 on the deployed URL:** F4–F6 "done when" with two real
   accounts (host on a laptop, player on a phone).
5. [ ] **Hand checks from [features.md §7](./features.md#7-verification),**
   on the deployed URL:
   - [ ] Player's WebSocket frames contain no `correctIndex` before reveal
     (DevTools → Network → WS).
   - [ ] Every generated `sourceQuote` appears in its source text (one
     Wikipedia quiz and one notes quiz, live spend).
   - [ ] Unapproved questions never appear in a game.
   - [ ] Two real accounts: lobby, game, reveal and standings stay in sync.
   - [ ] Refresh mid-question (player and host) restores state;
     pause/resume keeps answers working.
   - [ ] Player screens work on a real phone, including focus mode.
   - [ ] No API keys in the client bundle or the repo (search the built
     `dist/` and the git history).
   - [ ] Owner path of `/admin/data` and the JSON download.
6. [ ] **Tick the automated items in features.md §7** once step 1 passes
   (late / duplicate / non-current / host answer, removed rejoin, non-owner
   refusals, scoring and tie-break). The tests exist, but the boxes are still
   empty.
7. [ ] **Write-up ([features.md §9](./features.md#9-write-up-notes-fill-in-as-we-go)):**
   fill in "What the agent did", "What I verified / changed myself" and
   "Unfinished + what I'd do next", and explain the items in features.md §3
   that were left out on purpose.
8. [ ] **If something breaks after deploy:** `npx deepspace rollback`, fix,
   and deploy again.
