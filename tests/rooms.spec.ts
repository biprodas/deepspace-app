/**
 * Rooms and lobby (docs/features.md F3, M2). The two-account tests are the
 * F3 "done when": two browsers see each other join and leave without a
 * refresh, and a removed player can't get back in.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { actionsAs, type CallAction } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 1, 'Needs a test account: npx deepspace test accounts create …')

const QUESTION = {
  prompt: 'Which gas do plants release?',
  options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'],
  correctIndex: 0,
}

/** A quiz with one approved question, and a room for it. */
async function openRoom(call: CallAction) {
  const { data: quiz } = await call<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Lobby test' })
  await call('addQuestion', { quizId: quiz!.quizId, ...QUESTION })
  const room = await call<{ roomId: string; code: string }>('createRoom', { quizId: quiz!.quizId })
  expect(room).toMatchObject({ success: true })
  return { quizId: quiz!.quizId, ...room.data! }
}

const lobbyPlayer = (page: Page, name?: string) =>
  name ? page.getByTestId('lobby-player').filter({ hasText: name }) : page.getByTestId('lobby-player')

test('host opens a room and gets a readable code', async ({ users }) => {
  const [host] = await users(1)
  const call = await actionsAs(host.page)
  const { roomId, code, quizId } = await openRoom(call)
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)

  // Joining your own room is not playing in it.
  expect(await call('joinRoom', { code: code.toLowerCase() })).toMatchObject({
    success: true,
    data: { roomId, role: 'host' },
  })

  await host.page.goto(`/rooms/${roomId}`)
  await expect(host.page.getByTestId('room-code')).toHaveText(code, { timeout: 15_000 })
  await expect(host.page.getByTestId('player-count')).toHaveText('0 / 50 players')

  // Questions are frozen while the room is open (renaming is still fine).
  expect(await call('addQuestion', { quizId, ...QUESTION })).toMatchObject({
    success: false,
    code: 'quiz_in_play',
  })
})

test('hosting the same quiz again returns the open game instead of a second room', async ({ users }) => {
  const [host] = await users(1)
  const call = await actionsAs(host.page)
  const first = await openRoom(call)

  const again = await call<{ roomId: string; code: string; reused: boolean }>('createRoom', { quizId: first.quizId })
  expect(again).toMatchObject({ success: true, data: { roomId: first.roomId, code: first.code, reused: true } })

  await host.page.goto(`/quizzes/${first.quizId}`)
  await expect(host.page.getByRole('button', { name: `Back to your game · ${first.code}` })).toBeVisible({
    timeout: 15_000,
  })

  // Once it ends, hosting again opens a fresh room.
  await call('endRoom', { roomId: first.roomId })
  const fresh = await call<{ roomId: string; reused: boolean }>('createRoom', { quizId: first.quizId })
  expect(fresh).toMatchObject({ success: true, data: { reused: false } })
  expect(fresh.data!.roomId).not.toBe(first.roomId)
})

test('a live room hides the app navigation behind a slim bar, and gives it back after', async ({ users }) => {
  const [host] = await users(1)
  const call = await actionsAs(host.page)
  const { roomId, code, quizId } = await openRoom(call)
  const page = host.page

  await page.goto(`/rooms/${roomId}`)
  await expect(page.getByTestId('focus-bar')).toContainText(code, { timeout: 15_000 })
  await expect(page).toHaveTitle(`Lobby ${code} · StudyArena`)
  await expect(page.getByTestId('app-navigation')).toHaveCount(0)

  // Leaving asks first; "Stay" keeps the room.
  const exit = page.getByTestId('focus-bar').getByRole('link', { name: /Exit to quiz/ })
  await exit.click()
  await page.getByRole('button', { name: 'Stay' }).click()
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}$`))
  await expect(page.getByTestId('focus-bar')).toBeVisible()

  // Confirming leaves, and the normal chrome comes back.
  await exit.click()
  await page.getByRole('button', { name: 'Leave' }).click()
  await expect(page).toHaveURL(new RegExp(`/quizzes/${quizId}$`))
  await expect(page.getByTestId('app-navigation')).toBeVisible()

  // A finished game's results keep the navigation.
  await call('endRoom', { roomId })
  await page.goto(`/rooms/${roomId}`)
  await expect(page.getByTestId('final-screen')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('app-navigation')).toBeVisible()
  await expect(page.getByTestId('focus-bar')).toHaveCount(0)
})

test('ending a game closes the code and unfreezes the quiz', async ({ users }) => {
  const [host] = await users(1)
  const call = await actionsAs(host.page)
  const { roomId, code, quizId } = await openRoom(call)

  await host.page.goto(`/quizzes/${quizId}`)
  await expect(host.page.getByRole('link', { name: new RegExp(code) })).toBeVisible({ timeout: 15_000 })

  await host.page.goto(`/rooms/${roomId}`)
  await host.page.getByRole('button', { name: 'End game' }).click({ timeout: 15_000 })
  await host.page.getByRole('dialog').getByRole('button', { name: 'End game' }).click()
  await expect(host.page).toHaveURL(new RegExp(`/quizzes/${quizId}$`))
  await expect(host.page.getByRole('link', { name: new RegExp(code) })).toHaveCount(0)

  expect(await call('endRoom', { roomId })).toMatchObject({ success: false, code: 'room_closed' })
  expect(await call('addQuestion', { quizId, ...QUESTION })).toMatchObject({ success: true })
  expect(await call('deleteQuiz', { quizId })).toMatchObject({ success: true })
})

test('a room needs an approved question, and codes must be real', async ({ users }) => {
  const [host] = await users(1)
  const call = await actionsAs(host.page)
  const { data } = await call<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Empty' })
  expect(await call('createRoom', { quizId: data!.quizId })).toMatchObject({
    success: false,
    code: 'no_approved_questions',
  })
  expect(await call('joinRoom', { code: 'nope' })).toMatchObject({ success: false, code: 'invalid_code' })
  expect(await call('joinRoom', { code: 'ZZZZZZ' })).toMatchObject({ success: false, code: 'not_found' })
  await call('deleteQuiz', { quizId: data!.quizId })
})

test.describe('two accounts', () => {
  test.skip(accounts < 2, 'Needs 2 test accounts')

  test('players appear live, show offline when they leave, and a removed player stays out', async ({
    users,
  }) => {
    const [host, player] = await users(2)
    const asHost = await actionsAs(host.page)
    const asPlayer = await actionsAs(player.page)
    const { roomId, code, quizId } = await openRoom(asHost)

    await host.page.goto(`/rooms/${roomId}`)
    await expect(host.page.getByTestId('room-code')).toHaveText(code, { timeout: 15_000 })

    // The share link joins and lands in the lobby.
    await player.page.goto(`/join/${code}`)
    await expect(player.page).toHaveURL(new RegExp(`/rooms/${roomId}$`), { timeout: 15_000 })
    await expect(player.page.getByText(/You’re in/)).toBeVisible()

    // The host sees them arrive, online, without a refresh.
    await expect(lobbyPlayer(host.page)).toHaveCount(1, { timeout: 10_000 })
    await expect(lobbyPlayer(host.page)).toHaveAttribute('data-online', 'true', { timeout: 10_000 })
    await expect(host.page.getByTestId('player-count')).toHaveText('1 / 50 players')

    // Joining again is idempotent.
    expect(await asPlayer('joinRoom', { code })).toMatchObject({ success: true, data: { roomId, role: 'player' } })
    await expect(lobbyPlayer(host.page)).toHaveCount(1)

    // Leaving: still in the room, shown offline.
    await player.page.goto('/home')
    await expect(lobbyPlayer(host.page)).toHaveAttribute('data-online', 'false', { timeout: 15_000 })

    // Host-only controls are refused for the player.
    const playerId = player.userId
    expect(await asPlayer('createRoom', { quizId })).toMatchObject({ success: false, code: 'forbidden' })

    // Remove → gone from the lobby, and the player can't come back.
    await player.page.goto(`/rooms/${roomId}`)
    await host.page.getByRole('button', { name: /^Options for / }).click()
    await host.page.getByRole('menuitem', { name: 'Remove from game' }).click()
    await host.page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(lobbyPlayer(host.page)).toHaveCount(0, { timeout: 10_000 })
    await expect(player.page.getByText('You were removed from this game')).toBeVisible({ timeout: 10_000 })
    expect(await asPlayer('joinRoom', { code })).toMatchObject({ success: false, code: 'removed' })
    if (playerId) {
      expect(await asPlayer('removePlayer', { roomId, userId: playerId })).toMatchObject({
        success: false,
        code: 'forbidden',
      })
    }
  })

  test('the host can promote a lobby player to co-host', async ({ users }) => {
    const [host, player] = await users(2)
    const asHost = await actionsAs(host.page)
    const asPlayer = await actionsAs(player.page)
    const { roomId, code } = await openRoom(asHost)

    await asPlayer('joinRoom', { code })
    await host.page.goto(`/rooms/${roomId}`)
    await host.page.getByRole('button', { name: /^Options for / }).click({ timeout: 15_000 })
    await host.page.getByRole('menuitem', { name: 'Make co-host' }).click()
    await expect(lobbyPlayer(host.page)).toHaveCount(0, { timeout: 10_000 })
    await expect(host.page.getByRole('heading', { name: 'Co-hosts' })).toBeVisible()

    expect(await asPlayer('joinRoom', { code })).toMatchObject({ success: true, data: { role: 'host' } })
    await player.page.goto(`/rooms/${roomId}`)
    await expect(player.page.getByText('You’re a co-host')).toBeVisible({ timeout: 15_000 })
  })
})

test('a start time: only the host sets it, players see a countdown, it can be removed, and the host still starts', async ({
  users,
}) => {
  test.skip(accounts < 2, 'Needs 2 test accounts (host + player)')
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, code } = await openRoom(host)
  await player('joinRoom', { code })

  // The server's rules: host only, in the future, within 30 days.
  const inAnHour = Date.now() + 60 * 60_000
  expect(await player('scheduleRoom', { roomId, at: inAnHour })).toMatchObject({ success: false, code: 'forbidden' })
  expect(await host('scheduleRoom', { roomId, at: Date.now() - 60_000 })).toMatchObject({ success: false, code: 'invalid_params' })
  expect(await host('scheduleRoom', { roomId, at: Date.now() + 31 * 24 * 60 * 60_000 })).toMatchObject({
    success: false,
    code: 'invalid_params',
  })

  // The host sets it from the lobby ("In 1 hour"); the player sees the countdown live.
  await hostUser.page.setViewportSize({ width: 1280, height: 900 })
  await hostUser.page.goto(`/rooms/${roomId}`)
  await hostUser.page.getByTestId('schedule-open').click({ timeout: 15_000 })
  await hostUser.page.getByRole('button', { name: 'In 1 hour' }).click()
  await hostUser.page.getByTestId('schedule-save').click()
  await expect(hostUser.page.getByTestId('start-countdown')).toContainText('Starts in')
  await playerUser.page.goto(`/rooms/${roomId}`)
  const countdown = playerUser.page.getByTestId('start-countdown')
  await expect(countdown).toHaveAttribute('data-state', 'upcoming', { timeout: 15_000 })
  await expect(countdown).toContainText(/Starts in\s*(0|1) h \d\d min|Starts in\s*\d+:\d\d/)
  await expect(countdown.getByRole('button', { name: 'Add to calendar' })).toBeVisible()

  // Add to calendar downloads an .ics file named after the quiz.
  const download = playerUser.page.waitForEvent('download')
  await countdown.getByRole('button', { name: 'Add to calendar' }).click()
  expect((await download).suggestedFilename()).toBe('Lobby test.ics')

  // Removing the time takes the countdown away for everyone.
  await hostUser.page.getByTestId('schedule-open').click()
  await hostUser.page.getByTestId('schedule-clear').click()
  await expect(playerUser.page.getByTestId('start-countdown')).toHaveCount(0, { timeout: 15_000 })
  await expect(playerUser.page.getByText(/Waiting for .* to start\./)).toBeVisible()

  // A time a moment ahead: once it passes, the host is prompted, and the game starts only when the host starts it.
  expect(await host('scheduleRoom', { roomId, at: Date.now() + 3_000 })).toMatchObject({ success: true })
  await expect(hostUser.page.getByTestId('its-time')).toBeVisible({ timeout: 20_000 })
  await expect(playerUser.page.getByTestId('start-countdown')).toHaveAttribute('data-state', 'due')
  await expect(playerUser.page.getByTestId('start-countdown')).toContainText('waiting for')
  await hostUser.page.getByRole('button', { name: 'Start game' }).click()
  await expect(playerUser.page.getByTestId('start-countdown')).toHaveCount(0, { timeout: 15_000 })

  // Once it's started there's nothing to schedule.
  expect(await host('scheduleRoom', { roomId, at: inAnHour })).toMatchObject({ success: false, code: 'invalid_state' })
  await host('endRoom', { roomId })
})
