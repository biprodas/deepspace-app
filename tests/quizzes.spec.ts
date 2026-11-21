/**
 * Quiz building (docs/features.md F2, M1): the owner's action path, the
 * editor screen, and refusals for everyone else.
 *
 * Needs test accounts: one for most tests, two for the forgery test.
 *   npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { actionsAs } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 1, 'Needs a test account: npx deepspace test accounts create …')

const QUESTION = {
  prompt: 'Which gas do plants release during photosynthesis?',
  options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'],
  correctIndex: 0,
  explanation: 'Water is split and oxygen is released.',
  timeLimit: 20,
}

test('owner builds, edits, reorders and deletes a quiz through actions', async ({ users }) => {
  const [owner] = await users(1)
  const call = await actionsAs(owner.page)

  const created = await call<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Plants 101' })
  expect(created).toMatchObject({ success: true })
  const quizId = created.data!.quizId
  expect(created.data!.serverNow).toBeGreaterThan(0)

  const q1 = await call<{ questionId: string }>('addQuestion', { quizId, ...QUESTION })
  const q2 = await call<{ questionId: string }>('addQuestion', {
    quizId,
    ...QUESTION,
    prompt: 'What colour is chlorophyll?',
    options: ['Green', 'Red', 'Blue', 'Yellow'],
  })
  expect(q1.success && q2.success).toBe(true)

  expect(await call('updateQuestion', { questionId: q1.data!.questionId, correctIndex: 2, approved: false }))
    .toMatchObject({ success: true })
  expect(await call('moveQuestion', { questionId: q2.data!.questionId, direction: 'up' }))
    .toMatchObject({ success: true, data: { moved: true } })
  expect(await call('deleteQuestion', { questionId: q1.data!.questionId })).toMatchObject({ success: true })
  expect(await call('deleteQuiz', { quizId })).toMatchObject({ success: true })
  expect(await call('renameQuiz', { quizId, title: 'Gone' })).toMatchObject({ success: false, code: 'not_found' })
})

test('invalid questions are refused with a readable reason', async ({ users }) => {
  const [owner] = await users(1)
  const call = await actionsAs(owner.page)
  const { data } = await call<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Validation' })
  const quizId = data!.quizId

  const dup = await call('addQuestion', { quizId, ...QUESTION, options: ['A', 'a', 'B', 'C'] })
  expect(dup).toMatchObject({ success: false, code: 'invalid_params' })
  expect(dup.error).toContain('Options must all be different')

  expect(await call('addQuestion', { quizId, ...QUESTION, timeLimit: 15 }))
    .toMatchObject({ success: false, code: 'invalid_params' })
  expect(await call('addQuestion', { quizId, ...QUESTION, correctIndex: 7 }))
    .toMatchObject({ success: false, code: 'invalid_params' })

  await call('deleteQuiz', { quizId })
})

test('the editor shows a new question live and marks its answer', async ({ users }) => {
  const [owner] = await users(1)
  const call = await actionsAs(owner.page)
  const { data } = await call<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Editor check' })
  const quizId = data!.quizId

  await owner.page.goto(`/quizzes/${quizId}`)
  await expect(owner.page.getByRole('heading', { name: 'Editor check' })).toBeVisible({ timeout: 15_000 })

  await owner.page.getByLabel('Question', { exact: true }).fill(QUESTION.prompt)
  for (const [i, option] of QUESTION.options.entries()) {
    await owner.page.getByLabel(`Option ${'ABCD'[i]}`).first().fill(option)
  }
  await owner.page.getByRole('button', { name: 'Mark option C correct' }).first().click()
  await owner.page.getByRole('button', { name: 'Add question' }).click()

  const card = owner.page.getByTestId('question-card')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText(QUESTION.prompt)
  await expect(card.getByRole('listitem').nth(2).getByLabel('Correct answer')).toBeVisible()
  await expect(owner.page.getByTestId('approved-count')).toHaveText('1 approved')

  await call('deleteQuiz', { quizId })
})

test.describe('another user', () => {
  test.skip(accounts < 2, 'Needs 2 test accounts')

  test('cannot edit, reorder, rename or delete someone else’s quiz', async ({ users }) => {
    const [owner, intruder] = await users(2)
    const asOwner = await actionsAs(owner.page)
    const asIntruder = await actionsAs(intruder.page)

    const { data } = await asOwner<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Mine' })
    const quizId = data!.quizId
    const q = await asOwner<{ questionId: string }>('addQuestion', { quizId, ...QUESTION })
    const questionId = q.data!.questionId

    for (const [name, params] of [
      ['updateQuestion', { questionId, correctIndex: 1 }],
      ['moveQuestion', { questionId, direction: 'down' }],
      ['deleteQuestion', { questionId }],
      ['addQuestion', { quizId, ...QUESTION }],
      ['renameQuiz', { quizId, title: 'Yours now' }],
      ['deleteQuiz', { quizId }],
    ] as const) {
      expect(await asIntruder(name, params), name).toMatchObject({ success: false, code: 'forbidden' })
    }

    // The intruder's page can't read the answer key either.
    await intruder.page.goto(`/quizzes/${quizId}`)
    await expect(intruder.page.getByText('Only the quiz owner can see the answers')).toBeVisible({
      timeout: 15_000,
    })

    await asOwner('deleteQuiz', { quizId })
  })
})
