import { describe, expect, it } from 'vitest'
import { SLASH_COMMANDS, filterSlashCommands } from './slash-commands'

const ids = (q: string) => filterSlashCommands(q).map((c) => c.id)

describe('filterSlashCommands', () => {
  it('lists everything for an empty query', () => {
    expect(ids('')).toHaveLength(SLASH_COMMANDS.length)
  })

  it('finds by title word and keyword', () => {
    expect(ids('head')).toEqual(['h1', 'h2', 'h3'])
    expect(ids('h2')).toEqual(['h2'])
    expect(ids('todo')).toEqual(['todo'])
    expect(ids('check')).toEqual(['todo'])
  })

  it('puts prefix matches before contains matches', () => {
    // "list" starts a word in three titles; "unordered" only contains "order".
    expect(ids('list').slice(0, 3).sort()).toEqual(['bullets', 'numbers', 'todo'])
    expect(ids('order')).toEqual(['numbers', 'bullets'])
  })

  it('is case-insensitive and returns nothing for nonsense', () => {
    expect(ids('QUOTE')).toEqual(['quote'])
    expect(ids('zzz')).toEqual([])
  })
})
