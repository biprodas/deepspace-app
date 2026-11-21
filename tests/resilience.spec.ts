/**
 * Resilience (docs/features.md F7, M5): refresh and dropped connections
 * restore the same state, offline players keep their score, late joiners
 * start at the next question, removal mid-game sticks, and /home leads
 * back into an open game. Questions use the 10 s minimum, so a few tests
 * wait for real deadlines.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { actionsAs, type CallAction } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (host + player)')
test.describe.configure({ timeout: 90_000 })

const GRACE_MS = 300

async function openGame(host: CallAction, questionCount = 2) {
  const { data: quiz } = await host<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Resilience' })
  for (let i = 0; i < questionCount; i++) {
    await host('addQuestion', {
      quizId: quiz!.quizId,
      prompt: `Resilience question ${i + 1}?`,
      options: [`right ${i}`, `wrong a ${i}`, `wrong b ${i}`, `wrong c ${i}`],
      correctIndex: 0,
      timeLimit: 10,
    })
  }
  const { data: room } = await host<{ roomId: string; code: string }>('createRoom', { quizId: quiz!.quizId })
  return room!
}

async function untilRevealable(call: CallAction, deadline: number) {
  const now = (await call('getServerTime')).data!.serverNow
  await new Promise((r) => setTimeout(r, Math.max(0, deadline + GRACE_MS - now) + 150))
}

test('the host refreshes mid-question and while paused and lands in the same state', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, code } = await openGame(host)
  await player('joinRoom', { code })
  await host('startQuestion', { roomId })

  const page = hostUser.page
  await page.goto(`/rooms/${roomId}`)
  await expect(page.getByTestId('round-label')).toHaveText('Question 1 of 2', { timeout: 15_000 })
  await page.reload()
  await expect(page.getByTestId('round-label')).toHaveText('Question 1 of 2', { timeout: 15_000 })
  await expect(page.getByTestId('countdown')).not.toHaveText('0')

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused')).toBeVisible()
  const frozen = await page.getByTestId('countdown').innerText()
  await page.reload()
  await expect(page.getByText('Paused')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1_500)
  expect(await page.getByTestId('countdown').innerText()).toBe(frozen) // still frozen after reload
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByText('Paused')).toHaveCount(0)
})

test('a late joiner sits out the current question, then plays the next', async ({ users }) => {
  const [hostUser, lateUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const late = await actionsAs(lateUser.page)
  const { roomId, code } = await openGame(host)

  const q1 = (await host<{ roundId: string; deadline: number }>('startQuestion', { roomId })).data!
  expect(await late('joinRoom', { code })).toMatchObject({ success: true, data: { role: 'player' } })

  await lateUser.page.goto(`/rooms/${roomId}`)
  await expect(lateUser.page.getByTestId('player-status')).toHaveText('You’re in from the next question', {
    timeout: 15_000,
  })
  await expect(lateUser.page.getByRole('button', { name: /right 0/ })).toBeDisabled()
  expect(await late('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'joined_late',
  })

  await untilRevealable(host, q1.deadline)
  await host('revealQuestion', { roomId })
  await host('startQuestion', { roomId })
  await lateUser.page.getByRole('button', { name: /right 1/ }).click({ timeout: 10_000 })
  await expect(lateUser.page.getByTestId('player-status')).toHaveText('Answer locked in')
})

test('a player removed mid-game is shown out and can no longer answer', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, code } = await openGame(host)
  await player('joinRoom', { code })
  const q1 = (await host<{ roundId: string }>('startQuestion', { roomId })).data!

  await playerUser.page.goto(`/rooms/${roomId}`)
  await expect(playerUser.page.getByTestId('player-game')).toBeVisible({ timeout: 15_000 })
  expect(await host('removePlayer', { roomId, userId: playerUser.userId })).toMatchObject({ success: true })

  await expect(playerUser.page.getByText('You were removed from this game')).toBeVisible({ timeout: 10_000 })
  expect(await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'not_a_player',
  })
})

test('a player who leaves shows offline to the host and keeps their score; /home leads back in', async ({
  users,
}) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, code } = await openGame(host)
  await player('joinRoom', { code })
  const q1 = (await host<{ roundId: string; deadline: number }>('startQuestion', { roomId })).data!
  await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })

  // The player wanders off to /home, where the open game is listed.
  await playerUser.page.goto('/home')
  const row = playerUser.page.getByTestId('your-games').getByRole('link', { name: new RegExp(code) })
  await expect(row).toContainText('Rejoin', { timeout: 15_000 })

  await untilRevealable(host, q1.deadline)
  await host('revealQuestion', { roomId })
  await hostUser.page.goto(`/rooms/${roomId}`)
  const standing = hostUser.page.getByTestId('standing-row').first()
  await expect(standing.getByTestId('standing-offline')).toBeVisible({ timeout: 15_000 })
  await expect(standing.getByTestId('standing-score')).not.toHaveText('0')

  // Back in through /home: same game, same score, now online.
  await row.click()
  await expect(playerUser.page).toHaveURL(new RegExp(`/rooms/${roomId}$`))
  await expect(playerUser.page.getByTestId('player-status')).toContainText('Correct!', { timeout: 15_000 })
  await expect(standing.getByTestId('standing-offline')).toHaveCount(0, { timeout: 15_000 })
})

test('a dropped connection shows a banner and recovers on its own', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, code } = await openGame(host)
  await player('joinRoom', { code })

  // Pass the records socket through so the test can cut it, as a flaky
  // phone connection would; reconnects pass through untouched.
  const sockets: { close: (o?: { code?: number; reason?: string }) => Promise<void> }[] = []
  let refuse = false
  await playerUser.page.routeWebSocket(/\/ws\/app[^/]*$/, (ws) => {
    if (refuse) return void ws.close({ code: 4000, reason: 'test: offline' })
    ws.connectToServer()
    sockets.push(ws)
  })

  await playerUser.page.goto(`/rooms/${roomId}`)
  await expect(playerUser.page.getByText(/You’re in/)).toBeVisible({ timeout: 15_000 })

  refuse = true
  await Promise.all(sockets.map((ws) => ws.close({ code: 4000, reason: 'test: dropped' })))
  await expect(playerUser.page.getByTestId('connection-banner')).toBeVisible({ timeout: 20_000 })
  // The last screen stays up under the banner instead of blanking to "Loading".
  await expect(playerUser.page.getByText(/You’re in/)).toBeVisible()
  // The host moves on while the player is away.
  await host('startQuestion', { roomId })
  refuse = false

  await expect(playerUser.page.getByTestId('connection-banner')).toHaveCount(0, { timeout: 30_000 })
  await expect(playerUser.page.getByTestId('player-game')).toBeVisible({ timeout: 15_000 })
})
