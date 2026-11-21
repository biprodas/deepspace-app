/**
 * Live-game actions (docs/trd.md §5–6). The game loop itself lands in M3;
 * for now this holds the clock-sync endpoint.
 */

import { z } from 'zod'
import { defineAction } from './shared'

/** Returns `serverNow` (added by `defineAction`) for clock-offset sync (docs/trd.md §7). */
const getServerTime = defineAction(z.object({}), async () => ({}))

export const gameActions = {
  getServerTime,
}
