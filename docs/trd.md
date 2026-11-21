# Study Arena — Technical Requirements (TRD)

Companion to [features.md](./features.md). The spec says *what*; this says
*how*. Where this doc and the installed SDK disagree, the SDK wins — check
`node_modules/deepspace/dist/*.d.ts` and fix this doc.

---

## 1. Goals and constraints

- Ship the important path (build quiz → lobby → live game → reveal → final)
  on `<name>.app.space` within 5 days.
- The client is never trusted with the answer, the clock, or the score.
- Use DeepSpace primitives instead of re-implementing them (auth, records,
  RBAC, presence, server actions, jobs, integrations).
- No secrets in the repo or the browser.
- Scale target: ≤ 50 players per room, a handful of concurrent rooms.
  Evaluation build, not production.

---

## 2. Tech stack

The scaffold already decides most of this. **No new runtime dependencies are
planned**; every row below is already in `package.json`.

| Layer | Choice | Why |
|---|---|---|
| Platform | DeepSpace SDK `deepspace@0.44.2` on Cloudflare Workers | The assignment; gives auth, synced records, RBAC, presence, jobs, integrations, deploy |
| Server state | `RecordRoom` Durable Object (SQLite-backed) | One serialized writer per scope: `uniqueOn` and permission checks are race-free |
| Server logic | Server actions (`src/actions/`) on the Hono worker | Privileged, validated writes; the only way players' answers reach the database |
| Long work | `JobRoom` background jobs (`src/jobs.ts`) | AI generation can exceed a request's lifetime; jobs broadcast progress live |
| Lobby presence | `usePresenceRoom` (`PresenceRoom` DO) | Sub-second join/leave. `usePresence` is ~60 s heartbeat granularity — too coarse for a lobby |
| Frontend | React 19, Vite 8, TypeScript 5.7 | Scaffold |
| Routing | React Router 7 + Generouted file routes (`src/pages/`) | Scaffold; `(app)/(protected)/` gives the sign-in gate for free |
| UI | Tailwind CSS 4, Base UI components in `src/components/ui`, `lucide-react` icons | Scaffold; no extra component library needed |
| Validation | Zod 4 | Validates AI output and server action params |
| AI | `anthropic/chat-completion` via the integration proxy, model `claude-sonnet-5-5` | Good quality/cost balance for structured question writing. Model is a constant, easy to change |
| Source text | `wikipedia/search-pages`, `wikipedia/get-page-content` | Grounding; returns page HTML |
| Tests | Playwright + `deepspace/testing` multi-user fixture; Vitest for pure logic | Scaffold; real two-user tests against the dev worker |
| Lint/types | ESLint 9, `tsc --noEmit` | Scaffold (`npm run validate`) |
| Runtime | Node 24.22, npm 11.19 | Meets `engines` (npm ≥ 11.6) |

**Considered and rejected**

| Option | Why not |
|---|---|
| A separate backend (Express, Supabase, Firebase) | Duplicates what DeepSpace provides; the brief asks for platform primitives |
| Socket.io / custom WebSockets for the game | RecordRoom already syncs records over WebSockets with RBAC filtering |
| Yjs for game state | Game state is authoritative and server-written, not collaboratively edited; CRDT merge is the wrong model |
| Cron for timers / auto-advance | Deadlines are checked on write; nothing needs scheduling |
| A Zustand/Redux store | `useQuery` already is the live store; local UI state is enough |
| `ai-chat` feature | Built for conversations; we need one structured generation per request |

---

## 3. Architecture

```
 Browser (host / players)
 ├─ useQuery(...)  ◄──── WebSocket (RBAC-filtered) ────┐
 ├─ usePresenceRoom(`room:<id>`) ◄── WebSocket ── PresenceRoom DO
 ├─ useJobs(...)   ◄──── WebSocket ─────────── JobRoom DO (AI generation)
 └─ fetch /api/actions/<name>  (Bearer JWT)
                │
                ▼
        Hono worker (worker.ts)
        ├─ server actions (src/actions)  ── tools.create/update/query ──► RecordRoom DO
        │                                                                (scope app:<APP_ID>)
        └─ tools.integration(...) ──► DeepSpace integration proxy
                                       ├─ wikipedia/*
                                       └─ anthropic/chat-completion
```

**Rule:** clients read via `useQuery` and write *only* through server
actions (every game collection has `create/update/delete: false` for all
client roles). One write path is easier to secure and to reason about.

### Scope decision (resolves the open question in features.md)

**One app-wide scope (`SCOPE_ID = app:<APP_ID>`), with `roomId` columns.**

- Server action `tools` operate on the app's main RecordRoom; per-room scopes
  would need extra plumbing to reach from actions (verify before changing).
- History and an all-time leaderboard need cross-room queries.
- At ≤ 50 players and a few rooms, one DO is well within limits.
- Clients filter with `useQuery(collection, { where: { roomId } })` so they
  only render their room; RBAC still decides what they *receive*.

Revisit only if load testing shows one DO is a bottleneck.

---

## 4. Data model

Defined in `src/schemas/*.ts`, registered in `src/schemas.ts`. Every
collection: `create/update/delete: false` for `member` (server actions only).

Full field list: [schema.md](./schema.md).

| Collection | `read` (member) | Constraints |
|---|---|---|
| `quizzes` | `true` | — |
| `questions` | `true` | — |
| `answer_keys` | `'own'` via `ownerField: 'ownerId'` | `uniqueOn [questionId]` |
| `generations` | `'own'` via `ownerField: 'userId'` | — |
| `rooms` | `true` | `uniqueOn [code]` |
| `rounds` | `true` (reveal fields null until reveal) | `uniqueOn [roomId, roundNumber]` |
| `room_players` | `true` | `uniqueOn [roomId, userId]` |
| `answers` | `'own'` via `ownerField: 'userId'` | `uniqueOn [roundId, userId]` |
| `standings` | `true` | `uniqueOn [roomId, userId]` |

Notes:
- **Why `answer_keys` is separate:** permissions are per record, not per
  field. If `correctIndex` or `explanation` were on `questions`, they would
  be in every player's WebSocket frames.
- **`rounds`:** one record per question played. `startQuestion` creates it
  with the reveal fields empty; `revealQuestion` copies `correctIndex`,
  `explanation`, `sourceQuote`, `sourceUrl` and the `distribution` onto it
  after the deadline. It also keeps per-question timing for history.
- **`answers` before reveal:** a player only receives their own rows, so
  nobody can see others' picks; the distribution is published on the round.
- **`standings` is recomputed**, not incremented: `revealQuestion` sums the
  room's `answers` and rewrites rows. Idempotent, so a retried reveal can't
  double-count.
- **`generations`:** one row per AI run (model, prompt version, tokens,
  status, dropped count). The per-user daily cap counts these rows.
- The final screen's "questions you got wrong" joins the player's own
  `answers` with public `rounds` — no extra read access needed.

---

## 5. Room state machine

```
lobby ──start──► question ──(deadline passed) reveal──► reveal ──next──► question
   │                │  ▲                                     │
   │             pause│  │resume                         last question
   │                ▼  │                                     ▼
   │              paused                                   final
   ├──────────── host can skip a question (question → question, no scoring)
   └──────────── host can end early from any state → cancelled
```

Every transition is a server action that checks the current `status` first
and refuses an invalid move (e.g. `reveal` before the deadline, `next` from
`lobby`). Clients render purely from `rooms.status` + the current round,
which is what makes refresh/reconnect recovery automatic.

---

## 6. Server actions

All in `src/actions/`, exposed at `POST /api/actions/<name>`. Each one:
1. parses `params` with Zod (bad input → `{ success: false, error }`);
2. loads the room/quiz and checks the caller's role **on the server**;
3. checks the state machine;
4. writes with `tools.*`;
5. returns `{ success, data: { ..., serverNow } }`.

| Action | Caller check | Key rules |
|---|---|---|
| `createQuiz` | member | Validates source input, caps per-user daily generations (counts `generations` rows), creates quiz `generating` + a `generations` row, enqueues `generate-questions` job |
| `regenerateQuestion` | quiz owner | Same pipeline for one question |
| `updateQuestion` | quiz owner | Edit/approve/reorder/delete; writes `questions` + `answer_keys` together |
| `createRoom` | quiz owner | Quiz has ≥ 1 approved question; mints a code (retry on `uniqueOn` clash) |
| `joinRoom` | member | Idempotent; refuses `removed`, full room (50), `final`/`cancelled` room; sets `firstRoundNumber` = next round if game started |
| `removePlayer` | host | Sets `removed: true` |
| `startQuestion` | host/co-host | From `lobby` or `reveal`; creates a round for the next approved question with `deadline = now + timeLimit`; sets `currentRoundId` |
| `submitAnswer` | player | Not host/co-host, not removed; room in `question`; matches `currentRoundId`; `now ≤ deadline + GRACE_MS`; `uniqueOn` rejects a second answer; scores from `answer_keys` |
| `revealQuestion` | host/co-host | Only after deadline; fills the round's reveal fields, recomputes `standings`; last question → `final` |
| `skipQuestion` | host/co-host | Marks the round `skipped`, no scoring |
| `pauseRoom` / `resumeRoom` | host/co-host | Stores the round's `remainingMs = deadline − now`; resume sets `deadline = now + remainingMs` |
| `endRoom` | host | From any state; status `cancelled`, `completedAt` set, results so far kept |
| `getServerTime` | member | Returns `serverNow` for clock-offset sync |

**Scoring** (pure function, unit-tested):
`points = correct ? round(1000 × (1 − 0.5 × elapsed / timeLimitMs)) : 0`,
where `elapsed = serverReceivedAt − round.startedAt`, clamped to
`[0, timeLimitMs]`.

**Deadline grace:** `GRACE_MS = 300`. Absorbs network latency for an answer
clicked just before zero on a slow phone connection. Small enough not to
matter for fairness; documented as a tradeoff.

**Tie-break:** score desc → `correctMs` (sum of `elapsed` on correct answers)
asc → `joinedAt` asc.

---

## 7. Clock sync

- On entering a room, the client calls `getServerTime` 3×, keeps the sample
  with the smallest round trip, and computes
  `offset = serverNow − (sentAt + receivedAt) / 2`.
- Countdown: `remaining = deadline − (Date.now() + offset)`, rendered every
  ~100 ms with `requestAnimationFrame`.
- The countdown is cosmetic. The server decides with its own clock.

---

## 8. AI generation pipeline

Runs as a `generate-questions` job in `JobRoom` (`src/jobs.ts`), because a
10-question Claude call can take tens of seconds and jobs survive past the
HTTP response and broadcast progress.

1. **Fetch source**
   - Wikipedia: `search-pages` → best title → `get-page-content` (returns
     **HTML**). Strip to plain text in the worker (drop tables, references,
     navboxes), normalize whitespace.
   - Notes: use as given (cap at ~20k chars).
   - Truncate source to a token budget (~12k chars per topic).
2. **Prompt** Claude (`temperature` 0.3, `max_tokens` ~4k). The integration
   has no structured-output/tool parameter, so the system prompt demands a
   single JSON object and nothing else. Source text is wrapped in delimiters
   and described as data, not instructions.
3. **Parse + validate** with a Zod schema:
   - exactly 4 non-empty, distinct options (case/whitespace-insensitive);
   - `correctIndex` ∈ 0..3;
   - `sourceQuote` found in the normalized source text (normalize quotes,
     dashes, whitespace, case before matching).
4. **Retry once** for the invalid questions only; then drop what's still
   invalid and record `droppedCount` on the `generations` row.
5. **Write** `questions` (unapproved) + `answer_keys`; set quiz `ready`
   (or `failed` with a reason). The host's review screen updates live.

**Job → records (resolved):** the job builds the same `tools` the actions
use (`createActionTools` from `src/server/action-routes.ts`), acting as
`job.enqueuedBy`. Both integrations are developer-billed, so no caller JWT
is needed. Progress and errors go on the owner-only `generations` row,
which the review screen reads live.

**Cost guard:** browsers can't touch the job queue at all
(`AppJobRoom` `authorizeRead`/`authorizeWrite` return false; only server
code enqueues). The job trusts only a `generationId` and runs it once, only
if that row is `pending` and belongs to whoever enqueued it
(`maxAttempts: 1`, no auto-retry). `createQuiz` caps 5–10 questions per
call, one run at a time per user, and 10 runs per user per rolling 24 h.

---

## 9. Security

| Threat | Mitigation |
|---|---|
| Player reads the correct answer before reveal | Answer only in `answer_keys`, readable by the quiz owner only; RBAC filters it out in the DO before the WebSocket send |
| Host plays and wins with the answer key | `submitAnswer` refuses host and co-hosts |
| Late answer with a changed device clock | Server compares its own receive time to `deadline` |
| Double answering / second identity | Sign-in required; `uniqueOn [roundId, userId]`; `userId` from the verified JWT, never from params |
| Forged host action | Every action checks caller vs. `room.hostId` / `coHostIds` on the server |
| Direct client writes to game collections | `create/update/delete: false` for all client roles |
| Removed player rejoins | `joinRoom` checks `removed` |
| Prompt injection via notes/Wikipedia | Source delimited as data; output schema-validated; quote must exist in source; host approval gate |
| Credit drain | Generation caps per call and per user/day; owner-billed integrations only via server code |
| API key exposure | No keys exist in the app: integrations go through the DeepSpace proxy with the user's JWT |
| Leaking emails via users | Keep scaffold `users` read `'own'`; names come from `useUsers()` public projection |

---

## 10. Code layout

Build order and milestones: [implementation-plan.md](./implementation-plan.md).

```
src/
  schemas/            quizzes.ts, questions.ts, answer-keys.ts, rooms.ts,
                      generations.ts, rounds.ts, room-players.ts, answers.ts,
                      standings.ts
  schemas.ts          registers all of the above
  actions/
    index.ts          action registry
    quiz.ts           createQuiz, updateQuestion, regenerateQuestion
    room.ts           createRoom, joinRoom, removePlayer
    game.ts           startQuestion, submitAnswer, revealQuestion,
                      skipQuestion, pauseRoom, resumeRoom, endRoom,
                      getServerTime
  jobs.ts             generate-questions handler
  lib/
    scoring.ts        points, standings, tie-break (pure, unit-tested)
    generation.ts     prompt, Zod schema, quote matching, HTML→text
    clock.ts          offset + countdown hook
    actions-client.ts typed fetch wrapper for /api/actions/*
  pages/(app)/
    index / home      landing, "create quiz", "join with code"
    (protected)/
      quizzes/        list, new, [quizId] review/approve
      rooms/[roomId]/ host view + player view (by role)
      join/[code].tsx share-link entry
```

---

## 11. Testing

- **Unit (Vitest):** scoring, tie-break, standings recompute, option
  de-duplication, quote matching, HTML→text.
- **API (Playwright, `api.spec.ts`):** every refusal in features.md §7 —
  late, duplicate, non-current, host answer, removed rejoin, non-owner
  actions, reveal before deadline.
- **Multi-user (`collab.spec.ts`, `deepspace/testing` `users` fixture):**
  host + 2 players: join, answer, reveal, identical standings; refresh
  mid-question restores state.
- AI generation is tested with a recorded source + recorded model output
  (no live spend in CI); one manual live run per day.
- Commands: `npm run validate`, `npx deepspace test run all`.

---

## 12. Deployment and configuration

- **Decide source control before the first deploy or push.** The submission
  asks for "the repository". Source authority latches permanently on the
  first source-producing action:
  - Want a **GitHub** repo → add the GitHub remote *before* the first
    `deepspace deploy`, and never run `deepspace push`.
  - Otherwise the app latches to **DeepSpace source** and can't move to
    GitHub later.
- `wrangler.toml`: keep `DEEPSPACE_APP_ID` committed (identity, not a
  secret). No `[vars]` secrets.
- `src/integrations.ts`: `wikipedia` and `anthropic` stay `developer`
  billing (default), sign-in required.
- No entries in `npx deepspace secrets` are needed.
- Deploy: `npm run validate` → `npx deepspace test run all` → commit →
  `npx deepspace deploy`. Rollback with `npx deepspace rollback` if the
  deployed flow breaks.

---

## 13. Data storage and observability

**Where data lives.** No external database and no ORM.
- Records are stored in **SQLite inside the app's `RecordRoom` Durable
  Object** on Cloudflare, scope `app:<APP_ID>`. The schemas in `src/schemas/`
  play the role of an ORM model; `useQuery` (client) and `tools.*` (server
  actions) are the query layer. Schema changes are migrated automatically on
  deploy (additive changes; see the docs' "add a field" guide before renaming
  or removing columns).
- Job rows live in `JobRoom`'s SQLite; presence is in memory only.
- **Local dev data** lives in `.wrangler/state` (gitignored). It is separate
  from production: nothing local is deployed. Delete it to start empty.
- No automatic backup is documented.

**Where to look**

| What | How |
|---|---|
| Account, apps, billing | [dashboard.deep.space](https://dashboard.deep.space) (same login as the CLI) |
| Live release, signed-in account, environment | `npx deepspace status` |
| Deploy history / roll back | `npx deepspace releases`, `npx deepspace rollback` |
| Pushes, workspaces, releases feed | `npx deepspace activity` |
| Server and browser errors | `npx deepspace logs --since 1h --level error` (`--follow` to tail) |
| Credits and integration spend (Claude, Wikipedia) | `npx deepspace app usage` |
| What the live page renders | `npx deepspace test screenshot https://<app>.app.space/ live.png` |
| AI generation progress | `useJobs` in the app (quiz review screen) |
| The data itself | Owner-only inspector (below) |

**Owner-only data inspector** (Day 4–5, small):
- Server action `exportData`: refuses anyone but `env.OWNER_USER_ID`; reads
  every game collection with `tools.query` and returns JSON.
- Page `/admin/data` (nav entry `roles: ['admin']`): counts per collection,
  recent rooms with status and players, and a "Download JSON" button.
- Done through a server action, not by giving `admin` read access on the
  collections: the app owner also signs in as a test player, and admin read
  on `answer_keys` would let that account see answers during play.

---

## 14. Risks and open questions

| Risk | Mitigation |
|---|---|
| Job → record write path unclear | Verify Day 3; fallback to batched synchronous action |
| Claude returns invalid JSON / weak questions | Zod + quote check + retry once + host review |
| Wikipedia HTML noisy, quotes don't match | Normalize both sides; strip non-prose blocks; test on 5 real topics |
| Clock skew on phones | Offset sync + server-side check + 300 ms grace |
| One DO for all rooms | Fine at target scale; per-room scopes noted as future work |
| Presence flakiness on first render | Render `peers` reactively (documented SDK behavior) |
