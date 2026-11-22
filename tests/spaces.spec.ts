/**
 * Study spaces (docs/features.md F13): members join by link, non-members
 * receive nothing (the SDK's 'team' rule), removed members stay out, and
 * games hosted in a space show up in it.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { actionsAs } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (owner + member)')
test.describe.configure({ timeout: 120_000 })

test('a non-member sees nothing; joining by link shows the space to both', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const name = `Space ${Date.now()}`
  const { data } = await owner<{ spaceId: string; code: string }>('createSpace', { name })
  const { spaceId, code } = data!

  // Before joining, the server sends the member nothing about the space.
  await memberUser.page.goto(`/spaces/${spaceId}`)
  await expect(memberUser.page.getByText('Space not found')).toBeVisible({ timeout: 15_000 })
  expect(await member('inviteToSpace', { spaceId, emails: ['x@example.com'] })).toMatchObject({
    success: false,
    code: 'not_a_member',
  })

  // The share link joins and lands in the space.
  await memberUser.page.goto(`/spaces/join/${code}`)
  await expect(memberUser.page.getByTestId('space-name')).toHaveText(name, { timeout: 15_000 })

  await ownerUser.page.goto(`/spaces/${spaceId}`)
  await expect(ownerUser.page.getByTestId('space-member')).toHaveCount(2, { timeout: 15_000 })
  await ownerUser.page.goto('/spaces')
  await expect(ownerUser.page.getByTestId('spaces-list')).toContainText(name)
})

test('a removed member loses the space and cannot rejoin with the code', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const { data } = await owner<{ spaceId: string; code: string }>('createSpace', { name: 'Removal' })
  const { spaceId, code } = data!
  expect(await member('joinSpace', { code })).toMatchObject({ success: true, data: { spaceId } })

  await memberUser.page.goto(`/spaces/${spaceId}`)
  await expect(memberUser.page.getByTestId('space-name')).toBeVisible({ timeout: 15_000 })

  // The owner removes them from the members list.
  await ownerUser.page.goto(`/spaces/${spaceId}`)
  const row = ownerUser.page.getByTestId('space-member').filter({ hasNotText: '(you)' })
  await row.getByRole('button', { name: /^Remove / }).click({ timeout: 15_000 })
  await ownerUser.page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(ownerUser.page.getByTestId('space-member')).toHaveCount(1, { timeout: 10_000 })

  await expect(memberUser.page.getByText('Space not found')).toBeVisible({ timeout: 15_000 })
  expect(await member('joinSpace', { code })).toMatchObject({ success: false, code: 'removed' })
})

test('a game hosted in a space shows on the space page', async ({ users }) => {
  const [ownerUser] = await users(1)
  const owner = await actionsAs(ownerUser.page)
  const { data: space } = await owner<{ spaceId: string }>('createSpace', { name: 'Games' })
  const { data: quiz } = await owner<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Space quiz' })
  await owner('addQuestion', {
    quizId: quiz!.quizId,
    prompt: 'Space question?',
    options: ['right', 'wrong a', 'wrong b', 'wrong c'],
    correctIndex: 0,
    timeLimit: 10,
  })
  const { data: room } = await owner<{ roomId: string; code: string }>('createRoom', {
    quizId: quiz!.quizId,
    spaceId: space!.spaceId,
  })

  await ownerUser.page.goto(`/spaces/${space!.spaceId}`)
  await expect(ownerUser.page.getByTestId('space-games')).toContainText(room!.code, { timeout: 15_000 })
  await owner('endRoom', { roomId: room!.roomId })
})
