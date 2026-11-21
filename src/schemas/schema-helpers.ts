/**
 * Column and permission builders for the Study Arena collections.
 *
 * Every game collection is written only by server actions (docs/trd.md §3),
 * so clients get read access at most. Actions use RBAC-off tools and are
 * unaffected by these rules.
 */

import type { ColumnDefinition, PermissionLevel, RolePermissions } from 'deepspace/schema'

type ColumnOptions = Pick<ColumnDefinition, 'required' | 'immutable' | 'default'>

export const text = (name: string, opts: ColumnOptions = {}): ColumnDefinition => ({
  name,
  storage: 'text',
  interpretation: 'plain',
  ...opts,
})

export const num = (name: string, opts: ColumnOptions = {}): ColumnDefinition => ({
  name,
  storage: 'number',
  interpretation: 'plain',
  ...opts,
})

/** Epoch milliseconds. */
export const time = (name: string, opts: ColumnOptions = {}): ColumnDefinition => ({
  name,
  storage: 'number',
  interpretation: { kind: 'datetime' },
  ...opts,
})

export const bool = (name: string, opts: ColumnOptions = {}): ColumnDefinition => ({
  name,
  storage: 'number',
  interpretation: { kind: 'boolean' },
  ...opts,
})

export const json = (name: string, opts: ColumnOptions = {}): ColumnDefinition => ({
  name,
  storage: 'text',
  interpretation: { kind: 'json' },
  ...opts,
})

export const select = (
  name: string,
  options: readonly string[],
  opts: ColumnOptions = {},
): ColumnDefinition => ({
  name,
  storage: 'text',
  interpretation: { kind: 'select', options: [...options] },
  ...opts,
})

/**
 * Read-only for clients. `admin` gets the same read as `member` on purpose:
 * the app owner also plays as a test account, and admin read on
 * `answer_keys` would show them answers mid-game (docs/trd.md §13).
 */
export function serverWritten(read: PermissionLevel): Record<string, RolePermissions> {
  const role = { read, create: false, update: false, delete: false }
  return {
    viewer: { read: false, create: false, update: false, delete: false },
    member: role,
    admin: role,
  }
}
