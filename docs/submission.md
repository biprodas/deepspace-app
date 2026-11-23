# StudyArena — Submission Note

- **Live:** <https://studyarena.app.space/>
- **Repository:** <https://github.com/biprodas/studyarena-ds>

## What I built

A live multiplayer quiz for studying. Claude drafts questions from Wikipedia
topics or pasted notes, each backed by an exact quote from the source, which
the server checks. The host approves the questions and runs a timed game:
players join from their phones with a code, and after each question they
see the answer, why it's right, where it came from, and the rankings.

Around the game, each study group gets a members-only space with live
shared notes (with AI drafting and review), whiteboards with live cursors,
AI mind maps, and polls during games. The owner gets an admin console and
an audit log.

## What I used from DeepSpace

- **Realtime rooms:** `RecordRoom` for all data, `YjsRoom` for notes, `CanvasRoom` for boards, `PresenceRoom` for who's online, reactions and cursors, `JobRoom` for AI generation, and `CronRoom` for audit-log cleanup.
- **Data and permissions:** collection schemas with `uniqueOn`, plus per-record read rules: `'own'` for answer keys and questions, `'team'` for spaces, notes and boards. Every write is server-only.
- **Server actions** for every write, and verified-JWT WebSocket routes that admit only space members.
- **Auth and users:** sign-in, roles and account settings.
- **Tooling:** the build plugin, the multi-account Playwright fixture, and the CLI for dev, test, deploy, releases, logs and rollback.

## Integrations (3)

All three are owner-billed and called only from server code, behind daily
caps:

- **`anthropic/chat-completion`:** drafts questions, mind maps and notes, and reviews notes.
- **`wikipedia/*`:** the source text the questions are grounded in.
- **`email/send`:** invites to a game or space.

**Left out on purpose:**
- **Google Calendar:** an `.ics` file works with any calendar and needs no OAuth.
- **Image generation, voice and payments:** they wouldn't make a sourced question better.

## Main tradeoff

**The server owns the answer, the clock and the score.** Answers and
upcoming questions live in owner-only records. Deadlines are checked with
the server's clock, and scoring happens on the server. That costs a round
trip per answer and more moving parts, but anything sent to a browser can be
read and its clock can be changed, so it's the only way the quiz can't be
cheated. Requiring sign-in for players (no guest join) follows from the same
rule.

## How I worked with the agent

The design and architecture decisions are mine. I wrote the first spec and
the implementation plan, set the core rules (server-owned scoring, owner-only
answer keys, quote-checked AI with host approval), and chose the build
order: the game loop first, AI later, so the core never depended on it.

Claude Code made the right choices easier. It read the SDK and docs, laid
out options and tradeoffs, flagged anything that would break my rules, and
wrote the code and tests to my spec. For example, the ready-made leaderboard
lets users submit their own scores, so I chose one built on the server
instead. Before submitting, I had it review the code, and I decided which
fixes to make.

## What I verified

- **Code review:** reviewed and merged each milestone as a pull request.
- **Hand testing on the live site:** tested the app with two real accounts, including a phone. That's how I found that whiteboard cursors didn't follow the mouse, which I had fixed, with a test.
- **Test suite:** unit tests pass, and the Playwright suite passes (63 tests; 2 paid AI tests skipped).
- **Secrets:** none in the repo; the platform supplies the app's credentials.

## What I'd do next

- **Private games:** make each game readable only by its players (today, room standings are visible to any signed-in user, never answers).
- **Host drops out:** auto-pause the game when the host disconnects.
- **Whiteboard:** connectors that follow shapes, and multi-select.
- **Code:** split the large whiteboard component.

Details: [prd.md](./prd.md) · [features.md](./features.md) ·
[trd.md](./trd.md) · [implementation-plan.md](./implementation-plan.md)
