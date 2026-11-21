import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consumePendingReturn, DEFAULT_AFTER_AUTH, rememberRedirect, safeRedirect, signInPath } from './auth-redirect'

describe('safeRedirect', () => {
  it.each([
    ['/join/K7QX9P', '/join/K7QX9P'],
    ['/quizzes/new', '/quizzes/new'],
    ['/rooms/abc?tab=players#top', '/rooms/abc?tab=players#top'],
  ])('keeps the same-origin path %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })

  it.each([
    null,
    '',
    'home',
    '//evil.com',
    '//evil.com/join/K7QX9P',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/sign-in',
    '/sign-up?redirect=/home',
  ])('falls back to the default for %j', (input) => {
    expect(safeRedirect(input)).toBe(DEFAULT_AFTER_AUTH)
  })
})

describe('signInPath', () => {
  it('carries the return path', () => {
    expect(signInPath('/join/K7QX9P')).toBe('/sign-in?redirect=%2Fjoin%2FK7QX9P')
    expect(signInPath('/quizzes/new', '/sign-up')).toBe('/sign-up?redirect=%2Fquizzes%2Fnew')
  })

  it('omits the param for the default destination', () => {
    expect(signInPath('/home')).toBe('/sign-in')
    expect(signInPath(undefined)).toBe('/sign-in')
  })
})

describe('pending return across the OAuth round trip', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('returns the saved target once, then nothing', () => {
    rememberRedirect('/join/K7QX9P')
    expect(consumePendingReturn()).toBe('/join/K7QX9P')
    expect(consumePendingReturn()).toBeNull()
  })

  it('ignores a stale target', () => {
    rememberRedirect('/join/K7QX9P')
    expect(consumePendingReturn(Date.now() + 16 * 60 * 1000)).toBeNull()
  })

  it('never returns an unsafe target', () => {
    rememberRedirect('//evil.com')
    expect(consumePendingReturn()).toBe(DEFAULT_AFTER_AUTH)
  })

  it('is null when nothing was saved', () => {
    expect(consumePendingReturn()).toBeNull()
  })
})
