/**
 * Shared notes in study spaces (docs/features.md F14): two members edit one
 * note live, a member who leaves loses it, "Make a quiz" guards short notes,
 * and "Add to notes" on a reveal writes the question into the session note.
 *
 * "Make a quiz" itself isn't clicked: it starts a real Claude generation.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { createTestSpace, deleteTestSpaces } from './helpers/spaces'
import { actionsAs, type CallAction } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (owner + member)')
test.describe.configure({ timeout: 120_000 })
test.afterEach(deleteTestSpaces)

const GRACE_MS = 300

async function spaceWithMember(owner: CallAction, member: CallAction, name: string) {
  const data = await createTestSpace(owner, name)
  await member('joinSpace', { code: data!.code })
  return data!
}

const editorOf = (page: Page) => page.getByTestId('note-editor').locator('.ProseMirror')

/** Opens the note's Yjs socket as the page's account: 'open', or 'refused' when the route says no. */
async function yjsSocket(page: Page, noteId: string): Promise<'open' | 'refused'> {
  return page.evaluate(async (id) => {
    const res = await fetch('/api/auth/token', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    const { token } = (await res.json()) as { token: string }
    const url = `${location.origin.replace(/^http/, 'ws')}/ws/yjs/${id}?token=${encodeURIComponent(token)}`
    return new Promise<'open' | 'refused'>((resolve) => {
      const ws = new WebSocket(url)
      ws.onopen = () => {
        ws.close()
        resolve('open')
      }
      ws.onerror = () => resolve('refused')
      setTimeout(() => resolve('refused'), 10_000)
    })
  }, noteId)
}

test('two members edit a note live; a member who leaves loses it', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const { spaceId } = await spaceWithMember(owner, member, 'Notes live')
  const { data: note } = await owner<{ noteId: string }>('createNote', { spaceId, title: 'Week 1' })
  const url = `/spaces/${spaceId}/notes/${note!.noteId}`

  await ownerUser.page.goto(url)
  await memberUser.page.goto(url)
  await expect(ownerUser.page.getByTestId('note-editor')).toHaveAttribute('data-synced', 'true', { timeout: 20_000 })
  await expect(memberUser.page.getByTestId('note-editor')).toHaveAttribute('data-synced', 'true', { timeout: 20_000 })

  await editorOf(ownerUser.page).click()
  await ownerUser.page.keyboard.type('Mitochondria make ATP.')
  await expect(editorOf(memberUser.page)).toContainText('Mitochondria make ATP.', { timeout: 15_000 })

  await editorOf(memberUser.page).click()
  await memberUser.page.keyboard.press('End')
  await memberUser.page.keyboard.type(' Ribosomes make proteins.')
  await expect(editorOf(ownerUser.page)).toContainText('Ribosomes make proteins.', { timeout: 15_000 })

  // "Make a quiz" refuses a note shorter than the generator needs.
  await ownerUser.page.getByTestId('quiz-from-note-open').click()
  await expect(ownerUser.page.getByTestId('quiz-from-note')).toContainText('needs at least 200 characters')
  await expect(ownerUser.page.getByRole('button', { name: 'Make quiz' })).toBeDisabled()
  await ownerUser.page.getByRole('button', { name: 'Cancel' }).click()

  // Leaving the space takes the note away: no row, and the editing socket is refused.
  expect(await yjsSocket(memberUser.page, note!.noteId)).toBe('open')
  await member('leaveSpace', { spaceId })
  await memberUser.page.goto(url)
  await expect(memberUser.page.getByText('Note not found')).toBeVisible({ timeout: 15_000 })
  expect(await yjsSocket(memberUser.page, note!.noteId)).toBe('refused')
  // An id that isn't a note at all is refused too (no open door).
  expect(await yjsSocket(memberUser.page, 'not-a-note')).toBe('refused')
})

test('"Add to notes" writes a revealed question into the session note', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const { spaceId } = await spaceWithMember(owner, member, 'Notes from games')

  const { data: quiz } = await owner<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Cells' })
  for (let i = 0; i < 2; i++) {
    await owner('addQuestion', {
      quizId: quiz!.quizId,
      prompt: `Organelle question ${i + 1}?`,
      options: [`right ${i}`, `wrong a ${i}`, `wrong b ${i}`, `wrong c ${i}`],
      correctIndex: 0,
      timeLimit: 10,
    })
  }
  const { data: room } = await owner<{ roomId: string; code: string }>('createRoom', { quizId: quiz!.quizId, spaceId })
  await member('joinRoom', { code: room!.code })
  const { deadline } = (await owner<{ deadline: number }>('startQuestion', { roomId: room!.roomId })).data!
  const now = (await owner('getServerTime')).data!.serverNow
  await new Promise((r) => setTimeout(r, Math.max(0, deadline + GRACE_MS - now) + 150))
  await owner('revealQuestion', { roomId: room!.roomId })

  await memberUser.page.goto(`/rooms/${room!.roomId}`)
  await memberUser.page.getByTestId('add-to-notes').click({ timeout: 15_000 })
  await expect(memberUser.page.getByTestId('add-to-notes')).toHaveText(/Added to notes/, { timeout: 20_000 })

  const { data: session } = await member<{ noteId: string }>('sessionNote', { roomId: room!.roomId })
  await ownerUser.page.goto(`/spaces/${spaceId}/notes/${session!.noteId}`)
  await expect(editorOf(ownerUser.page)).toContainText('Q1. Organelle question 1?', { timeout: 20_000 })
  await expect(editorOf(ownerUser.page)).toContainText('Answer: right 0')

  await owner('endRoom', { roomId: room!.roomId })
})
