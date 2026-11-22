import { describe, expect, it } from 'vitest'
import { AUDIT_ACTIONS } from '../schemas/audit-schemas'
import { CATEGORY_OF, describeAudit } from './audit'

describe('describeAudit', () => {
  it('names the people and the target', () => {
    expect(describeAudit({ action: 'space.member_removed', targetLabel: 'Biology', meta: { member: 'Sam' } })).toBe(
      'removed Sam from the space “Biology”',
    )
    expect(describeAudit({ action: 'user.role_changed', targetLabel: 'Sam', meta: { user: 'Sam', from: 'member', to: 'admin' } })).toBe(
      'changed Sam’s role from member to admin',
    )
  })

  it('counts with the right plural', () => {
    expect(describeAudit({ action: 'email.invites_sent', targetLabel: 'Quiz', meta: { count: 1 } })).toBe('sent 1 invite email for “Quiz”')
    expect(describeAudit({ action: 'email.invites_sent', targetLabel: 'Quiz', meta: { count: 3 } })).toBe('sent 3 invite emails for “Quiz”')
  })

  it('still reads when details are missing', () => {
    expect(describeAudit({ action: 'quiz.deleted' })).toBe('deleted the quiz something')
    expect(describeAudit({ action: 'admin.data_exported' })).toBe('exported the app’s data')
  })

  it('has a sentence and a category for every action', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(describeAudit({ action }).length).toBeGreaterThan(5)
      expect(CATEGORY_OF[action]).toBeDefined()
    }
  })
})
