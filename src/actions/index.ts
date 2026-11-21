import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { gameActions } from './game'
import { quizActions } from './quiz'
import { roomActions } from './room'

const registry = {
  ...quizActions,
  ...roomActions,
  ...gameActions,
}

export const actions: Record<string, ActionHandler<Env>> = registry

export type ActionName = keyof typeof registry
