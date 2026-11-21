import { describe, expect, it } from 'vitest'
import { mintJoinCode, parseJoinCode } from './join-code'

describe('parseJoinCode', () => {
  it.each([
    ['K7QX9P', 'K7QX9P'],
    ['k7qx9p', 'K7QX9P'],
    ['  K7Q X9P ', 'K7QX9P'],
    ['K7Q-X9P', 'K7QX9P'],
    ['https://studyarena.app.space/join/k7qx9p', 'K7QX9P'],
    ['studyarena.app.space/join/K7QX9P?ref=chat', 'K7QX9P'],
  ])('reads %j as %s', (input, code) => {
    expect(parseJoinCode(input)).toBe(code)
  })

  it.each(['', 'K7QX9', 'K7QX9PP', 'K7QX9!', 'https://example.com/rooms/K7QX9P'])(
    'rejects %j',
    (input) => {
      expect(parseJoinCode(input)).toBeNull()
    },
  )
})

describe('mintJoinCode', () => {
  it('mints codes that parse back to themselves', () => {
    for (let i = 0; i < 200; i++) {
      const code = mintJoinCode()
      expect(parseJoinCode(code)).toBe(code)
    }
  })

  it('avoids look-alike characters', () => {
    const codes = Array.from({ length: 200 }, () => mintJoinCode()).join('')
    expect(codes).not.toMatch(/[01OIL]/)
  })

  it('maps the random source onto the alphabet', () => {
    expect(mintJoinCode(() => 0)).toBe('AAAAAA')
    expect(mintJoinCode(() => 0.9999)).toBe('999999')
  })
})
