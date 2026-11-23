/**
 * Settings (docs/features.md F18): one section per page from the menu,
 * rename (shown in the nav straight away), password errors, signed-in
 * devices, and preferences that stick. Everything
 * changed is changed back, since test accounts are reused across runs; the
 * password is never actually changed.
 */

import { test, expect } from 'deepspace/testing'

test.describe.configure({ timeout: 90_000 })

test('rename shows straight away, and the name can be put back', async ({ users }) => {
  const [u] = await users(1)
  const page = u.page
  await page.goto('/settings')
  const name = page.getByLabel('Name')
  await expect(name).not.toHaveValue('', { timeout: 15_000 })
  const original = await name.inputValue()

  const renamed = `${original} R`
  await name.fill(renamed)
  await page.getByTestId('profile-save').click()
  await expect(page.getByTestId('nav-user-name')).toHaveText(renamed, { timeout: 15_000 })

  await name.fill(original)
  await page.getByTestId('profile-save').click()
  await expect(page.getByTestId('nav-user-name')).toHaveText(original, { timeout: 15_000 })
})

test('password, devices and preferences', async ({ users }) => {
  const [u] = await users(1)
  const page = u.page
  await page.goto('/settings')

  // Test accounts sign in with email and password, so the password form shows.
  await expect(page.getByTestId('profile-signin')).toHaveText(/Email and password/, { timeout: 15_000 })
  const nav = page.getByTestId('settings-nav')

  // One section at a time: opening Password replaces Profile.
  await nav.getByRole('link', { name: 'Password' }).click()
  await expect(page).toHaveURL(/\/settings\/password$/)
  await expect(page.getByTestId('settings-profile')).toHaveCount(0)
  await page.getByLabel('Current password').fill('definitely-not-it')
  await page.getByLabel('New password', { exact: true }).fill('NotUsed-12345678')
  await page.getByLabel('Confirm new password').fill('NotUsed-12345678')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByTestId('password-error')).toHaveText('That current password isn’t right.')

  // Devices lists sessions, or (when the test account's sign-in is over a day old) asks to sign in again.
  await nav.getByRole('link', { name: 'Devices' }).click()
  const list = page.getByTestId('sessions-list')
  await expect(list.or(page.getByTestId('sessions-reauth'))).toBeVisible({ timeout: 15_000 })
  if (await list.isVisible()) await expect(list).toContainText('This device')

  await nav.getByRole('link', { name: 'Preferences' }).click()
  await expect(page).toHaveURL(/\/settings\/preferences$/)

  // Theme applies at once.
  await page.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
  await page.getByTestId('theme-light').click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
  await page.getByTestId('theme-system').click()

  // Device and synced preferences stick across a reload; then put them back.
  const reactions = page.getByTestId('pref-reactions')
  const inviteEmails = page.getByTestId('pref-invite-emails')
  await expect(inviteEmails).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 })
  await reactions.click()
  await inviteEmails.click()
  await expect(inviteEmails).toHaveAttribute('aria-checked', 'false')
  await page.waitForTimeout(1_000)
  await page.reload()
  await expect(page.getByTestId('pref-reactions')).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 })
  await expect(page.getByTestId('pref-invite-emails')).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 })
  await page.getByTestId('pref-reactions').click()
  await page.getByTestId('pref-invite-emails').click()
  await expect(page.getByTestId('pref-invite-emails')).toHaveAttribute('aria-checked', 'true')
})

test('Devices asks to sign in again when the sign-in is too old, instead of showing an empty list', async ({ users }) => {
  const [u] = await users(1)
  const page = u.page
  // The auth service refuses device listing once a session is over a day old.
  await page.route('**/api/auth/list-sessions', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Session is not fresh', code: 'SESSION_NOT_FRESH' }),
    }),
  )
  await page.goto('/settings/devices')
  const prompt = page.getByTestId('sessions-reauth')
  await expect(prompt).toContainText('Sign in again to see your devices', { timeout: 15_000 })
  // Not clicked: signing out would end the shared test account's session for other tests.
  await expect(prompt.getByRole('button', { name: 'Sign in again' })).toBeEnabled()
  await expect(page.getByTestId('sessions-list')).toHaveCount(0)
})
