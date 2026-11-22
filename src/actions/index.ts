import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { adminActions } from './admin'
import { boardActions } from './board'
import { gameActions } from './game'
import { inviteActions } from './invite'
import { noteActions } from './note'
import { pollActions } from './poll'
import { quizActions } from './quiz'
import { roomActions } from './room'
import { spaceActions } from './space'

const registry = {
  ...quizActions,
  ...roomActions,
  ...inviteActions,
  ...pollActions,
  ...spaceActions,
  ...noteActions,
  ...boardActions,
  ...gameActions,
  ...adminActions,
}

export const actions: Record<string, ActionHandler<Env>> = registry

export type ActionName = keyof typeof registry
