/**
 * The game loop (docs/features.md F4–F6, M3). The core claim under test:
 * the client is never trusted with the answer, the clock or the score.
 *
 * Questions use the shortest time limit (10 s), so a few tests wait for
 * real deadlines.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { actionsAs, type CallAction } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (host + player)')
test.describe.configure({ timeout: 90_000 })

const LIMIT_MS = 10_000
const GRACE_MS = 300

/** A quiz whose prompts and explanations are unique strings we can look for on the wire. */
async function setUpGame(host: CallAction, players: CallAction[], questionCount = 2) {
  const secret = `secret-${Date.now()}-${Math.random().toString(36).slice(2)}`
  // Separate from `secret`, so a prompt never matches the explanation checks.
  const tag = `prompt-${Math.random().toString(36).slice(2)}`
  const { data: quiz } = await host<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Game test' })
  for (let i = 0; i < questionCount; i++) {
    await host('addQuestion', {
      quizId: quiz!.quizId,
      prompt: `Question ${i + 1}? (${tag}-${i + 1})`,
      options: [`right ${i}`, `wrong a ${i}`, `wrong b ${i}`, `wrong c ${i}`],
      correctIndex: 0,
      explanation: `${secret} explanation ${i + 1}`,
      timeLimit: LIMIT_MS / 1000,
    })
  }
  const { data: room } = await host<{ roomId: string; code: string }>('createRoom', { quizId: quiz!.quizId })
  for (const join of players) await join('joinRoom', { code: room!.code })
  return { quizId: quiz!.quizId, roomId: room!.roomId, code: room!.code, secret, prompt: (n: number) => `${tag}-${n}` }
}

async function start(host: CallAction, roomId: string) {
  const res = await host<{ roundId: string; deadline: number }>('startQuestion', { roomId })
  expect(res, 'startQuestion').toMatchObject({ success: true })
  return res.data!
}

/** Waits until the server would accept a reveal for this round. */
async function untilRevealable(deadline: number, serverNow: number) {
  await new Promise((r) => setTimeout(r, Math.max(0, deadline + GRACE_MS - serverNow) + 150))
}

/** Rank, name and score per row, as rendered (the viewer's own "you" label left out). */
async function readStandings(page: Page) {
  return page.getByTestId('standing-row').evaluateAll((rows) =>
    rows.map((row) =>
      ['standing-name', 'standing-score']
        .map((id) => row.querySelector(`[data-testid="${id}"]`)?.textContent?.trim())
        .join(' | '),
    ),
  )
}

function recordFrames(page: Page): string[] {
  const frames: string[] = []
  page.on('websocket', (ws) => ws.on('framereceived', (f) => frames.push(String(f.payload))))
  return frames
}

test('every forged or late move is refused by the server', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId } = await setUpGame(host, [player])

  expect(await player('startQuestion', { roomId })).toMatchObject({ success: false, code: 'forbidden' })

  const q1 = await start(host, roomId)
  expect(await host('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'host_cannot_answer',
  })
  expect(await host('revealQuestion', { roomId })).toMatchObject({ success: false, code: 'too_early' })
  expect(await player('revealQuestion', { roomId })).toMatchObject({ success: false, code: 'forbidden' })

  const first = await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })
  expect(first).toMatchObject({ success: true, data: { locked: true } })
  expect(first.data).not.toHaveProperty('correct') // correctness waits for the reveal
  expect(await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 1 })).toMatchObject({
    success: false,
    code: 'already_answered',
  })

  await untilRevealable(q1.deadline, first.data!.serverNow)
  expect(await host('revealQuestion', { roomId })).toMatchObject({ success: true, data: { status: 'reveal' } })
  expect(await host('revealQuestion', { roomId })).toMatchObject({ success: false, code: 'invalid_state' })

  const q2 = await start(host, roomId)
  expect(await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'not_current',
  })

  // Late: after deadline + grace, by the server's clock.
  const now = (await player('getServerTime')).data!.serverNow
  await untilRevealable(q2.deadline, now)
  expect(await player('submitAnswer', { roundId: q2.roundId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'too_late',
  })

  expect(await host('revealQuestion', { roomId })).toMatchObject({ success: true, data: { status: 'final' } })
  expect(await host('startQuestion', { roomId })).toMatchObject({ success: false, code: 'invalid_state' })
})

test('the answer is in no frame a player receives before the reveal', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, secret } = await setUpGame(host, [player], 1)

  const frames = recordFrames(playerUser.page)
  await playerUser.page.goto(`/rooms/${roomId}`)
  await expect(playerUser.page.getByText(/You’re in/)).toBeVisible({ timeout: 15_000 })

  const q1 = await start(host, roomId)
  await expect(playerUser.page.getByTestId('player-game')).toBeVisible({ timeout: 10_000 })
  await playerUser.page.getByRole('button', { name: /right 0/ }).click()
  await expect(playerUser.page.getByTestId('player-status')).toHaveText('Answer locked in')

  // Before reveal: no explanation and no correctIndex value anywhere on the wire.
  const before = frames.join('\n')
  expect(before).not.toContain(secret)
  expect(before).not.toMatch(/"correctIndex":\s*\d/)

  const { serverNow } = (await player('getServerTime')).data!
  await untilRevealable(q1.deadline, serverNow)
  await host('revealQuestion', { roomId })

  // After: it arrives, on the round.
  await expect(playerUser.page.getByTestId('final-screen')).toBeVisible({ timeout: 10_000 })
  expect(frames.join('\n')).toContain(secret)
})

test('a player answers on screen, keeps it through a refresh, and both sides agree at the end', async ({
  users,
}) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId } = await setUpGame(host, [player], 1)

  await Promise.all([hostUser.page.goto(`/rooms/${roomId}`), playerUser.page.goto(`/rooms/${roomId}`)])
  await hostUser.page.getByRole('button', { name: 'Start game' }).click({ timeout: 15_000 })

  await expect(hostUser.page.getByTestId('host-game')).toBeVisible({ timeout: 10_000 })
  await playerUser.page.getByRole('button', { name: /right 0/ }).click({ timeout: 10_000 })
  await expect(playerUser.page.getByTestId('player-status')).toHaveText('Answer locked in')

  await playerUser.page.reload()
  await expect(playerUser.page.getByTestId('player-status')).toHaveText('Answer locked in', { timeout: 15_000 })

  // The host's reveal button unlocks when the server would accept it.
  const reveal = hostUser.page.getByRole('button', { name: 'Reveal answer' })
  await expect(reveal).toBeDisabled()
  await expect(reveal).toBeEnabled({ timeout: LIMIT_MS + 3_000 })
  await reveal.click()

  for (const page of [hostUser.page, playerUser.page]) {
    await expect(page.getByTestId('final-screen')).toBeVisible({ timeout: 10_000 })
  }
  await expect.poll(() => readStandings(playerUser.page)).toEqual(await readStandings(hostUser.page))
  await expect(playerUser.page.getByTestId('missed-questions')).toContainText('every question right')
})

test('pause freezes answers, resume restores them, skip scores nothing', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId } = await setUpGame(host, [player], 2)

  const q1 = await start(host, roomId)
  expect(await host('pauseRoom', { roomId })).toMatchObject({ success: true })
  expect(await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'not_accepting',
  })
  expect(await host('resumeRoom', { roomId })).toMatchObject({ success: true })
  expect(await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })).toMatchObject({ success: true })

  // Skipping Q1 drops its (correct) answer from scoring and starts Q2.
  expect(await host('skipQuestion', { roomId })).toMatchObject({ success: true, data: { status: 'question' } })
  expect(await host('skipQuestion', { roomId })).toMatchObject({ success: true, data: { status: 'final' } })

  await playerUser.page.goto(`/rooms/${roomId}`)
  await expect(playerUser.page.getByTestId('standing-score')).toHaveText('0', { timeout: 15_000 })
})

test.describe('three accounts', () => {
  test.skip(accounts < 3, 'Needs 3 test accounts (host + 2 players)')

  test('two players see identical standings, ties broken the same way', async ({ users }) => {
    const [hostUser, aUser, bUser] = await users(3)
    const host = await actionsAs(hostUser.page)
    const a = await actionsAs(aUser.page)
    const b = await actionsAs(bUser.page)
    const { roomId } = await setUpGame(host, [a, b], 1)

    await Promise.all([aUser.page.goto(`/rooms/${roomId}`), bUser.page.goto(`/rooms/${roomId}`)])
    const q1 = await start(host, roomId)
    // Both wrong: a 0–0 tie, broken by join order (A joined first).
    await a('submitAnswer', { roundId: q1.roundId, choiceIndex: 1 })
    const res = await b('submitAnswer', { roundId: q1.roundId, choiceIndex: 2 })
    await untilRevealable(q1.deadline, res.data!.serverNow)
    await host('revealQuestion', { roomId })

    await expect(aUser.page.getByTestId('final-screen')).toBeVisible({ timeout: 10_000 })
    await expect(bUser.page.getByTestId('final-screen')).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => readStandings(bUser.page)).toEqual(await readStandings(aUser.page))
    const names = await aUser.page.getByTestId('standing-name').allInnerTexts()
    expect(names).toHaveLength(2)
    expect(names[0]).toContain(aUser.name ?? '')
  })
})

test('a player receives no question before it is asked', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, prompt } = await setUpGame(host, [player], 2)

  const frames = recordFrames(playerUser.page)
  await playerUser.page.goto(`/rooms/${roomId}`)
  await expect(playerUser.page.getByText(/You’re in/)).toBeVisible({ timeout: 15_000 })
  const wire = () => frames.join('\n')
  // In the lobby: neither question has reached the player.
  expect(wire()).not.toContain(prompt(1))
  expect(wire()).not.toContain(prompt(2))

  // Round 1: its question arrives on the round, the next one still doesn't.
  const q1 = await start(host, roomId)
  await expect(playerUser.page.getByText(prompt(1))).toBeVisible({ timeout: 10_000 })
  // The count comes from the round too: the player has no question rows to count.
  await expect(playerUser.page.getByText('Question 1 of 2', { exact: true })).toBeVisible()
  expect(wire()).not.toContain(prompt(2))

  const { serverNow } = (await player('getServerTime')).data!
  await untilRevealable(q1.deadline, serverNow)
  expect(await host('revealQuestion', { roomId })).toMatchObject({ success: true, data: { status: 'reveal' } })
  expect(wire()).not.toContain(prompt(2))

  await start(host, roomId)
  await expect(playerUser.page.getByText(prompt(2))).toBeVisible({ timeout: 10_000 })
})
