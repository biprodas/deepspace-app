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

  await nav.getByRole('link', { name: 'Devices' }).click()
  await expect(page.getByTestId('sessions-list')).toContainText('This device', { timeout: 15_000 })

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
