/**
 * A study space: /spaces/:spaceId (docs/features.md F13). Name and code,
 * who's in it and who's online, games played here, and a way to host one.
 * Non-members get nothing from the server (the `'team'` rule), so they see
 * "not found" and the way to join.
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, LogOut, MoreHorizontal, Pencil, SearchX, Trash2 } from 'lucide-react'
import {
  Button,
  ConfirmModal,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
} from '@/components/ui'
import { CreateSpaceModal } from '@/components/space/CreateSpaceModal'
import { SpaceGames } from '@/components/space/SpaceGames'
import { SpaceInviteButton } from '@/components/space/SpaceInviteButton'
import { SpaceMembers } from '@/components/space/SpaceMembers'
import { usePageTitle } from '@/lib/page-title'
import { useAction } from '@/lib/use-action'
import { useCopy } from '@/lib/use-copy'
import { useSpace } from '@/lib/use-space'

export default function SpacePage() {
  const { spaceId = '' } = useParams()
  const navigate = useNavigate()
  const state = useSpace(spaceId)
  const { space, isOwner, isMember } = state
  const { run, pending } = useAction()
  const { copied, copy } = useCopy()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null)
  usePageTitle(space?.data.name ?? 'Study space')

  if (state.status === 'loading') {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading space…</div>
  }
  if (!space || (!isMember && !isOwner)) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Space not found"
        description="It may have been deleted, or you’re not a member. Ask a member for the code."
        action={{ label: 'Go to spaces', onClick: () => navigate('/spaces') }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 data-testid="space-name" className="font-display text-3xl font-bold tracking-tight">
            {space.data.name}
          </h1>
          {space.data.description && <p className="mt-1 text-sm text-muted-foreground">{space.data.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="space-code"
            onClick={() => void copy(space.data.code)}
            title={copied ? 'Copied' : 'Copy code'}
            aria-label={copied ? 'Space code copied' : `Copy space code ${space.data.code.split('').join(' ')}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 font-mono text-sm font-bold tracking-[0.15em] hover:bg-secondary/70"
          >
            {space.data.code}
            {copied ? <Check className="size-3.5 text-correct" aria-hidden="true" /> : <Copy className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          </button>
          <SpaceInviteButton state={state} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Space options" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {isOwner ? (
                <>
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil aria-hidden /> Edit space
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirm('delete')} className="text-destructive focus:text-destructive">
                    <Trash2 aria-hidden /> Delete space
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => setConfirm('leave')} className="text-destructive focus:text-destructive">
                  <LogOut aria-hidden /> Leave space
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SpaceGames state={state} />
        <SpaceMembers state={state} />
      </div>

      {editing && (
        <CreateSpaceModal
          open
          onClose={() => setEditing(false)}
          editing={{ spaceId: space.recordId, name: space.data.name, description: space.data.description }}
        />
      )}
      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'delete' ? `Delete “${space.data.name}”?` : `Leave “${space.data.name}”?`}
        description={
          confirm === 'delete'
            ? 'Everyone loses access to the space. Games played in it are kept in each player’s history.'
            : 'You can rejoin later with the space code.'
        }
        confirmText={confirm === 'delete' ? 'Delete space' : 'Leave'}
        loading={pending === 'deleteSpace' || pending === 'leaveSpace'}
        onConfirm={async () => {
          const res = await run(confirm === 'delete' ? 'deleteSpace' : 'leaveSpace', { spaceId: space.recordId })
          setConfirm(null)
          if (res.success) navigate('/spaces')
        }}
      />
    </div>
  )
}
