/**
 * Room join codes: 6 letters or digits, e.g. `K7QX9P` (docs/features.md F3).
 *
 * People type codes off a projector or paste a whole share link, so the
 * parser is forgiving: case, spaces and dashes are ignored, and a
 * `…/join/K7QX9P` link yields its code.
 */

export const JOIN_CODE_LENGTH = 6

/** Returns the normalized code, or null when the input isn't one. */
export function parseJoinCode(input: string): string | null {
  const trimmed = input.trim()
  const fromLink = /\/join\/([^/?#\s]+)/i.exec(trimmed)?.[1]
  const code = (fromLink ?? trimmed).replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z0-9]+$/.test(code) && code.length === JOIN_CODE_LENGTH ? code : null
}

export function joinPath(code: string): string {
  return `/join/${code}`
}

/** No 0/O, 1/I/L: codes are read off a projector and typed on a phone. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A random code; `random` returns uniform values in [0, 1) (injectable for tests). */
export function mintJoinCode(random: () => number = secureRandom): string {
  let code = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)]
  }
  return code
}

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}
