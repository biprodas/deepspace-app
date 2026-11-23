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

test('leaving a note saves a half-typed title; it asks only offline; deleting does not ask', async ({ users }) => {
  const [ownerUser] = await users(1)
  const owner = await actionsAs(ownerUser.page)
  const space = await createTestSpace(owner, 'Leaving')
  const { data: note } = await owner<{ noteId: string }>('createNote', { spaceId: space.spaceId, title: 'Draft' })
  const page = ownerUser.page
  const noteUrl = new RegExp(`/notes/${note!.noteId}$`)
  // Opened from the space's list, as people do, so Back stays inside the app.
  const openNote = async () => {
    await page.goto(`/spaces/${space.spaceId}?tab=notes`)
    await page.getByRole('link', { name: /Draft/ }).click({ timeout: 15_000 })
    await expect(page.getByTestId('space-focus-bar')).toBeVisible({ timeout: 15_000 })
  }
  const ask = page.getByRole('dialog', { name: 'Leave without saving?' })

  // Nothing unsaved: Exit goes straight back to the space's notes.
  await openNote()
  await page.getByTestId('space-exit').click()
  await expect(page).toHaveURL(/\?tab=notes$/)
  await expect(ask).toHaveCount(0)

  // A title typed but not saved yet: the browser's Back leaves without asking and saves it.
  await openNote()
  await page.getByTestId('note-title').fill('Draft two')
  await page.goBack()
  await expect(page).toHaveURL(/\/spaces\/[^/]+(\?tab=notes)?$/)
  await expect(ask).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Draft two/ })).toBeVisible({ timeout: 15_000 })

  // Offline, the title can't be saved, so Back asks; Stay keeps the note open.
  await openNote()
  await page.context().setOffline(true)
  await page.getByTestId('note-title').fill('Draft three')
  await page.goBack()
  await expect(ask).toBeVisible()
  await page.getByRole('button', { name: 'Stay' }).click()
  await expect(page).toHaveURL(noteUrl)

  // Back online and saved (Enter), it no longer asks.
  await page.context().setOffline(false)
  await page.getByTestId('note-title').press('Enter')
  await expect(page.getByTestId('note-title')).toHaveValue('Draft three', { timeout: 10_000 })
  await page.getByTestId('space-exit').click()
  await expect(page).toHaveURL(/\?tab=notes$/)
  await expect(ask).toHaveCount(0)

  // Deleting goes straight back without asking.
  await openNote()
  await page.getByRole('button', { name: 'Note options' }).click({ timeout: 15_000 })
  await page.getByRole('menuitem', { name: 'Delete note' }).click()
  await page.getByRole('button', { name: 'Delete note' }).click()
  await expect(page).toHaveURL(/\?tab=notes$/, { timeout: 10_000 })
  await expect(ask).toHaveCount(0)
})
