/**
 * Whiteboards and AI mind maps in study spaces (docs/features.md F15): a
 * member's shape appears for the other member, a member who leaves loses the
 * board and its socket, and unknown canvas ids are refused.
 *
 * The mind-map test calls Claude and Wikipedia (credits), so it only runs
 * with RUN_PAID_TESTS=1.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { createTestSpace, deleteTestSpaces } from './helpers/spaces'
import { actionsAs, type CallAction } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (owner + member)')
test.describe.configure({ timeout: 120_000 })
test.afterEach(deleteTestSpaces)

async function spaceWithMember(owner: CallAction, member: CallAction, name: string) {
  const data = await createTestSpace(owner, name)
  await member('joinSpace', { code: data!.code })
  return data!
}

/** Opens the board's canvas socket as the page's account: 'open', or 'refused'. */
async function canvasSocket(page: Page, boardId: string): Promise<'open' | 'refused'> {
  return page.evaluate(async (id) => {
    const res = await fetch('/api/auth/token', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    const { token } = (await res.json()) as { token: string }
    const url = `${location.origin.replace(/^http/, 'ws')}/ws/canvas/${id}?token=${encodeURIComponent(token)}`
    return new Promise<'open' | 'refused'>((resolve) => {
      const ws = new WebSocket(url)
      ws.onopen = () => {
        ws.close()
        resolve('open')
      }
      ws.onerror = () => resolve('refused')
      setTimeout(() => resolve('refused'), 10_000)
    })
  }, boardId)
}

const shapesOn = (page: Page) => page.getByTestId('canvas-svg').locator('[data-testid^="shape-"]')

test('a shape one member draws appears for the other; leaving takes the board away', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const { spaceId } = await spaceWithMember(owner, member, 'Boards live')
  const { data } = await owner<{ boardId: string }>('createBoard', { spaceId, title: 'Sketch' })
  const url = `/spaces/${spaceId}/boards/${data!.boardId}`

  await ownerUser.page.goto(url)
  await memberUser.page.goto(url)
  await expect(ownerUser.page.getByTestId('canvas-view')).toContainText('Connected', { timeout: 20_000 })
  await expect(memberUser.page.getByTestId('canvas-view')).toContainText('Connected', { timeout: 20_000 })

  // Draw a rectangle by dragging on the owner's canvas.
  await ownerUser.page.getByTestId('tool-rect').click()
  const box = (await ownerUser.page.getByTestId('canvas-svg').boundingBox())!
  await ownerUser.page.mouse.move(box.x + 120, box.y + 120)
  await ownerUser.page.mouse.down()
  await ownerUser.page.mouse.move(box.x + 260, box.y + 220, { steps: 5 })
  await ownerUser.page.mouse.up()

  await expect(shapesOn(ownerUser.page)).toHaveCount(1, { timeout: 10_000 })
  await expect(shapesOn(memberUser.page)).toHaveCount(1, { timeout: 15_000 })

  expect(await canvasSocket(memberUser.page, data!.boardId)).toBe('open')
  await member('leaveSpace', { spaceId })
  await memberUser.page.goto(url)
  await expect(memberUser.page.getByText('Board not found')).toBeVisible({ timeout: 15_000 })
  expect(await canvasSocket(memberUser.page, data!.boardId)).toBe('refused')
  expect(await canvasSocket(memberUser.page, 'not-a-board')).toBe('refused')
})

test('only members create boards', async ({ users }) => {
  const [ownerUser, outsiderUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const outsider = await actionsAs(outsiderUser.page)
  const data = await createTestSpace(owner, 'Closed')
  expect(await outsider('createBoard', { spaceId: data!.spaceId, title: 'Nope' })).toMatchObject({
    success: false,
    code: 'not_a_member',
  })
})

test('an AI mind map is generated, drawn once, and shown to members', async ({ users }) => {
  test.skip(!process.env.RUN_PAID_TESTS, 'Calls Claude and Wikipedia; set RUN_PAID_TESTS=1')
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const { spaceId } = await spaceWithMember(owner, member, 'Mind maps')

  await ownerUser.page.goto(`/spaces/${spaceId}?tab=boards`)
  await ownerUser.page.getByLabel('Mind map topic').fill('Photosynthesis')
  await ownerUser.page.getByTestId('create-mindmap').click()
  await expect(ownerUser.page).toHaveURL(/\/boards\//, { timeout: 90_000 })
  const boardUrl = new URL(ownerUser.page.url()).pathname

  // Root + at least two branches, with their lines.
  await expect.poll(async () => shapesOn(ownerUser.page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(5)
  const drawn = await shapesOn(ownerUser.page).count()

  await memberUser.page.goto(boardUrl)
  await expect(shapesOn(memberUser.page)).toHaveCount(drawn, { timeout: 20_000 })
  // Reopening as the creator doesn't draw it again.
  await ownerUser.page.reload()
  await expect(ownerUser.page.getByTestId('canvas-view')).toContainText('Connected', { timeout: 20_000 })
  await ownerUser.page.waitForTimeout(2_000)
  expect(await shapesOn(ownerUser.page).count()).toBe(drawn)
})
