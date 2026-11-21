/**
 * History, leaderboard and the data inspector (docs/features.md F10–F11,
 * docs/trd.md §13; M6). The leaderboard is shared across runs, so these
 * tests compare a player's row before and after a game.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { actionsAs, type CallAction } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (host + player)')
test.describe.configure({ timeout: 90_000 })

const GRACE_MS = 300

/** A one-question game the player answers correctly, played to the end. */
async function playOneQuestion(host: CallAction, player: CallAction, finish: 'final' | 'ended early') {
  const { data: quiz } = await host<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'History test' })
  await host('addQuestion', {
    quizId: quiz!.quizId,
    prompt: 'Which planet is closest to the Sun?',
    options: ['Mercury', 'Venus', 'Earth', 'Mars'],
    correctIndex: 0,
    timeLimit: 10,
  })
  const { data: room } = await host<{ roomId: string; code: string }>('createRoom', { quizId: quiz!.quizId })
  await player('joinRoom', { code: room!.code })
  const q1 = (await host<{ roundId: string; deadline: number }>('startQuestion', { roomId: room!.roomId })).data!
  const answered = await player('submitAnswer', { roundId: q1.roundId, choiceIndex: 0 })
  if (finish === 'ended early') {
    await host('endRoom', { roomId: room!.roomId })
  } else {
    await new Promise((r) => setTimeout(r, Math.max(0, q1.deadline + GRACE_MS - answered.data!.serverNow) + 200))
    expect(await host('revealQuestion', { roomId: room!.roomId })).toMatchObject({ data: { status: 'final' } })
  }
  return { roomId: room!.roomId, quizId: quiz!.quizId }
}

/** The player's leaderboard total (0 when not on the board yet). */
async function boardScore(page: Page, name: string): Promise<number> {
  await page.goto('/leaderboard')
  // Wait until the live query has answered: rows, or the empty board.
  await page.getByTestId('leaderboard').or(page.getByText('No finished games yet')).waitFor({ timeout: 15_000 })
  const row = page.getByTestId('leaderboard-row').filter({ hasText: name })
  if ((await row.count()) === 0) return 0
  return Number((await row.getByTestId('leaderboard-score').innerText()).replace(/\D/g, ''))
}

test('a finished game counts on the leaderboard, a game ended early does not', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const name = playerUser.name ?? ''
  const before = await boardScore(playerUser.page, name)

  await playOneQuestion(host, player, 'final')
  // The board updates a moment after the game ends; poll until it has.
  let afterFinal = 0
  await expect
    .poll(async () => (afterFinal = await boardScore(playerUser.page, name)), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(before + 500) // a correct answer is worth 500–1000

  await playOneQuestion(host, player, 'ended early')
  expect(await boardScore(playerUser.page, name)).toBe(afterFinal)
})

test('history shows the player their rank and the host the question breakdown', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId } = await playOneQuestion(host, player, 'final')

  await playerUser.page.goto('/history')
  const played = playerUser.page.getByTestId('history-played').locator(`a[href="/rooms/${roomId}"]`)
  await expect(played.getByTestId('history-rank')).toHaveText('#1 of 1', { timeout: 15_000 })

  await hostUser.page.goto('/history')
  await hostUser.page.getByTestId('history-hosted').locator(`a[href="/rooms/${roomId}"]`).click({ timeout: 15_000 })
  const breakdown = hostUser.page.getByTestId('question-breakdown')
  await expect(breakdown.getByTestId('question-result')).toContainText('100%', { timeout: 15_000 })
  await expect(breakdown).toContainText('1 of 1 answered correctly')
})

test('only the app owner can export data', async ({ users }) => {
  const [someone] = await users(1)
  const call = await actionsAs(someone.page)
  // Test accounts are never the app owner.
  expect(await call('exportData')).toMatchObject({ success: false, code: 'forbidden' })
  await someone.page.goto('/admin/data')
  await expect(someone.page.getByText('Only the app owner can inspect the data.')).toBeVisible({ timeout: 15_000 })
})
