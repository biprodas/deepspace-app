/**
 * AI quiz building (docs/features.md F2, M4): the request side, without
 * spending credits. Every bad request must be refused before anything is
 * queued. The pipeline itself (sources → Claude → checks → retry) is unit
 * tested in src/lib/generation.test.ts on recorded data; a live run is a
 * manual check.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { actionsAs } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 1, 'Needs a test account')

const NOTES = 'Photosynthesis converts light energy into chemical energy. '.repeat(8)

test('bad AI quiz requests are refused before anything is queued', async ({ users }) => {
  const [owner] = await users(1)
  const call = await actionsAs(owner.page)

  for (const [why, params, message] of [
    ['no topics', { sourceType: 'wikipedia', topics: [], questionCount: 5, difficulty: 'mixed' }, 'Add a topic'],
    ['four topics', { sourceType: 'wikipedia', topics: ['a', 'b', 'c', 'd'], questionCount: 5, difficulty: 'mixed' }, 'Up to 3 topics'],
    ['too few questions', { sourceType: 'wikipedia', topics: ['Photosynthesis'], questionCount: 4, difficulty: 'mixed' }, 'Between 5 and 10'],
    ['too many questions', { sourceType: 'notes', title: 'N', notes: NOTES, questionCount: 11, difficulty: 'easy' }, 'Between 5 and 10'],
    ['an unknown difficulty', { sourceType: 'notes', title: 'N', notes: NOTES, questionCount: 5, difficulty: 'brutal' }, 'difficulty'],
    ['notes too short', { sourceType: 'notes', title: 'N', notes: 'Too short.', questionCount: 5, difficulty: 'easy' }, '200+ characters'],
    ['notes too long', { sourceType: 'notes', title: 'N', notes: 'x'.repeat(20_001), questionCount: 5, difficulty: 'easy' }, 'up to 20,000'],
    ['an unknown source', { sourceType: 'youtube', title: 'N' }, 'sourceType'],
  ] as const) {
    const res = await call('createQuiz', params)
    expect(res, why).toMatchObject({ success: false, code: 'invalid_params' })
    expect(res.error, why).toContain(message)
  }
})

test('only AI-drafted quizzes regenerate, and only for their owner', async ({ users }) => {
  test.skip(accounts < 2, 'Needs 2 test accounts')
  const [owner, other] = await users(2)
  const asOwner = await actionsAs(owner.page)
  const asOther = await actionsAs(other.page)

  const { data } = await asOwner<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'By hand' })
  const q = await asOwner<{ questionId: string }>('addQuestion', {
    quizId: data!.quizId,
    prompt: 'Which gas do plants release?',
    options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'],
    correctIndex: 0,
  })
  const questionId = q.data!.questionId

  expect(await asOther('regenerateQuestion', { questionId })).toMatchObject({ success: false, code: 'forbidden' })
  expect(await asOwner('regenerateQuestion', { questionId })).toMatchObject({ success: false, code: 'no_source' })
  await asOwner('deleteQuiz', { quizId: data!.quizId })
})

test('the builder validates before sending', async ({ users }) => {
  const [owner] = await users(1)
  await owner.page.goto('/quizzes/new')
  await owner.page.getByRole('tab', { name: 'My notes' }).click({ timeout: 15_000 })
  await owner.page.getByLabel('Title').fill('Short notes')
  await owner.page.getByLabel('Your notes').fill('Far too short.')
  await owner.page.getByRole('button', { name: /Draft 8 questions/ }).click()
  await expect(owner.page.getByRole('alert')).toHaveText(/200\+ characters/)
  await expect(owner.page).toHaveURL(/\/quizzes\/new$/)
})
