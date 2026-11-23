# Study Arena — Product Requirements (PRD)

| | |
|---|---|
| **Status** | Live at [studyarena.app.space](https://studyarena.app.space/) since 2026-11-23 |
| **Owner** | Biprodas Roy |
| **Context** | DeepSpace build exercise, 5-day submission window |
| **Related** | [features.md](./features.md) (feature spec) · [trd.md](./trd.md) (technical design) · [schema.md](./schema.md) (data) |

---

## 1. Summary

Study Arena turns study material into a live multiplayer quiz. A host picks
Wikipedia topics or pastes their own notes; Claude drafts multiple-choice
questions, each backed by an exact sentence from the source; the host
approves them and runs a timed game for a group. After every question,
players see the answer, why it's right, and where it came from.

After the first release it grew into a place where a study group keeps
working between games: a members-only **study space** per group, with
**shared notes** written together live, **whiteboards**, and **AI mind maps**
drafted from a Wikipedia topic. During a game, hosts can run **polls** and
players can flag a question they're **still confused** about. An **admin
console** and **audit log** let the owner run the app, and **settings** let
each person manage their account.

## 2. Problem

Group study sessions and classrooms use live quizzes (Kahoot, Quizizz) to keep
people engaged, but:

1. **Writing good questions takes time.** A host preparing a 10-question quiz
   on a new topic spends 30–60 minutes on it.
2. **AI-generated quizzes can't be trusted as-is.** Generic AI question
   generators invent facts and give no way to check them.
3. **Trivia isn't studying.** Most live quiz tools show right/wrong and move
   on; players don't learn *why* or where to read more.

## 3. Target users

| User | Need | Example |
|---|---|---|
| **Host** (primary) | Build a trustworthy quiz fast and run it for a group | A study-group organiser before an exam; a tutor running a revision session |
| **Player** | Join quickly from a phone, compete fairly, learn from mistakes | A student in that group |
| **Study group member** | One place for the group's notes, sketches and games, private to the group | The same students between sessions, revising together |
| **App owner / admin** | See who uses the app, what it costs, and what was removed or changed | The person who deployed StudyArena |

Out of scope as users: schools buying seats, public audiences, solo
self-study without a host.

## 4. Goals and non-goals

**Goals**
- G1. A host goes from topic or notes to a playable, reviewed quiz in under
  5 minutes.
- G2. Every question is traceable to a sentence in its source.
- G3. The game is fair: nobody can see the answer early, answer late, or
  answer twice.
- G4. Players leave knowing which questions they got wrong and why.
- G5. Ship a working, deployed core within 5 days, and explain the
  tradeoffs honestly.
- G6. A study group keeps studying between games in one members-only
  space: notes, boards and mind maps that turn back into quizzes.
- G7. The owner can see usage and AI spend, and every removal, deletion,
  paid call and role change is recorded.

**Non-goals**
- Competing with Kahoot on breadth (question types, themes, media).
- Monetisation, public discovery, or open social features. (Private study
  spaces for a known group, with polls and reactions, were added after the
  first release; see features.md F12–F15. There's still no public feed,
  following, or free-text chat.)
- Voice or video calls in a space.
- Self-paced or asynchronous quizzes.
- Fully automatic quizzes with no human review.

## 5. User stories

**Host**
- H1. As a host, I enter 1–3 Wikipedia topics or paste notes and get draft
  questions, so I don't write them from scratch.
- H2. As a host, I see the source sentence behind each draft, so I can check
  it quickly.
- H3. As a host, I edit, delete, regenerate or approve each question, so only
  questions I trust are played.
- H4. As a host, I open a room and share a code or link, so players can join
  in seconds.
- H5. As a host, I see who has joined, and can remove someone who shouldn't
  be there.
- H6. As a host, I control the pace (next, reveal, skip, pause, end), so the
  game fits the session.
- H7. As a host, I reuse a quiz in a new room, so I prepare once and run it
  for several groups.

**Player**
- P1. As a player, I join with a code or link on my phone.
- P2. As a player, I see each question with a countdown and lock in one
  answer.
- P3. As a player, after each question I see the right answer, the
  explanation, the source, how others answered, and the rankings.
- P4. As a player, if my connection drops or I refresh, I'm back where I was
  with my answer and score intact.
- P5. As a player, at the end I see the podium and a list of the questions I
  got wrong, with sources to read.

**Study group** (added after the first release)
- S1. As a group organiser, I create a study space and share its code or
  link, or invite people I've played with, so the group has one home.
- S2. As a member, I write notes together with the group live, and turn a
  note into a quiz in one click.
- S2a. As a member, I have AI draft notes from a topic, or review my note
  and suggest improvements without changing it.
- S3. As a member, I sketch on a whiteboard with the group (pen, shapes,
  arrows, sticky notes), and erase or clear it when we're done.
- S4. As a member, I generate a mind map from a Wikipedia topic and edit it
  like any board.
- S5. As a host, I run a quick poll during a game; as a player, I flag a
  revealed question I'm still confused about, and pin it into the game's
  notes.
- S6. As the space owner, I remove a member, who then loses access to
  everything in the space.

**Owner and account**
- A1. As the app owner, I see users, AI usage, credits and the data, and
  change someone's role.
- A2. As an admin, I read an audit log of removals, deletions, paid calls
  and role changes.
- U1. As anyone, I change my name and password, sign out other devices, and
  choose my theme and email preferences.

Detailed requirements and acceptance criteria per story:
[features.md §1](./features.md#1-must-have-the-important-path).

## 6. Core user flow

```
Host:   sign in → new quiz (topics or notes) → review & approve → open room
                                                                     │ share code
Player: sign in → join with code ─────────────────────────────► lobby
                                                                     │
        ┌──────────── question (timed) → reveal (answer, source, rankings) ◄─┐
        └──────────────────────────────────────────── next ───────────────────┘
                                                                     │
                                          final: podium + "what I got wrong"
```

Between games, in a study space:

```
Owner:  create space → share code / invite ──► members join
Member: notes (live) ──"Make a quiz"──► quiz → game in the space
        boards / AI mind maps          reveal ──"Add to notes"──► session note
```

## 7. Scope

| Priority | Scope |
|---|---|
| **Must (P0)** | Sign-in; AI quiz drafting from Wikipedia or notes with source check; host review and approval; rooms with code/link; live lobby; server-run game loop (timer, one answer, pause/skip/end); reveal with explanation and source; speed-based scoring; final screen with wrong answers; reconnect and late join |
| **Should (P1)** | Co-host role; game history; all-time leaderboard |
| **Added after the first release** | Polls, "still confused" flags and reactions; study spaces; shared notes; whiteboards and AI mind maps; admin console; audit log; account settings; a Join box in the header for game or space codes |
| **Won't (this version)** | Guest join, voice, payments, public room browser, teams, chat, image/audio questions, file uploads, extra question types |

Reasons for each "won't": [features.md §3](./features.md#3-deliberately-left-out-explain-in-the-write-up).

## 8. Success metrics

For an evaluation build these are checked by hand during testing, not
tracked in production.

| Metric | Target |
|---|---|
| Time from topic to approved 10-question quiz | < 5 min |
| Generated questions whose source sentence is found in the source | 100% (enforced) |
| Generated questions the host approves without edits | ≥ 70% on 5 test topics |
| Correct answer visible to players before reveal | Never (checked in DevTools) |
| Late, duplicate or host answers accepted | 0 (automated tests) |
| Two players see identical standings after each reveal | Always |
| Player state restored after refresh mid-question | Always |
| A non-member, or a removed member, receives anything from a space | Never (automated tests) |
| Generated mind maps with overlapping cards | 0 (layout unit test) |

## 9. Key product decisions

| Decision | Why | Cost |
|---|---|---|
| Server owns the answer key, clock and score | Only way scores are trustworthy | A server round trip per answer |
| Host must approve every AI question | AI drafts, human decides; catches bad questions | One extra step before playing |
| Source sentence required for every question | Makes made-up questions detectable and teaches where facts come from | Some valid questions get dropped |
| Everyone signs in, no guest join | One person can't answer twice under two identities | More friction to join |
| Quizzes separate from rooms | Reuse a quiz; the live game never depends on AI being available | Two concepts to explain in the UI |
| Host drives the pace (no auto-advance) | Fits teaching sessions; simpler and predictable | The host must stay present |
| Spaces are members-only, enforced by the server | A group's notes and boards are private by default | Joining needs a code, link or invite |
| Mind maps are drawn once, then are ordinary boards | Members edit freely; no second AI call | Regenerating means a new board |
| Audit log written only by the server, read only by admins | A record nobody in the app can rewrite | Pruned after 90 days to keep it small |

## 10. Assumptions and dependencies

- Players have a phone or laptop and a DeepSpace-supported sign-in.
- Wikipedia, Claude and email (invites) are reached through DeepSpace
  integrations, billed to the app owner's credits. An invite email costs
  about $0.013; people can turn invite emails off.
- Groups are small: up to 50 players per room.
- Content is English-first; Claude may handle other languages, but this
  isn't tested.

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| AI questions are weak or wrong | Host loses trust | Source check, validation, retry, host approval |
| Wikipedia text is noisy, so source checks fail | Fewer usable questions | Clean HTML to text; normalise before matching |
| Sign-in friction for players | Slower joins | Share link goes straight to sign-in, then the room |
| Realtime edge cases (refresh, late join, host drop) | Broken games | State lives on the server; tested with two accounts |
| AI cost per quiz | Owner credit drain | Per-call and per-user daily caps (10 quiz drafts, 5 mind maps and 10 AI note uses a day) |
| A space's data leaks to non-members | Private notes exposed | The `'team'` read rule, plus membership checks on the notes and boards connections; tested |
| 5-day window | Unfinished core | Game loop built first on hand-written questions; AI added on Day 3 |

## 12. Open questions

- ~~Does the DeepSpace dashboard have a data viewer?~~ Settled: the app has
  its own owner-only admin console (`/admin`, trd.md §13 and §16).
- ~~GitHub or DeepSpace as the source repository?~~ Settled: GitHub (trd.md
  §12).
- What does the Anthropic integration return for token usage? Determines
  whether `generations` can record cost.
