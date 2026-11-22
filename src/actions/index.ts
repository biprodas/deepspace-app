import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { adminActions } from './admin'
import { gameActions } from './game'
import { inviteActions } from './invite'
import { pollActions } from './poll'
import { quizActions } from './quiz'
import { roomActions } from './room'

const registry = {
  ...quizActions,
  ...roomActions,
  ...inviteActions,
  ...pollActions,
  ...gameActions,
  ...adminActions,
}

export const actions: Record<string, ActionHandler<Env>> = registry

export type ActionName = keyof typeof registry
