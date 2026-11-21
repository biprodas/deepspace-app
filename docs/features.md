# Study Arena — Feature Spec

A live multiplayer quiz app for studying. A host builds a quiz from Wikipedia
topics or their own pasted notes: Claude drafts multiple-choice questions, each
with an explanation and the exact supporting sentence, and the host approves
them. The host then runs the quiz live in a room; players compete in real
time, and the server owns the clock, the answer key and the score.

**Core claim to defend:** the client is never trusted with the answer, the
clock, or the score.

**Two entities, on purpose:** a **quiz** is reusable content; a **room** is one
live session of a quiz. AI is only involved in building quizzes, so a live
game never depends on AI availability, and replaying a quiz costs nothing.

---

## 1. Must-have (the important path)

Build these end to end before anything in section 2.

### F1. Auth and identity
- Sign in via DeepSpace auth (scaffold default); display name and avatar come
  from the scaffold's profile.
- **Everyone signs in, players included.** Identity is tied to the account,
  not the browser tab. Guest/nickname join is deliberately left out: an
  anonymous identity can be recreated in a private window, which would let
  one person answer twice.
- "Host" is not an app-wide role; it's per quiz / per room (the creator).
- **Done when:** a signed-out visitor sees the landing page but can't create a
  quiz or join a room.

### F2. Quizzes (build from a source, review, approve)
- Host creates a quiz from either:
  - **1–3 Wikipedia topics:** `wikipedia/search-pages` →
    `wikipedia/get-page-content`, or
  - **Pasted notes** (plain text, length-capped).
- Options: question count (5–10), difficulty (easy / mixed / hard).
- Server action `generateQuestions` calls `anthropic/chat-completion` for
  structured JSON per question:
  `{ prompt, options[4], correctIndex, explanation, sourceQuote }`.
  `sourceUrl` is set by the server from the page it fetched (notes show
  "From your notes" instead of a link).
- **Server-side validation**, per question:
  - correct shape, exactly 4 options, no duplicate options;
  - `correctIndex` in range;
  - `sourceQuote` must appear in the source text (main guard against
    invented facts).
  - Invalid output → retry once → otherwise drop that question and tell the
    host how many were dropped.
- Generated questions are **drafts**; only **approved** questions are
  playable.
- Host can edit text/options/correct answer/explanation, set a time limit
  (10 / 20 / 30 / 60 s), delete, reorder, **regenerate a single question**,
  or add one by hand.
- Answer, explanation and quote live in `answer_keys`, never in
  `questions`. DeepSpace permissions are per record, not per field, so the
  answer has to be in a separate collection players can't read.
- Spend guard: capped questions per call and generation calls per user per
  day.
- Prompt injection: pasted notes are untrusted input. The schema check and
  the quote-in-source check bound what injected instructions can achieve.
- **Done when:** a host turns a topic and a pasted note into approved
  quizzes; a forged edit request from another user is refused.

### F3. Rooms and lobby
- Host opens a room from an approved quiz → unique 6-character join code and
  a share link (`/join/K7QX9P`).
- Players join by code or link; one row per player per room (`uniqueOn`);
  max 50 players per room.
- Lobby: live list of who's in the room and who's online (presence).
- Host controls: start the game, remove a player. A removed player's
  `joinRoom` is refused.
- **Done when:** two accounts in two browsers see each other join and leave
  without refreshing, and a removed player can't get back in.

### F4. Game loop, run by the server
- Room states: `lobby → question → reveal → question → … → final`, plus
  `paused`. All state lives on the room and its current round, so any client can
  rebuild its screen from them.
- **The server owns the clock.** `startQuestion` creates a round with
  `deadline = now + timeLimit`. Clients only draw a countdown toward it,
  corrected by a server-time offset measured on connect.
- `submitAnswer(roundId, choiceIndex)` is refused if:
  - the caller isn't a (non-removed) player, **or is the host** (the host can
    read the answer key);
  - the round isn't the room's current one, or the room isn't in
    `question` state;
  - the server receives it after `deadline` (plus a 300 ms grace for network
    latency, see trd.md §6);
  - the player already answered (`uniqueOn [roundId, userId]`;
    first submission counts).
- Scoring on the server, against `answer_keys`, using the server's receive
  time: correct = `round(1000 × (1 − 0.5 × elapsed / timeLimit))`
  (500–1000); wrong or missing = 0.
- Players see "answer locked in", not correctness, until reveal.
- Host controls: **next**, **skip** (no scoring for that question),
  **pause / resume**, **end early**. Pause stores the remaining time; resume
  sets a fresh deadline from it. Ending early sets the room to `cancelled`
  and keeps the results so far.
- After the final reveal the room goes to `final`.
- **Done when:** a late answer, a second answer, an answer to a non-current
  round, and an answer from the host (all sent with curl and a valid
  token) are refused.

### F5. Reveal
- Allowed only after the deadline. `revealQuestion` fills the round's
  reveal fields: correct option, how many picked each option, explanation, source
  sentence and link. Then it updates `standings`.
- Every client shows the reveal and the updated rankings.
- **Done when:** before reveal, the correct answer appears in no WebSocket
  frame a player receives (checked in DevTools).

### F6. Final screen
- Podium (top 3) and full rankings.
- Each player sees the questions they got wrong, with the correct answer,
  explanation and source.
- Ties broken deterministically: lower total answer time on correct answers,
  then earlier join.
- **Done when:** both browsers show identical standings, ties included.

### F7. Resilience
- Refresh or dropped connection → back in the current state and question,
  with score and locked-in answer intact.
- Disconnected players show as offline; their score stays.
- Late joiners enter at the **next** question; questions already played count
  as 0.
- Host disconnects → players see "host disconnected". The game can't advance
  without the host anyway; the current deadline runs out normally, and the
  host continues on return. (Auto-pausing the timer would need server-side
  presence detection; not worth it.)
- **Done when:** each case is tested with two accounts.

### F8. UI
- Player screens designed for phones first (players join from their phones);
  host screens designed for a laptop/projector.
- Clear error states: generation failed, room full, removed, room finished.

---

## 2. Should-have (day 4, only after section 1 works when deployed)

- **F9. Co-host:** host can add co-hosts who can pause, skip and advance.
  Per-room role, stored as `room.coHostIds` and checked in server actions.
  Co-hosts can't answer.
- **F10. Game history:** past games and results on each user's profile; host
  sees per-question accuracy and the hardest questions.
- **F11. All-time leaderboard** via `npx deepspace add leaderboard`.

## 3. Deliberately left out (explain in the write-up)

| Left out | Why |
|---|---|
| Guest / nickname join | Throwaway identities break one answer per player |
| Voice / reading aloud (ElevenLabs) | Costs per character and doesn't help the core game |
| Payments | Nothing to sell during evaluation |
| Public room browser / matchmaking | Needs moderation; scope without depth |
| Team mode, chat | A different game; chat needs moderation |
| Image / audio questions | Source licensing and extra rendering work |
| File uploads for notes | Pasting text covers the need without file parsing |
| Draft/published states, duplicate quiz, points per question | More forms, no added depth; approval already covers "ready to play" |
| Cron / auto-advance | Host drives the game; deadlines are checked on write, so nothing needs scheduling |

---

## 4. Data model

Tables and fields: [schema.md](./schema.md). Permissions: [trd.md §4](./trd.md#4-data-model).

Key points:
- The answer and explanation live in `answer_keys` (quiz owner only), never
  on `questions`.
- Each question played in a room is a `rounds` record. Its reveal fields stay
  empty until the server fills them after the deadline.
- `answers` are unique per round per player; players read only their own.
- `standings` are recomputed at each reveal, not incremented.
- One app-wide RecordRoom with `roomId` columns; reasoning in
  [trd.md §3](./trd.md#scope-decision-resolves-the-open-question-in-featuresmd).

## 5. Server actions

| Action | Caller | Does |
|---|---|---|
| `generateQuestions` | quiz owner | Source → Claude → validate (retry once) → write draft questions + answer keys |
| `regenerateQuestion` | quiz owner | Replace one question from the same source |
| `updateQuestion` | quiz owner | Edit / approve / reorder a question and its answer key |
| `createRoom` | quiz owner | Room + unique code from an approved quiz |
| `joinRoom` | member | Add caller to `room_players` (idempotent; refuses removed players and full rooms) |
| `removePlayer` | host | Mark a player removed |
| `startQuestion` | host / co-host | New round for the next question + deadline, status `question` |
| `submitAnswer` | player | All F4 checks; score on server |
| `revealQuestion` | host / co-host | Fill the round's reveal fields, recompute standings, `final` after the last question |
| `skipQuestion` | host / co-host | Mark the round skipped, move on without scoring |
| `pauseRoom` / `resumeRoom` | host / co-host | Store the round's remaining time / set a fresh deadline |
| `endRoom` | host | End early: status `cancelled`, keep results so far |

Every host-only action checks the caller against the room on the server.

## 6. Integrations

| Integration | Use | Billing |
|---|---|---|
| `wikipedia/search-pages`, `wikipedia/get-page-content` | Source text for topic quizzes | developer (owner) |
| `anthropic/chat-completion` | Question drafting (structured JSON) | developer (owner), capped |

---

## 7. Verification

**Automated** (`npx deepspace test run all`, two users):
- [ ] Late answer, duplicate answer, non-current-question answer, host answer → refused.
- [ ] Removed player rejoin → refused.
- [ ] Non-owner `generateQuestions` / `updateQuestion` / `startQuestion` → refused.
- [ ] Scoring formula and tie-break give the expected standings.

**By hand** (what I check myself, not the agent):
- [ ] Player's WebSocket frames contain no `correctIndex` before reveal.
- [ ] Every generated `sourceQuote` appears in its source text.
- [ ] Unapproved questions never appear in a game.
- [ ] Two real accounts: lobby, game, reveal, standings stay in sync.
- [ ] Refresh mid-question (player and host) restores state; pause/resume keeps answers working.
- [ ] Player screens usable on a phone.
- [ ] No API keys in client bundle or repo; integrations go through the worker.
- [ ] Deployed URL works on the same flow.

## 8. Build order (5 days)

| Day | Goal |
|---|---|
| 1 | Schemas, quizzes with hand-written questions, `createRoom` / `joinRoom`, lobby with presence |
| 2 | Game loop: start / submit / reveal / skip / pause, standings, final screen — solo path end to end |
| 3 | `generateQuestions` (Wikipedia + notes + Claude + validation), review/approve screen |
| 4 | Two-player tests, resilience (F7), remove player, first deploy; should-haves if time allows |
| 5 | Verification checklist, fixes, write-up |

The game loop is built on hand-written questions first, so AI generation can
slip without breaking the core.

## 9. Write-up notes (fill in as we go)

- **Main tradeoff:** answers scored by a server action against an owner-only
  answer key, using the server's clock. Costs a round trip per answer; the
  only way scores are trustworthy, since anything sent to the client can be
  read and the client's clock can be changed.
- **Second tradeoff:** sign-in required for players instead of guest join.
- **What the agent did:**
- **What I verified / changed myself:**
- **Unfinished + what I'd do next:**
