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
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
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

test('the board’s tools: pen, arrow, sticky note, resize, one-step undo of a drag, duplicate, download', async ({
  users,
}) => {
  const [ownerUser] = await users(1)
  const page = ownerUser.page
  const owner = await actionsAs(page)
  const space = await createTestSpace(owner, 'Board tools')
  const { data } = await owner<{ boardId: string }>('createBoard', { spaceId: space!.spaceId, title: 'Tools' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/spaces/${space!.spaceId}/boards/${data!.boardId}`)
  await expect(page.getByTestId('canvas-view')).toContainText('Connected', { timeout: 20_000 })
  const box = (await page.getByTestId('canvas-svg').boundingBox())!
  const at = (x: number, y: number) => ({ x: box.x + x, y: box.y + y })
  async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
  }
  const kind = (k: string) => page.getByTestId('canvas-svg').locator(`[data-kind="${k}"][data-testid^="shape-"]`)

  // Pen: a freehand stroke.
  await page.getByTestId('tool-pen').click()
  await drag(at(200, 250), at(320, 330))
  await expect(kind('path')).toHaveCount(1)

  // Arrow drawn upwards keeps its direction (start low, end high).
  await page.keyboard.press('a')
  await drag(at(400, 400), at(520, 260))
  await expect(kind('arrow')).toHaveCount(1)
  const d = (await kind('arrow').locator('path').nth(1).getAttribute('d'))!
  const [, y1, , y2] = d
    .match(/M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)/)!
    .slice(1)
    .map(Number)
  expect(y1).toBeGreaterThan(y2)

  // Sticky note: a click places it and opens it for writing.
  await page.getByTestId('tool-note').click()
  await page.mouse.click(at(760, 330).x, at(760, 330).y)
  await page.getByTestId('canvas-text-input').fill('Mitochondria make ATP')
  await page.keyboard.press('Control+Enter')
  // Wrapped lines are separate tspans, so their words join without the space.
  await expect(kind('note')).toContainText(/Mitochondria\s*make\s*ATP/)

  // A drag is one step of undo: one undo puts the note back where it was.
  const before = (await kind('note').boundingBox())!
  await drag(at(760, 330), at(960, 430))
  await expect.poll(async () => (await kind('note').boundingBox())!.x).toBeGreaterThan(before.x + 150)
  await page.getByTestId('canvas-undo').click()
  await expect.poll(async () => Math.round((await kind('note').boundingBox())!.x)).toBe(Math.round(before.x))

  // Rectangle, then resize it from its corner handle.
  await page.getByTestId('tool-rect').click()
  await drag(at(300, 480), at(420, 560))
  const rect = kind('rect')
  const small = (await rect.boundingBox())!
  const handle = (await page.getByTestId('handle-se').boundingBox())!
  await drag({ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, at(560, 620))
  await expect.poll(async () => (await rect.boundingBox())!.width).toBeGreaterThan(small.width + 100)

  // Duplicate the selected rectangle.
  await page.keyboard.press('Control+d')
  await expect(kind('rect')).toHaveCount(2)

  // Download the board as a PNG.
  const download = page.waitForEvent('download')
  await page.getByTestId('canvas-download').click()
  expect((await download).suggestedFilename()).toBe('Tools.png')
})

test('boards are renamed and deleted from the list; only the creator or space owner deletes', async ({ users }) => {
  const [ownerUser, memberUser] = await users(2)
  const owner = await actionsAs(ownerUser.page)
  const member = await actionsAs(memberUser.page)
  const { spaceId } = await spaceWithMember(owner, member, 'Board list')
  const { data } = await owner<{ boardId: string }>('createBoard', { spaceId, title: 'Old name' })
  const row = (page: Page) => page.getByTestId(`board-row-${data!.boardId}`)

  // Rename in place from the row's menu.
  await ownerUser.page.goto(`/spaces/${spaceId}?tab=boards`)
  await row(ownerUser.page).getByTestId('board-row-menu').click()
  await ownerUser.page.getByRole('menuitem', { name: 'Rename' }).click()
  await row(ownerUser.page).getByLabel('Board title').fill('Cell biology')
  await row(ownerUser.page).getByLabel('Board title').press('Enter')
  await expect(row(ownerUser.page)).toContainText('Cell biology', { timeout: 15_000 })

  // A member who didn't make it can rename but not delete.
  await memberUser.page.goto(`/spaces/${spaceId}?tab=boards`)
  await expect(row(memberUser.page)).toContainText('Cell biology', { timeout: 15_000 })
  await row(memberUser.page).getByTestId('board-row-menu').click()
  await expect(memberUser.page.getByRole('menuitem', { name: 'Rename' })).toBeVisible()
  await expect(memberUser.page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
  await memberUser.page.keyboard.press('Escape')

  // The owner deletes it after confirming; it leaves the member's list too.
  await row(ownerUser.page).getByTestId('board-row-menu').click()
  await ownerUser.page.getByRole('menuitem', { name: 'Delete' }).click()
  await ownerUser.page.getByRole('button', { name: 'Delete board' }).click()
  await expect(row(ownerUser.page)).toHaveCount(0, { timeout: 15_000 })
  await expect(row(memberUser.page)).toHaveCount(0, { timeout: 15_000 })
})

test('the eraser removes what it passes over; Clear board empties it, and Restore brings it all back', async ({
  users,
}) => {
  const [ownerUser] = await users(1)
  const page = ownerUser.page
  const owner = await actionsAs(page)
  const space = await createTestSpace(owner, 'Clearing')
  const { data } = await owner<{ boardId: string }>('createBoard', { spaceId: space!.spaceId, title: 'Scratch' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/spaces/${space!.spaceId}/boards/${data!.boardId}`)
  await expect(page.getByTestId('canvas-view')).toContainText('Connected', { timeout: 20_000 })
  const box = (await page.getByTestId('canvas-svg').boundingBox())!
  const at = (x: number, y: number) => ({ x: box.x + x, y: box.y + y })
  async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 10 })
    await page.mouse.up()
  }

  // Three rectangles side by side, and a pen stroke under them.
  for (const x of [250, 450, 650]) {
    await page.keyboard.press('r')
    await drag(at(x, 250), at(x + 120, 340))
  }
  await page.keyboard.press('p')
  await drag(at(250, 480), at(800, 480))
  await expect(shapesOn(page)).toHaveCount(4)

  // Partly: a swipe through the first two rectangles' edges removes just those.
  await page.keyboard.press('e')
  await drag(at(240, 300), at(460, 300))
  await expect(shapesOn(page)).toHaveCount(2)

  // Fully: Clear board (confirmed) empties it; Restore puts everything back.
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByTestId('board-clear').click()
  await page.getByRole('button', { name: 'Clear board' }).click()
  await expect(shapesOn(page)).toHaveCount(0)
  await expect(page.getByTestId('canvas-cleared')).toContainText('2 shapes')
  await page.getByTestId('canvas-restore').click()
  await expect(shapesOn(page)).toHaveCount(2)

  // A clear that isn't restored sticks: it's still empty after a reload.
  await page.getByRole('button', { name: 'Board options' }).click()
  await page.getByTestId('board-clear').click()
  await page.getByRole('button', { name: 'Clear board' }).click()
  await expect(shapesOn(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('canvas-view')).toContainText('Connected', { timeout: 20_000 })
  await expect(shapesOn(page)).toHaveCount(0)
})
