/**
 * Joining with a code from the header (docs/features.md F3): a game code
 * opens the game, a study-space code opens the space, an unknown code says
 * so, and Home (which has its own big code field) has no header Join.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { actionsAs } from './helpers/actions'
import { createTestSpace, deleteTestSpaces } from './helpers/spaces'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (host + player)')
test.describe.configure({ timeout: 90_000 })
test.afterEach(deleteTestSpaces)

async function joinFromHeader(page: Page, code: string) {
  await page.getByTestId('header-join').click()
  await page.getByLabel('Game or space code').fill(code)
  await page.getByLabel('Game or space code').press('Enter')
}

test('the header Join opens a game, a space, or says the code is unknown', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const page = playerUser.page
  await page.setViewportSize({ width: 1280, height: 800 })

  // Home has its own code field, so no header Join there.
  await page.goto('/home')
  await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('header-join')).toHaveCount(0)

  // A game code from another page lands in the game.
  const { data: quiz } = await host<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Header join' })
  await host('addQuestion', {
    quizId: quiz!.quizId,
    prompt: 'Header join question?',
    options: ['right', 'wrong a', 'wrong b', 'wrong c'],
    correctIndex: 0,
    timeLimit: 10,
  })
  const { data: room } = await host<{ roomId: string; code: string }>('createRoom', { quizId: quiz!.quizId })
  await page.goto('/spaces')
  await joinFromHeader(page, room!.code.toLowerCase())
  await expect(page).toHaveURL(new RegExp(`/rooms/${room!.roomId}$`), { timeout: 15_000 })

  // A space code lands in the space (no game has that code).
  const space = await createTestSpace(host, 'Header join space')
  await page.goto('/history')
  await joinFromHeader(page, space.code)
  await expect(page).toHaveURL(new RegExp(`/spaces/${space.spaceId}$`), { timeout: 15_000 })
  await expect(page.getByTestId('space-name')).toHaveText('Header join space')

  // A malformed code is caught in place; a well-formed unknown one is reported.
  await page.goto('/history')
  await joinFromHeader(page, 'K7Q')
  await expect(page.getByText('Codes are 6 letters or numbers, like K7QX9P.')).toBeVisible()
  await page.getByLabel('Game or space code').fill('ZZZZZZ')
  await page.getByLabel('Game or space code').press('Enter')
  await expect(page.getByText('No game or space with that code')).toBeVisible({ timeout: 15_000 })

  await host('endRoom', { roomId: room!.roomId })
})
