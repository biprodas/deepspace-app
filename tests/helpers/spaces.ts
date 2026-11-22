import type { CallAction } from './actions'

/**
 * Spaces created by a test, deleted after it (pass `deleteTestSpaces` to
 * `test.afterEach`). Test accounts are reused across runs and can own only
 * MAX_OWNED_SPACES spaces, so leftovers would eventually block createSpace.
 */
const created: { owner: CallAction; spaceId: string }[] = []

export async function createTestSpace(owner: CallAction, name: string) {
  const res = await owner<{ spaceId: string; code: string }>('createSpace', { name })
  if (!res.success || !res.data) throw new Error(`createSpace failed: ${res.error}`)
  created.push({ owner, spaceId: res.data.spaceId })
  return res.data
}

export async function deleteTestSpaces() {
  for (const { owner, spaceId } of created.splice(0)) {
    await owner('deleteSpace', { spaceId }).catch(() => undefined)
  }
}
