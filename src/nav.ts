/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar.
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
  devOnly?: boolean
  /**
   * Where the link lives: the top bar (default), or the account menu under
   * the user's name, for pages people open now and then (settings, admin).
   */
  placement?: 'main' | 'account'
}

export const nav: NavItem[] = [
  { path: '/home', label: 'Home' },
  { path: '/quizzes', label: 'Quizzes' },
  { path: '/spaces', label: 'Spaces' },
  { path: '/history', label: 'History' },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/settings', label: 'Settings', placement: 'account' },
  { path: '/admin/data', label: 'Data', roles: ['admin'], placement: 'account' },
  // The /api-status debug page still exists — add
  // `{ path: '/api-status', label: 'API Status', devOnly: true }` to surface it.
  // ── Features add nav items below this line ──
]
