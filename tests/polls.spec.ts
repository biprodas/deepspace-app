/**
 * Polls, "still confused" and reactions (docs/features.md F12): a host's
 * poll reaches players live, votes are counted on the server, closed polls
 * and hosts can't vote, and confused flags count once per player.
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { actionsAs, type CallAction } from './helpers/actions'

const accounts = loadAllTestAccounts().length
test.skip(accounts < 2, 'Needs 2 test accounts (host + player)')
test.describe.configure({ timeout: 120_000 })

const GRACE_MS = 300

async function openLobby(host: CallAction, questionCount = 1) {
  const { data: quiz } = await host<{ quizId: string }>('createQuiz', { sourceType: 'manual', title: 'Polls' })
  for (let i = 0; i < questionCount; i++) {
    await host('addQuestion', {
      quizId: quiz!.quizId,
      prompt: `Poll question ${i + 1}?`,
      options: [`right ${i}`, `wrong a ${i}`, `wrong b ${i}`, `wrong c ${i}`],
      correctIndex: 0,
      timeLimit: 10,
    })
  }
  const { data: room } = await host<{ roomId: string; code: string }>('createRoom', { quizId: quiz!.quizId })
  return room!
}

test('a poll reaches the player, counts their vote live, and closes', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  const { roomId, code } = await openLobby(host)
  await player('joinRoom', { code })

  await hostUser.page.goto(`/rooms/${roomId}`)
  await playerUser.page.goto(`/rooms/${roomId}`)

  // The host opens a poll from a template.
  await hostUser.page.getByTestId('new-poll').click({ timeout: 15_000 })
  await hostUser.page.getByRole('button', { name: 'Pace' }).click()
  await hostUser.page.getByRole('button', { name: 'Start poll' }).click()

  // The player sees it and votes; both see the count.
  const playerPoll = playerUser.page.getByTestId('poll-card')
  await expect(playerPoll).toContainText('How is the pace?', { timeout: 10_000 })
  await playerPoll.getByRole('button', { name: /Just right/ }).click()
  await expect(playerPoll).toContainText('1 vote', { timeout: 15_000 })
  await expect(hostUser.page.getByTestId('poll-card')).toContainText('1 vote', { timeout: 10_000 })

  // Changing the vote keeps one vote.
  await playerPoll.getByRole('button', { name: /Too slow/ }).click()
  await expect(playerPoll.getByRole('button', { name: /Too slow/ })).toHaveAttribute('aria-pressed', 'true', {
    timeout: 15_000,
  })
  await expect(playerPoll).toContainText('1 vote', { timeout: 15_000 })

  // Hosts can't vote; closed polls refuse votes.
  const { data: poll } = await host<{ pollId: string }>('createPoll', {
    roomId,
    question: 'Second?',
    options: ['Yes', 'No'],
  })
  expect(await host('votePoll', { pollId: poll!.pollId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'not_a_player',
  })
  await hostUser.page.getByTestId('poll-card').getByRole('button', { name: 'Close poll' }).click({ timeout: 10_000 })
  await expect(playerUser.page.getByTestId('poll-card')).toHaveAttribute('data-status', 'closed', { timeout: 10_000 })
  expect(await player('votePoll', { pollId: poll!.pollId, choiceIndex: 0 })).toMatchObject({
    success: false,
    code: 'poll_closed',
  })
})

test('"still confused" counts once per player and shows on the host screen', async ({ users }) => {
  const [hostUser, playerUser] = await users(2)
  const host = await actionsAs(hostUser.page)
  const player = await actionsAs(playerUser.page)
  // Two questions, so revealing the first doesn't end the game.
  const { roomId, code } = await openLobby(host, 2)
  await player('joinRoom', { code })

  const { roundId, deadline } = (await host<{ roundId: string; deadline: number }>('startQuestion', { roomId })).data!
  expect(await player('flagConfused', { roundId })).toMatchObject({ success: false, code: 'invalid_state' })

  const now = (await host('getServerTime')).data!.serverNow
  await new Promise((r) => setTimeout(r, Math.max(0, deadline + GRACE_MS - now) + 150))
  await host('revealQuestion', { roomId })

  await playerUser.page.goto(`/rooms/${roomId}`)
  await playerUser.page.getByTestId('flag-confused').click({ timeout: 15_000 })
  await expect(playerUser.page.getByTestId('flag-confused')).toBeDisabled()
  // A second flag from the same player doesn't count twice.
  expect(await player('flagConfused', { roundId })).toMatchObject({ success: true, data: { confusedCount: 1 } })

  await hostUser.page.goto(`/rooms/${roomId}`)
  await expect(hostUser.page.getByTestId('confused-count')).toHaveText(/1 player is still confused/, {
    timeout: 15_000,
  })
})
