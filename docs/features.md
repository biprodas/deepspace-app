# Study Arena — Feature Spec

A live multiplayer quiz room. A host picks topics, Claude writes multiple-choice
questions grounded in Wikipedia (each with the exact supporting quote), the host
reviews them, and players compete in real time. Scoring happens on the server
against an answer key players never receive.

**Core claim to defend:** the client is never trusted with the answer or with
the score.

---

## 1. Must-have (the important path)

Build these end to end before anything in section 2.

### F1. Auth and identity
- Sign in via DeepSpace auth (scaffold default).
- Every signed-in user is a `member`. "Host" is not a global role; it's
  per-room (whoever created the room). See F2.
- **Done when:** a signed-out visitor can see the landing page but cannot
  join or create a room.

### F2. Rooms (create / join / lobby)
- Host creates a room → gets a short join code (e.g. `K7QX`).
- Players join by code. A player joins a room at most once (`uniqueOn`).
- Lobby shows who's present (live presence) and host's "Start" button.
- Room status machine: `draft → lobby → live → finished`.
- Only the host can change status or advance questions.
- **Done when:** two accounts in two browsers see each other appear in the
  lobby without refreshing.

### F3. Question generation (Claude + Wikipedia)
- Host enters 1–3 topics → server action `generateQuestions`:
  1. `wikipedia/search-pages` → pick the best page per topic.
  2. `wikipedia/get-page-content` → source text.
  3. `anthropic/chat-completion` → N multiple-choice questions as structured
     JSON: `{ prompt, options[4], correctIndex, sourceQuote, sourceUrl }`.
  4. Validate the output on the server: exactly 4 options, `correctIndex`
     in range, `sourceQuote` actually appears in the fetched page text
     (reject/regenerate otherwise).
  5. Write the prompt + options to `questions`, and `correctIndex` +
     `sourceQuote` to `answer_keys`. Never put the answer in `questions`.
- Runs on the server so API keys and owner credits never touch the browser.
- Guard spend: host-only, capped questions per call, capped calls per room.
- **Done when:** generated questions appear in the host's review screen with
  their source quote and link, and a forged request from a non-host is refused.

### F4. Host review
- Host can edit question text/options, change the correct answer, delete, or
  reorder questions before starting.
- Edits to the answer go through a server action (host-only), since
  `answer_keys` is not client-writable.
- **Done when:** the host can fix a bad question and the change is what
  players see in the game.

### F5. Live game loop
- Host clicks "Start" / "Next" → server action `startQuestion` sets
  `currentQuestionId` and a `deadline` timestamp (e.g. now + 20s) on the room.
- All clients show the question and a countdown derived from `deadline`.
- Player answers → server action `submitAnswer(questionId, choiceIndex)`:
  - refuse if the caller hasn't joined the room;
  - refuse if `now > deadline` (no ticking server clock needed; the deadline
    is just data);
  - refuse a second answer (`uniqueOn: [questionId, userId]`);
  - look up `answer_keys`, compute correct/incorrect and points
    (base + speed bonus), write to `answers`.
- Players see "answer locked in", not whether it's correct, until reveal.
- **Done when:** an answer submitted after the deadline (e.g. via curl with a
  valid token) is refused, and a second answer is refused.

### F6. Reveal
- After the deadline the host clicks "Reveal" → server action `revealQuestion`
  copies `correctIndex` + `sourceQuote` onto a public `reveals` record.
- All clients show: correct option, the quote and source link, the answer
  distribution, and who got it right.
- **Done when:** before reveal, the correct answer is not present in any
  WebSocket frame a player receives (check in DevTools).

### F7. Live scoreboard
- Scoreboard updates for everyone after each reveal (sum of `answers.points`
  per player in the room).
- Final standings screen when the room is `finished`.
- **Done when:** both browsers show identical standings without refreshing.

### F8. Resilience (the multiplayer edge cases)
- **Reconnect:** refreshing mid-question restores the current question,
  remaining time and the player's own locked-in answer.
- **Late joiner:** joins on the current question; earlier questions count
  as 0, no crash.
- **Host leaves:** game pauses (no auto-advance); host can resume on return.
- **Done when:** each case is tested by hand with two accounts.

---

## 2. Should-have (only after section 1 works when deployed)

- **F9. All-time leaderboard** via `npx deepspace add leaderboard`: points
  across rooms per user.
- **F10. Question bank reuse:** host can replay a finished room's questions
  in a new room (skips generation cost).
- **F11. Per-question stats for the host:** % correct, avg. answer time;
  flags questions everyone got wrong (likely a bad question).

## 3. Deliberately left out (explain in the write-up)

| Left out | Why |
|---|---|
| Voice / TTS (ElevenLabs, speech) | Costs per character and doesn't improve the core loop |
| Payments | No paid tier in an evaluation build |
| Cron | Nothing is time-scheduled; the host drives the game. Deadlines are checked on write |
| Messaging / chat | Not needed to play; adds moderation surface |
| Uploading your own notes | Good v2 (file parsing + chunking); would eat a day |
| Auto-advance timer on the server | Host-driven is simpler and predictable; the deadline still prevents late answers |

---

## 4. Data model (draft — confirm against `deepspace/schema` types)

| Collection | Key columns | Who can read | Who can write |
|---|---|---|---|
| `rooms` | `code`, `hostId`, `status`, `currentQuestionId`, `deadline`, `topics` | members | create: member; updates via server actions only |
| `room_players` | `roomId`, `userId` (userBound), `joinedAt` — `uniqueOn [roomId, userId]` | members | create: member (own row) |
| `questions` | `roomId`, `order`, `prompt`, `options` (json), `sourceUrl` | members | server actions only |
| `answer_keys` | `questionId`, `roomId`, `hostId`, `correctIndex`, `sourceQuote` | **host only** (`ownerField: hostId`, `read: 'own'`) | server actions only |
| `answers` | `questionId`, `roomId`, `userId`, `choiceIndex`, `correct`, `points`, `answeredAt` — `uniqueOn [questionId, userId]` | own row before reveal; all after reveal (decide: `'shared'` via reveal action, or publish aggregates on `reveals`) | server actions only |
| `reveals` | `questionId`, `roomId`, `correctIndex`, `sourceQuote`, `distribution` (json) | members | server actions only |

Open decision: one app-wide RecordRoom with `roomId` columns (simpler) vs. a
scope per game room (better isolation). Default: app-wide; revisit if the
docs on scopes make per-room cheap.

## 5. Server actions

| Action | Caller | Does |
|---|---|---|
| `createRoom` | member | Creates room + unique join code |
| `joinRoom` | member | Adds caller to `room_players` (idempotent) |
| `generateQuestions` | host | Wikipedia → Claude → validate → write questions + answer keys |
| `updateQuestion` | host | Edit question / answer key during review |
| `startQuestion` | host | Set current question + deadline, status `live` |
| `submitAnswer` | player | Validate membership, deadline, uniqueness; score on server |
| `revealQuestion` | host | Publish answer, quote and distribution |
| `finishRoom` | host | Status `finished`, final standings |

Every host-only action checks `room.hostId === userId` on the server.

## 6. Integrations

| Integration | Use | Billing |
|---|---|---|
| `wikipedia/search-pages`, `wikipedia/get-page-content` | Grounding source text | developer (owner) |
| `anthropic/chat-completion` | Question generation (structured JSON) | developer (owner), host-only + capped |

---

## 7. Verification checklist (what I check myself, not the agent)

- [ ] Player's WebSocket frames contain no `correctIndex` before reveal.
- [ ] Late `submitAnswer` via curl with a valid token → refused.
- [ ] Duplicate answer → refused.
- [ ] Non-host calling `startQuestion` / `generateQuestions` → refused.
- [ ] Every generated `sourceQuote` appears in the Wikipedia text.
- [ ] Two real accounts: lobby, game, reveal, scoreboard stay in sync.
- [ ] Refresh mid-question restores state.
- [ ] No API keys in client bundle or repo; integrations go through the worker.
- [ ] `npx deepspace test run all` passes; deployed URL works on the same flow.

## 8. Build order (5 days)

| Day | Goal |
|---|---|
| 1 | Schemas, `createRoom` / `joinRoom`, lobby with presence |
| 2 | `generateQuestions` (Wikipedia + Claude + validation), host review screen |
| 3 | `startQuestion` / `submitAnswer` / `revealQuestion`, scoreboard — solo path end to end |
| 4 | Two-player testing, resilience cases (F8), first deploy |
| 5 | Should-haves if time allows, verification checklist, write-up |

## 9. Write-up notes (fill in as we go)

- **Main tradeoff:** answers scored by a server action against a host-only
  answer key, not in the client. Costs a round trip per answer; the only way
  scores are trustworthy, since anything sent to the client can be read.
- **What the agent did:**
- **What I verified / changed myself:**
- **Unfinished + what I'd do next:**
