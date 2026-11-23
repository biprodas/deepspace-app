/**
 * Integration Billing Config
 *
 * Configure who pays for each integration's API calls.
 *
 * - 'developer': The app owner pays (default).
 * - 'user': The calling user pays.
 *
 * Every integration requires a signed-in caller. Set `anonymous: true` on a
 * 'developer' integration to let signed-out visitors call it too — the owner
 * then pays for anyone who can reach the app.
 *
 * Integrations not listed here default to 'developer' with sign-in required.
 *
 * `serverOnly: true` closes the browser proxy (/api/integrations/:name/*) to
 * an integration, leaving it to server actions and jobs. Every integration
 * this app uses is owner-billed and called from server code behind daily
 * caps, membership checks and the audit log; open to browsers, any signed-in
 * user could call Claude or send email on the owner's bill around all of
 * that (docs/trd.md §9, "Credit drain").
 *
 * IMPORTANT: any integration backed by per-user connected accounts (Google,
 * Composio) must be 'user' — the api-worker resolves the account from the
 * JWT subject. With 'developer' the app owner's JWT is forwarded, so every
 * signed-in user connects and acts on the app owner's account. Server code
 * that acts for a user in the background (e.g. a cron job) uses
 * `callComposio(env, ..., { asUser })` from 'deepspace/worker' instead.
 */

export const integrations: Record<
  string,
  { billing: 'developer' | 'user'; anonymous?: boolean; serverOnly?: boolean }
> = {
  google: { billing: 'user' },
  composio: { billing: 'user' },
  anthropic: { billing: 'developer', serverOnly: true },
  wikipedia: { billing: 'developer', serverOnly: true },
  email: { billing: 'developer', serverOnly: true },
  // openai: { billing: 'developer', anonymous: true },
}
