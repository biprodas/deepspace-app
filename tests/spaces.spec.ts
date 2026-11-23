/**
 * Study spaces (docs/features.md F13): members join by link, non-members
 * receive nothing (the SDK's 'team' rule), removed members stay out, and
 * games hosted in a space show up in it.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { createTestSpace, deleteTestSpaces } from './helpers/spaces'
import { actionsAs } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (owner + member)')
test.describe.configure({ timeout: 120_000 })
test.afterEach(deleteTestSpaces)

test('a non-member sees nothing; joining by link shows the space to both', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const name = `Space ${Date.now()}`
  const data = await createTestSpace(owner, name)
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
  const data = await createTestSpace(owner, 'Removal')
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
  const space = await createTestSpace(owner, 'Games')
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

test('notes and boards open in focus mode and show who is working where', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const space = await createTestSpace(owner, 'Who is where')
  await member('joinSpace', { code: space.code })
  const { data: note } = await owner<{ noteId: string }>('createNote', { spaceId: space.spaceId, title: 'Week 3' })
  const { data: board } = await owner<{ boardId: string }>('createBoard', { spaceId: space.spaceId, title: 'Sketch' })
  const noteUrl = `/spaces/${space.spaceId}/notes/${note!.noteId}`

  // Both in the same note: the space bar replaces the app nav and lists them together.
  await ownerUser.page.goto(noteUrl)
  await memberUser.page.goto(noteUrl)
  await expect(ownerUser.page.getByTestId('space-focus-bar')).toBeVisible({ timeout: 15_000 })
  await expect(ownerUser.page.getByTestId('app-navigation')).toHaveCount(0)
  await expect(ownerUser.page.getByTestId('space-avatars')).toHaveAttribute('aria-label', /2 of 2 online/, {
    timeout: 15_000,
  })
  await ownerUser.page.getByTestId('space-avatars').click()
  await expect(ownerUser.page.getByTestId('space-roster')).toContainText('Here with you · 2', { timeout: 15_000 })
  await ownerUser.page.keyboard.press('Escape')

  // The owner moves to a board; the member, back on the space page (with its nav), sees where.
  await ownerUser.page.goto(`/spaces/${space.spaceId}/boards/${board!.boardId}`)
  await memberUser.page.goto(`/spaces/${space.spaceId}`)
  await expect(memberUser.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await memberUser.page.getByTestId('space-avatars').click()
  await expect(memberUser.page.getByTestId('space-roster')).toContainText('In Sketch', { timeout: 15_000 })
})

test('leaving a note asks first; deleting it does not ask twice', async ({ users }) => {
  const [ownerUser] = await users(1)
  const owner = await actionsAs(ownerUser.page)
  const space = await createTestSpace(owner, 'Leaving')
  const { data: note } = await owner<{ noteId: string }>('createNote', { spaceId: space.spaceId, title: 'Draft' })
  const page = ownerUser.page
  const noteUrl = new RegExp(`/notes/${note!.noteId}$`)
  await page.goto(`/spaces/${space.spaceId}`)
  await page.getByTestId('tab-notes').click()
  await page.getByRole('link', { name: /Draft/ }).click()
  await expect(page.getByTestId('space-focus-bar')).toBeVisible({ timeout: 15_000 })

  // Exit asks; Stay keeps the note open.
  await page.getByTestId('space-exit').click()
  await expect(page.getByRole('dialog', { name: 'Leave this note?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay' }).click()
  await expect(page).toHaveURL(noteUrl)

  // The browser's Back asks too; Leave goes back to the space's notes.
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Leave this note?' })).toBeVisible()
  await page.getByRole('button', { name: 'Leave' }).click()
  await expect(page).toHaveURL(/\/spaces\/[^/]+(\?tab=notes)?$/)
  await expect(page.getByTestId('space-focus-bar')).toHaveCount(0)

  // Deleting goes straight back without a second "Leave?".
  await page.goto(`/spaces/${space.spaceId}/notes/${note!.noteId}`)
  await page.getByRole('button', { name: 'Note options' }).click({ timeout: 15_000 })
  await page.getByRole('menuitem', { name: 'Delete note' }).click()
  await page.getByRole('button', { name: 'Delete note' }).click()
  await expect(page).toHaveURL(/\?tab=notes$/, { timeout: 10_000 })
  await expect(page.getByRole('dialog', { name: 'Leave this note?' })).toHaveCount(0)
})
