import { describe, expect, it } from 'vitest'
import { firstError, newQuestion, questionEdit, quizTitle } from './quiz-input'

const valid = {
  prompt: 'Which gas do plants release?',
  options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'],
  correctIndex: 0,
}

describe('newQuestion', () => {
  it('fills in explanation and time limit defaults', () => {
    expect(newQuestion.parse(valid)).toMatchObject({ explanation: '', timeLimit: 20 })
  })

  it('trims text', () => {
    const parsed = newQuestion.parse({ ...valid, prompt: '  Why?  ', options: [' a ', 'b', 'c', 'd'] })
    expect(parsed.prompt).toBe('Why?')
    expect(parsed.options[0]).toBe('a')
  })

  it.each([
    ['three options', { options: ['a', 'b', 'c'] }, 'exactly 4 options'],
    ['an empty option', { options: ['a', ' ', 'c', 'd'] }, 'Fill in all four options'],
    ['duplicate options (case and spacing ignored)', { options: ['Red  sun', 'red sun', 'c', 'd'] }, 'all be different'],
    ['correctIndex out of range', { correctIndex: 4 }, ''],
    ['an empty prompt', { prompt: '   ' }, 'Write the question'],
    ['a time limit not on the list', { timeLimit: 15 }, 'Time limit must be one of 10, 20, 30, 60'],
  ])('refuses %s', (_, patch, message) => {
    expect(firstError(newQuestion, { ...valid, ...patch })).toContain(message)
  })
})

describe('questionEdit.partial', () => {
  it('accepts any single field', () => {
    expect(questionEdit.partial().parse({ approved: true })).toEqual({ approved: true })
  })

  it('leaves absent fields undefined (no defaults sneak into a patch)', () => {
    expect(questionEdit.partial().parse({ prompt: 'x' })).toEqual({ prompt: 'x' })
  })
})

describe('quizTitle', () => {
  it('refuses a blank title', () => {
    expect(firstError(quizTitle, '  ')).toBe('Give the quiz a title')
  })
})
