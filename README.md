# Study Arena

A live multiplayer quiz app for studying, built on [DeepSpace](https://docs.deep.space/).

A host builds a quiz from Wikipedia topics or their own pasted notes. Claude
drafts multiple-choice questions, each with an explanation and the exact
sentence from the source that supports it, and the host approves them. The
host then runs the quiz live: players join with a code, answer against a
countdown, and see the answer, the source and the rankings after each
question.

The server owns the answer key, the clock and the score. Players never
receive the correct answer before the reveal, and answers after the deadline
are refused by the server.

> **Status:** in development. Live URL: _not deployed yet_.

## Features

- Quizzes generated from Wikipedia or pasted notes, with host review and approval
- Rooms with a 6-character join code and share link
- Live lobby with presence
- Server-run game loop: timed questions, one answer per player, pause / skip
- Reveal with answer distribution, explanation and source
- Speed-based scoring, live rankings, final podium

Product requirements: [docs/prd.md](docs/prd.md). Full scope:
[docs/features.md](docs/features.md). Technical design:
[docs/trd.md](docs/trd.md). Data: [docs/schema.md](docs/schema.md).

## Tech stack

DeepSpace SDK on Cloudflare Workers (auth, synced records, permissions,
presence, server actions, background jobs, integrations) · React 19 · Vite ·
TypeScript · Tailwind CSS 4 · Zod · Playwright + Vitest.

Integrations: `anthropic/chat-completion` (question drafting) and
`wikipedia/*` (source text), called from server code through the DeepSpace
integration proxy. No API keys live in this repo or in the browser.

## Quick start

**Prerequisites:** Node 22.15+ or 24.x, npm 11.6+, and a DeepSpace account.

```bash
# 1. Install dependencies
npm install

# 2. Sign in to DeepSpace (opens the browser)
npx deepspace auth login

# 3. Start the local dev server (Vite + local Workers runtime)
npm run dev
```

Local data is stored in `.wrangler/state` and is separate from production.
Delete that folder to start from an empty database.

## Testing

```bash
npm run validate                 # type-check + unit tests
npx deepspace test accounts list # test accounts used by the multi-user tests
npx deepspace test run           # quick Playwright suite against the dev server
npx deepspace test run all       # every spec
```

### Test accounts

Multi-user specs sign in as `@deepspace.test` accounts through the
`deepspace/testing` `users` fixture. Specs that need more accounts than
exist are skipped, and the run says so.

| Accounts | Covers |
|---|---|
| 1 | Owner and host flows (quizzes, rooms) |
| 2 | Another user is refused; lobby join/leave, remove, co-host |
| 3 | Game loop: host + 2 players see identical standings, ties included |

Create them once per machine. The password is read without echo and kept
out of shell history (Git Bash):

```bash
read -rsp "Password: " PW; echo
printf %s "$PW" | npx deepspace test accounts create \
  --email player2@deepspace.test --name "Player Two" --password-stdin
unset PW
```

Repeat with `player3@deepspace.test` / `"Player Three"`. Check them with
`npx deepspace test accounts list --usable`.

- **Where they live:** the account is created on the DeepSpace platform
  (10 per developer), and the CLI saves the credentials locally in
  `~/.deepspace/test-accounts.json`, so the test runner signs in without
  asking.
- **No GUI:** accounts are managed only with the CLI. To check one by hand,
  run `npm run dev`, open `/sign-in` (the email form shows in dev, or add
  `?test=1`) and sign in with it.
- **Another machine:** `npx deepspace test accounts recover --all` fetches
  existing accounts.

## Deploy

```bash
npm run validate
npx deepspace test run all
git commit -am "..."        # deploy records the commit
npx deepspace deploy        # ships to https://<app-name>.app.space
```

## Monitoring

```bash
npx deepspace status                          # live release and environment
npx deepspace releases                        # deploy history
npx deepspace logs --since 1h --level error   # server and browser errors
npx deepspace app usage                       # credit spend
```

Account, apps and billing: [dashboard.deep.space](https://dashboard.deep.space).

## Project structure

```
worker.ts            Worker entry: routes and Durable Objects
src/schemas/         Collections, columns and permissions
src/actions/         Server actions (all game writes go through these)
src/jobs.ts          Background jobs (AI question generation)
src/pages/           Routes (file-based); (app)/(protected)/ requires sign-in
src/components/ui/   UI components
tests/               Playwright specs
docs/                Feature spec and technical design
```
