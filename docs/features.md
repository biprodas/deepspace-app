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
  max 50 players per room. A code can be typed from anywhere: Home's code
  field, or the header's Join (a popover on desktop, the top of the phone
  menu). `/join/:code` tries the code as a game, then as a study space, so
  people don't need to know which kind of code they have.
- Lobby: live list of who's in the room and who's online (presence).
- Start time (optional): the host sets, changes or removes a planned start
  in the lobby (`scheduleRoom`: host only, lobby only, in the future, within
  30 days). Players see a server-synced countdown ("Starts in 12:34 · Today
  at 7:00 PM") and can add the game to their calendar (.ics). When the time
  comes the host is prompted ("It's time: start the game") and players see
  "waiting for the host"; nothing starts by itself, and the host can start
  early. Invites on Home and the space's games list show the start time.
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
- **F11. All-time leaderboard**, kept by the server from final standings
  (not `npx deepspace add leaderboard`, which lets users submit scores;
  see implementation-plan.md M6).
- **F12. Polls, "still confused" and reactions** (added after the first
  release): the host or a co-host opens a poll in a lobby or live game
  (templates: confidence check, ready?, pace; or 2–6 custom options). One poll
  is open at a time. Players vote and can change their vote until it closes;
  votes are private and only the poll's counts are published, recomputed on
  every vote. After a reveal, players can mark "still confused" once per
  question, and the host sees the count. Emoji reactions travel as presence
  state, so nothing is stored and they cover most of what chat would, without
  free text to moderate.
  **Done when:** a player's vote shows in both browsers' counts, a closed poll
  refuses votes, and a host can't vote.
- **F13. Study spaces:** a long-lived home for a study group (`/spaces`).
  The owner creates a space and shares its code or link, or invites by
  account or email (any member can invite). Members see each other live,
  and the space's games; a member can host one of their quizzes "in" the
  space (`rooms.spaceId`). Owners edit, delete, and remove members (who then
  can't rejoin with the code); members leave and may rejoin.
  A space is a DeepSpace *team*: space rows carry `teamId` and are readable
  only by active `team_members` rows (the SDK's `'team'` rule), so
  non-members never receive them. Notes and boards (later) use the same rule.
  Note and board pages open in focus mode, like a live game: a slim space
  bar replaces the app navigation, with the members online and who is in
  the same note or board (locations are presence state, nothing stored).
  The space page itself keeps the app navigation and shows the same stack.
  **Done when:** a non-member gets nothing for a space id, joining by link
  shows it, a removed member loses it and can't rejoin.
- **F14. Shared notes in a space:** members write notes together live
  (Tiptap + Yjs, with each other's cursors; the editor comes from DeepSpace's
  `documents` feature). Note rows are team-scoped like spaces, and the Yjs
  route admits only the space's active members, so leaving or being removed
  cuts editing off too; unknown doc ids are refused. Editing is Notion-style:
  "/" opens a block menu (headings, lists, to-dos, quote, code, divider), a
  handle beside each block adds a block or drags it, and selecting text shows
  a formatting bar; the note is a white page in both colour modes. "Make a quiz" sends the
  note's text to the existing notes generator, so questions stay backed by a
  sentence from the note. In a game hosted in a space, members can "Add to
  notes" on a reveal: the question, answer, explanation and source go into
  that game's session note.
  **AI in a note** (the "AI" menu): *Draft notes from a topic* has Claude
  write study notes from a Wikipedia article (headings, short points, key
  terms, the source linked at the end), added to the note for everyone, and
  undoable. *Review this note* opens a side panel of suggestions (possible
  mistakes, missing points, unclear passages, structure), optionally
  checking facts against a Wikipedia article. The review never changes the
  note by itself: a mistake or unclear passage can come with corrected
  wording, shown before and after, that **Replace** swaps in (one undo
  step); a missing point can be added; any suggestion can show its passage
  or be dismissed. Both are members-only, run on the server, are logged as paid
  calls, and share a limit of 10 a day per person.
  **Done when:** two members see each other's typing, a member who leaves
  gets no note and no socket, and a pinned reveal shows in the session note.
- **F15. Whiteboards and AI mind maps in a space:** members draw together on
  a board (pen, rectangles, ellipses, arrows, lines, text boxes, sticky
  notes; each other's cursors with names), using DeepSpace's `canvas`
  feature. Colour, stroke and fill; resize handles; text written in place;
  duplicate, copy and paste; an eraser that removes whatever it's dragged
  over; "Clear board" (confirmed, with a one-click Restore for 15 seconds);
  rename or delete a board from the space's list (delete: its creator or the
  space owner); one-key tool shortcuts; trackpad and pinch zoom,
  fit to content, and download as PNG. Mouse, pen and touch all draw. A drag
  is sent once when it ends, so it is one step of undo. The room doesn't
  echo a move, resize or edit to its author, so the board keeps its own
  changes over the room's copy until that copy changes. The canvas route admits only
  the board's space members (it used to admit any signed-in user to any id).
  An AI mind map starts from a Wikipedia topic: Claude drafts a root, 4–6
  branches of 1–4 words and 2–4 specific children each; the reply is checked
  and trimmed to fit, repeated labels and quotes not in the article are
  dropped, and the generator's browser lays it out once: balanced left and
  right, cards sized to their measured text (long labels wrap), branches
  spaced by their children so nothing overlaps, curved connectors edge to
  edge, one colour per branch on opaque cards that read in light and dark.
  A mind map opens zoomed to fit; then it's an ordinary board.
  5 mind maps per user per day (credit guard). Lines and arrows don't follow
  shapes that are moved, and only one shape is selected at a time.
  **Done when:** a member's shape appears for the other, a member who leaves
  gets no board and no socket, and a generated map is drawn once.

- **F16. Admin console** (`/admin`, admins only, from the account menu): a
  sidebar of Overview (counts of users, quizzes, games, spaces, notes,
  boards), Users (everyone, searchable, role changes with a confirmation),
  API usage (Claude drafts and tokens, mind maps, Wikipedia lookups, invite
  emails; last 30 days and all time, from the app's own records, since the
  billing ledger isn't readable from the app), Credits (the admin's DeepSpace
  balance, with links to the dashboard) and Data (the JSON export). Numbers
  come from owner-only actions (`adminSummary`, `exportData`).

- **F17. Audit log** (admin console → Audit log): who removed, deleted,
  spent or changed what. Server actions append an entry after moderation
  (space member or game player removed, co-host added or removed),
  deletions (space, quiz, note, board), paid calls (AI quiz drafts, mind
  maps, invite emails as one entry with a count) and the data export. Role
  changes go through the platform, so the console reports them with
  `logRoleChange` (admins only), which marks the entry *verified* when the
  user already has the new role, else *reported by browser*. The
  `audit_log` collection is server-written and admin-read; a daily cron task
  deletes entries older than 90 days. Everyday activity (joining, answering,
  editing) isn't logged.

- **F18. Settings** (`/settings`): Profile (change your name, which is the
  DeepSpace account name shown in every DeepSpace app; email and sign-in
  method shown read-only, since real accounts take them from Google or
  GitHub), Password (email-and-password accounts only; can sign out other
  devices), Devices (signed-in sessions, sign out of the others; these need
  a sign-in from the last day, so an older one sees "Sign in again", which
  comes back to Devices, instead of an empty list), and
  Preferences: theme (system, light, dark) and showing game reactions on
  this device, and invite emails, which sync and which the server honours
  by skipping the email (the in-app invite still arrives). Account changes
  go to the platform auth worker through `/api/auth` (Better Auth).

## 3. Deliberately left out (explain in the write-up)

| Left out | Why |
|---|---|
| Guest / nickname join | Throwaway identities break one answer per player |
| Voice / reading aloud (ElevenLabs) | Costs per character and doesn't help the core game |
| Payments | Nothing to sell during evaluation |
| Public room browser / matchmaking | Needs moderation; scope without depth |
| Team mode, chat | A different game; chat needs moderation (polls and reactions, F12, cover the live feedback without free text) |
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
| `createPoll` / `closePoll` | host / co-host | Open a poll (closing any open one) / close it |
| `votePoll` | player | Cast or change a vote; recompute the poll's counts |
| `flagConfused` | player | Mark a revealed question "still confused"; recompute the round's count |
| `createSpace` / `updateSpace` / `deleteSpace` | member / owner / owner | Space with a join code and the owner's membership / rename / delete with memberships and invites |
| `joinSpace` / `leaveSpace` | member | Join by code (refuses removed members) / leave (can rejoin) |
| `removeMember` | owner | Mark a membership removed |
| `inviteToSpace` | space member | Invite by account or email, as `invitePlayers` does for games |
| `createNote` / `renameNote` | space member | Note row (its text is edited live over Yjs) / rename |
| `deleteNote` | note's author or space owner | Delete a note |
| `sessionNote` | space member | The session note for a game in a space, created on first use |
| `createBoard` / `renameBoard` | space member | Whiteboard row (shapes are drawn live over the canvas route) / rename |
| `createMindMap` | space member | Wikipedia topic → Claude → checked tree, stored on a new board (5 a day) |
| `markMindMapDrawn` | the map's generator | Record that the map was drawn, so it isn't drawn twice |
| `deleteBoard` | board's creator or space owner | Delete a board |

Every host-only action checks the caller against the room on the server.

## 6. Integrations

| Integration | Use | Billing |
|---|---|---|
| `wikipedia/search-pages`, `wikipedia/get-page-content` | Source text for topic quizzes | developer (owner) |
| `anthropic/chat-completion` | Question drafting (structured JSON), mind maps, note drafts and reviews | developer (owner), capped |
| `email/send` | Invite emails for games and study spaces (skipped for people who turned them off) | developer (owner) |

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
