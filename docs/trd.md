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

The scaffold already decides most of this. The quiz game needed no new
runtime dependencies. Shared notes added the Tiptap editor packages (with
its drag-handle and suggestion extensions) and `@floating-ui/dom`; the
whiteboard uses no drawing library.

| Layer | Choice | Why |
|---|---|---|
| Platform | DeepSpace SDK `deepspace@0.44.2` on Cloudflare Workers | The assignment; gives auth, synced records, RBAC, presence, jobs, integrations, deploy |
| Server state | `RecordRoom` Durable Object (SQLite-backed) | One serialized writer per scope: `uniqueOn` and permission checks are race-free |
| Server logic | Server actions (`src/actions/`) on the Hono worker | Privileged, validated writes; the only way players' answers reach the database |
| Long work | `JobRoom` background jobs (`src/jobs.ts`) | AI generation can exceed a request's lifetime; jobs broadcast progress live |
| Lobby presence | `usePresenceRoom` (`PresenceRoom` DO) | Sub-second join/leave. `usePresence` is ~60 s heartbeat granularity — too coarse for a lobby. Also used for who's online in a space, and reactions |
| Shared notes | Tiptap 3 on Yjs, `useYjsRoom` (`YjsRoom` DO) | Collaborative rich text with live cursors; a CRDT is the right model for text people edit together |
| Whiteboards | `useCanvas` (`CanvasRoom` DO) + the app's own SVG renderer | Shapes, undo/redo and viewports synced by the platform; the drawing UI is ours (§15) |
| Scheduled work | `CronRoom` DO (`src/cron.ts`) | One daily task: prune the audit log |
| Frontend | React 19, Vite 8, TypeScript 5.7 | Scaffold |
| Routing | React Router 7 + Generouted file routes (`src/pages/`) | Scaffold; `(app)/(protected)/` gives the sign-in gate for free |
| UI | Tailwind CSS 4, Base UI components in `src/components/ui`, `lucide-react` icons | Scaffold; no extra component library needed |
| Validation | Zod 4 | Validates AI output and server action params |
| AI | `anthropic/chat-completion` via the integration proxy, model `claude-sonnet-5-5` | Good quality/cost balance for structured question writing. Model is a constant, easy to change |
| Source text | `wikipedia/search-pages`, `wikipedia/get-page-content` | Grounding; returns page HTML |
| Email | `email/send` | Invite emails for games and spaces (about $0.013 each), skipped when the invitee turned them off |
| Account settings | Better Auth client (`authClient`) through the `/api/auth` proxy | Rename, change password, list and revoke sessions |
| Tests | Playwright + `deepspace/testing` multi-user fixture; Vitest for pure logic | Scaffold; real two-user tests against the dev worker |
| Lint/types | ESLint 9, `tsc --noEmit` | Scaffold (`npm run validate`) |
| Runtime | Node 24.22, npm 11.19 | Meets `engines` (npm ≥ 11.6) |

**Considered and rejected**

| Option | Why not |
|---|---|
| A separate backend (Express, Supabase, Firebase) | Duplicates what DeepSpace provides; the brief asks for platform primitives |
| Socket.io / custom WebSockets for the game | RecordRoom already syncs records over WebSockets with RBAC filtering |
| Yjs for game state | Game state is authoritative and server-written, not collaboratively edited; CRDT merge is the wrong model |
| Cron for timers / auto-advance | Deadlines are checked on write; nothing in a game needs scheduling (cron is used only to prune the audit log) |
| tldraw or Excalidraw for whiteboards | tldraw needs a paid licence key in production; Excalidraw has no built-in sync and would replace the platform's canvas room. The existing canvas room plus our own tools was enough |
| A Zustand/Redux store | `useQuery` already is the live store; local UI state is enough |
| `ai-chat` feature | Built for conversations; we need one structured generation per request |

---

## 3. Architecture

```
 Browser (host / players)
 ├─ useQuery(...)  ◄──── WebSocket (RBAC-filtered) ────┐
 ├─ usePresenceRoom(`room:<id>`) ◄── WebSocket ── PresenceRoom DO
 ├─ useJobs(...)   ◄──── WebSocket ─────────── JobRoom DO (AI generation)
 ├─ useYjsRoom(noteId)   ◄── /ws/yjs/:docId ──── YjsRoom DO    (shared notes)
 ├─ useCanvas(boardId)   ◄── /ws/canvas/:docId ─ CanvasRoom DO (whiteboards)
 └─ fetch /api/actions/<name>  (Bearer JWT)
                │
                ▼
        Hono worker (worker.ts)
        ├─ server actions (src/actions)  ── tools.create/update/query ──► RecordRoom DO
        │                                                                (scope app:<APP_ID>)
        └─ tools.integration(...) ──► DeepSpace integration proxy
                                       ├─ wikipedia/*
                                       ├─ anthropic/chat-completion
                                       └─ email/send
        CronRoom DO (daily) ── prune audit_log ──► RecordRoom DO
```

The notes and canvas routes admit only the space's active members; see §15.

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
| `room_invites` | `'own'` (invitee) | `uniqueOn [roomId, key]` |
| `polls` | `true` | — |
| `poll_votes` | `'own'` | `uniqueOn [pollId, userId]` |
| `round_flags` | `'own'` | `uniqueOn [roundId, userId]` |
| `leaderboard` | `true` | `uniqueOn [userId]` |
| `spaces` | `'team'` (members of the space) | `uniqueOn [code]` |
| `team_members` | `'team'` | `uniqueOn [teamId, userId]` |
| `space_invites` | `'own'` (invitee) | `uniqueOn [spaceId, key]` |
| `documents` (notes) | `'team'` | text lives in the YjsRoom, not here |
| `boards` | `'team'` | shapes live in the CanvasRoom, not here |
| `audit_log` | admins only (members and viewers: none) | written only by the server |
| `user_prefs` | `'own'` | `uniqueOn [userId]` |
| `settings` | admins only | from the scaffold; unused |

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
- **`'team'` collections** carry `teamId` (= the space's id). The SDK's
  `'team'` rule checks the reader against `team_members`, so a non-member
  or a removed member receives nothing from that space.
- **`poll_votes` are private:** each voter reads only their own vote; the
  poll record carries the totals.

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
| `scheduleRoom` | host | Lobby only; sets `scheduledAt` (future, ≤ 30 days ahead) or clears it with `null`. A plan players see as a countdown; the host still starts the game |
| `getServerTime` | member | Returns `serverNow` for clock-offset sync |

**Added after the first release** (same five steps):

| Action | Caller check | Key rules |
|---|---|---|
| `renameQuiz` / `deleteQuiz` / `addQuestion` / `moveQuestion` / `deleteQuestion` | quiz owner | Hand-editing a quiz |
| `addCoHost` / `removeCoHost` | host | Co-hosts can run the game but can't answer |
| `recentPlayers` / `invitePlayers` / `dismissInvite` | host / invitee | Accounts can be picked only from people you've played with; anyone else by email address. At most 50 invites a game; an email is sent unless the invitee turned emails off |
| `createPoll` / `closePoll` | host/co-host | Up to 6 distinct options; refused once the game is over |
| `votePoll` | player | Not removed; poll open; one vote (`uniqueOn`) |
| `flagConfused` | player | Only on a revealed round; one flag a round |
| `createSpace` / `updateSpace` / `deleteSpace` | member / owner | At most 20 owned spaces; a unique 6-character code |
| `joinSpace` / `leaveSpace` | member | Refuses removed members and full spaces (100); the owner can't leave |
| `removeMember` | space owner | Sets the membership inactive, which cuts every `'team'` read and the notes/boards connections |
| `inviteToSpace` | member | Accounts or email addresses; at most 100 invites a space |
| `createNote` / `renameNote` / `deleteNote` | member / author or owner | At most 200 notes a space |
| `sessionNote` | member | The game's session note, created on first "Add to notes" |
| `draftNote` | member of the note's space | 10 AI note uses a day; Wikipedia article → Claude → checked notes (`lib/note-ai.ts`), returned for the browser to add |
| `reviewNote` | member of the note's space | Same limit; the note's text (≥ 40 characters, refused before any AI call) and an optional Wikipedia topic → suggestions only |
| `createBoard` / `renameBoard` / `deleteBoard` | member / creator or owner | At most 100 boards a space |
| `createMindMap` | member | 5 a day; Wikipedia text ≥ 200 characters; Claude's reply parsed and fitted (§15) |
| `markMindMapDrawn` | creator | The map is drawn once |
| `updatePreferences` | self | Writes `user_prefs` |
| `adminSummary` / `exportData` | app owner (`env.OWNER_USER_ID`) | Admin console overview and data export |
| `logRoleChange` | admin | Records a role change in the audit log (§16) |

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
| Non-member reads a space's notes or boards | `'team'` read rule; the `/ws/yjs` and `/ws/canvas` routes refuse unknown ids and anyone who isn't an active member (they used to admit any signed-in user to any id) |
| Removed member keeps access | Removal sets the membership inactive; the next connection and every `'team'` read is refused; tested |
| Invite spam | Accounts can be picked only from people you've played with (others by email address); caps of 50 a game and 100 a space; invitees can turn emails off |
| Someone edits the audit log | Written only by server actions; admins can read but not change it |
| Unrecorded role change | Role changes are logged as *verified* when the server saw them, *reported* when only the browser did |

---

## 10. Code layout

Build order and milestones: [implementation-plan.md](./implementation-plan.md).

```
src/
  schemas/            quiz-, game-, space-, note-, board-, audit-, pref- and
                      admin-schema files (collections and permissions)
  schemas.ts          registers all of the above
  cron.ts             daily audit-log prune (CronRoom)
  server/
    realtime-routes.ts  WebSocket routes; membership checks for notes/boards
  actions/
    index.ts          action registry
    quiz.ts           createQuiz, updateQuestion, regenerateQuestion
    room.ts           createRoom, joinRoom, removePlayer
    game.ts           startQuestion, submitAnswer, revealQuestion,
                      skipQuestion, pauseRoom, resumeRoom, endRoom,
                      getServerTime
    invite.ts, poll.ts, space.ts, note.ts, board.ts, prefs.ts,
    admin.ts, audit.ts    the actions added after the first release (§6)
  jobs.ts             generate-questions handler
  lib/
    scoring.ts        points, standings, tie-break (pure, unit-tested)
    generation.ts     prompt, Zod schema, quote matching, HTML→text
    clock.ts          offset + countdown hook
    actions-client.ts typed fetch wrapper for /api/actions/*
    canvas-shapes.ts  whiteboard geometry: wrapping, pen paths, resize
    mindmap.ts        mind-map prompt, parsing and layout
  pages/(app)/
    index / home      landing, "create quiz", "join with code"
    (protected)/
      quizzes/        list, new, [quizId] review/approve
      rooms/[roomId]/ host view + player view (by role)
      join/[code].tsx share-link entry (game, or space when no game has the code)
      spaces/         list, [spaceId] (overview, notes, boards),
                      notes/[noteId], boards/[boardId]
      admin/          overview, users, usage, credits, audit, data
      settings/       profile, password, devices, preferences
  components/
    boards/           CanvasView, CanvasToolbar, ShapeRenderer
    notes/            the Notion-style editor (slash menu, block handle)
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
- **Later features:** `polls`, `spaces`, `notes`, `boards`, `join` and
  `settings` specs — membership refusals, live sync between two accounts,
  the board tools, erase/clear/restore, rename and delete from lists. The
  mind-map spec calls Claude, so it runs only with `RUN_PAID_TESTS=1`.
- AI generation is tested with a recorded source + recorded model output
  (no live spend in CI); one manual live run per day.
- Commands: `npm run validate`, `npx deepspace test run all`.

---

## 12. Deployment and configuration

- **Settled: GitHub.** The app is deployed (live release #2, 2026-11-23)
  and latched to GitHub; never run `deepspace push`.
- **Decide source control before the first deploy or push.** The submission
  asks for "the repository". Source authority latches permanently on the
  first source-producing action:
  - Want a **GitHub** repo → add the GitHub remote *before* the first
    `deepspace deploy`, and never run `deepspace push`.
  - Otherwise the app latches to **DeepSpace source** and can't move to
    GitHub later.
- `wrangler.toml`: keep `DEEPSPACE_APP_ID` committed (identity, not a
  secret). No `[vars]` secrets.
- `src/integrations.ts`: `wikipedia`, `anthropic` and `email` are `developer`
  billed and `serverOnly`: the browser proxy refuses them, so only server
  code (behind the daily caps) can call them.
- **One secret is needed: `OWNER_USER_ID`** (the owner's DeepSpace user id).
  Without it the admin console (`adminSummary`, `exportData`) refuses
  everyone, the daily audit-log prune runs with no user, and the notes/boards
  membership check calls the records room with an empty user. It isn't set
  on the live app yet.
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
- Note text lives in each note's `YjsRoom`, and board shapes in each board's
  `CanvasRoom` (both SQLite-backed Durable Objects, named after the record
  id). The `documents` and `boards` records hold only titles and ownership.
- Audit entries older than 90 days are deleted by a daily cron task at 03:15
  UTC.
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
| Users, AI usage, credits, audit log | The admin console at `/admin` (§16) |

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

---

## 15. Study spaces, notes and boards (F13–F15)

**Spaces.** A space is a `spaces` record plus one `team_members` row per
member (`teamId`, `userId`, `status`). Every collection that belongs to a
space (`spaces`, `team_members`, `documents`, `boards`) uses the SDK's
`'team'` read rule against `teamId`. Games hosted in a space carry its id in
`rooms.spaceId`. A join code is tried as a game first and then as a space
(`/join/:code`).

**Realtime routes** (`src/server/realtime-routes.ts`). Identity in query
strings and headers is never trusted; the routes verify the JWT and forward
it in internal-only headers.
- `/ws/yjs/:docId` resolves the note's space and admits only active
  members, with an editor role.
- `/ws/canvas/:docId` admits only the board's active space members.
- Both refuse ids that aren't notes or boards.

**Notes.** A Tiptap 3 editor bound to the note's Yjs document, with
collaborative cursors, a "/" block menu, a block handle and a selection
format bar. The "AI" menu drafts notes from a Wikipedia topic (added
through the editor, so they sync and undo like typing) or reviews the note:
Claude's suggestions are parsed and checked (a quoted passage must really be
in the note; corrected wording is kept only for a mistake or unclear
passage whose quote was found), shown in a side panel, and applied only when
a member chooses "Replace" (swaps the quoted range) or "Add to note"; the
review never edits the note by itself. The daily limit counts the
member's `ai.note_*` audit entries. "Make a quiz" sends the note's text to the normal quiz
pipeline (§8); "Add to notes" on a reveal pins the question into the game's
session note (`sessionNote`).

**Boards.** `useCanvas` syncs shapes, per-user undo/redo and viewports. The
drawing UI is the app's own (`components/boards/`, `lib/canvas-shapes.ts`):
select, hand, pen, eraser, rectangle, ellipse, arrow, line, text and sticky
note; colour, stroke and fill; resize handles; text written in place;
duplicate and copy/paste; fit to content; PNG export; pointer events for
mouse, pen and touch, with pinch zoom.
- **Own edits.** The canvas room sends a move, resize or edit to everyone
  but its author, and `useCanvas` doesn't apply it locally, so the board
  keeps its own changes over the room's copy of each shape until that copy
  changes.
- **One undo step per drag.** A drag is previewed locally and sent once
  when it ends.
- **Clear board** deletes every shape, then offers a one-click Restore (the
  same ids) for 15 seconds.

**AI mind maps** (`lib/mindmap.ts`, `createMindMap`).
1. Resolve the Wikipedia title and load the article text (≥ 200
   characters).
2. Claude writes JSON: a 1–3 word root, 4–6 short parallel branches and 2–4
   specific children each, each branch with a supporting quote.
3. The reply is fitted rather than refused for small overruns: labels are
   shortened, extras and duplicates dropped, quotes not found in the source
   removed. A reply with no root or under two branches fails.
4. The creator's browser lays it out once (`layoutMindMap`), balanced left
   and right, with cards sized from measured text and branches spaced by
   their children so nothing overlaps (unit-tested), then
   `markMindMapDrawn`. After that it's an ordinary board.

## 16. Admin console, audit log and settings (F16–F18)

- **Admin console** (`/admin`): overview, users (role changes, with a
  confirmation), API usage, credits and data. The overview and data come
  from `adminSummary` and `exportData`, which refuse anyone but
  `env.OWNER_USER_ID`.
- **Audit log** (`audit_log`): every removal, deletion, paid call (quiz
  drafts, mind maps, invite emails) and role change, with a readable label
  kept after the target is gone. Written only by server actions through
  `audit()`; admins read it in the console. Role changes are marked
  *verified* or *reported by browser*. Pruned after 90 days.
- **Settings** (`/settings`, one section per page):
  - Profile: rename (the DeepSpace account name, so it shows in other
    DeepSpace apps too).
  - Password: change it (email-and-password accounts only).
  - Devices: list sessions and sign out the others. Better Auth refuses both
    with `SESSION_NOT_FRESH` once the sign-in is about a day old; the card
    then offers "Sign in again" (sign out, then sign-in returning to
    `/settings/devices`).
  - Preferences: theme including "System", game reactions on or off (this
    device), invite emails on or off (synced in `user_prefs`).
