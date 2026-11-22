/**
 * Study spaces: /spaces (docs/features.md F13). The spaces the user is in,
 * live (the `'team'` rule only sends those), a way to create one, and a
 * code field to join one.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ChevronRight, Crown, Plus, UsersRound } from 'lucide-react'
import { Button, EmptyState, Input } from '@/components/ui'
import { CreateSpaceModal } from '@/components/space/CreateSpaceModal'
import { parseJoinCode, spaceJoinPath } from '@/lib/join-code'
import { usePageTitle } from '@/lib/page-title'
import type { Space } from '@/schemas/space-types'

export default function SpacesPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  usePageTitle('Study spaces')
  const [creating, setCreating] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const { records, status } = useQuery<Space>('spaces', { orderBy: 'createdAt', orderDir: 'desc' })

  function join(e: FormEvent) {
    e.preventDefault()
    const parsed = parseJoinCode(code)
    if (!parsed) return setCodeError('Codes are 6 letters or numbers, like K7QX9P')
    navigate(spaceJoinPath(parsed))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Study spaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">A home for each study group: members and games in one place.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New space
        </Button>
      </header>

      <form onSubmit={join} className="mb-8 flex flex-wrap items-start gap-2" aria-label="Join a space">
        <div className="min-w-0 flex-1">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setCodeError('')
            }}
            placeholder="Have a space code? K7QX9P"
            aria-label="Space code"
            aria-invalid={!!codeError}
            className="font-mono uppercase tracking-[0.15em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
          />
          {codeError && <p className="mt-1 text-xs text-destructive">{codeError}</p>}
        </div>
        <Button type="submit" variant="outline" disabled={!code.trim()}>
          Join
        </Button>
      </form>

      {status === 'loading' || !user ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading spaces…</p>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title="No spaces yet"
          description="Create one for your study group, or join one with a code."
          action={{ label: 'Create a space', onClick: () => setCreating(true) }}
        />
      ) : (
        <ul data-testid="spaces-list" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {records.map((space) => (
            <li key={space.recordId}>
              <Link to={`/spaces/${space.recordId}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {space.data.name}
                    {space.data.ownerId === user.id && (
                      <Crown className="size-3.5 shrink-0 fill-warning text-warning" aria-label="You own this space" />
                    )}
                  </p>
                  {space.data.description && (
                    <p className="truncate text-xs text-muted-foreground">{space.data.description}</p>
                  )}
                </div>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateSpaceModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
