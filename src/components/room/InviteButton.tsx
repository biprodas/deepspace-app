/**
 * "Invite" in the focus bar. Everyone gets the join link and code with one
 * button: share sheet on phones, copy elsewhere. The host and
 * co-hosts can also invite people directly, from their earlier games or by
 * email. People who join mid-game start from the next round.
 */

import { useMemo } from 'react'
import { Check, Copy, Share2, UserPlus } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'
import { InvitePeople } from '@/components/room/InvitePeople'
import { joinPath } from '@/lib/join-code'
import { useCopy } from '@/lib/use-copy'
import type { RoomState } from '@/lib/use-room'

export function InviteButton({ state }: { state: RoomState }) {
  const { room, quiz, role, players } = state
  const canInvite = role === 'host' || role === 'co-host'
  const inRoom = useMemo(() => {
    const ids = new Set(players.map((p) => p.data.userId))
    if (room) [room.data.hostId, ...(room.data.coHostIds ?? [])].forEach((id) => ids.add(id))
    return ids
  }, [players, room])
  if (!room) return null

  return (
    <Popover>
      <PopoverTrigger
        data-testid="invite-button"
        render={<Button variant="outline" size="sm" aria-label="Invite people" />}
      >
        <UserPlus aria-hidden="true" />
        <span className="hidden sm:inline">Invite</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        data-testid="invite-card"
        className={cn(
          'flex max-h-[min(40rem,85vh)] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-0',
          canInvite ? 'w-96' : 'w-80',
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Invite people</p>
          <p className="text-xs text-muted-foreground">They can join at any time, even mid-game.</p>
        </div>

        {canInvite && <InvitePeople target={{ roomId: room.recordId }} inRoom={inRoom} />}

        <ShareLink
          code={room.data.code}
          path={joinPath(room.data.code)}
          shareTitle={quiz ? `Join “${quiz.data.title}” on StudyArena` : 'Join my StudyArena game'}
          hint={`Join at ${window.location.host}/join with code`}
          compact={canInvite}
        />
      </PopoverContent>
    </Popover>
  )
}

interface ShareLinkProps {
  code: string
  /** The join path for this code, e.g. joinPath(code). */
  path: string
  /** Share-sheet title, e.g. "Join “Biology” on StudyArena". */
  shareTitle: string
  /** Shown above the big code when not compact, e.g. "Join at host/join with code". */
  hint: string
  compact: boolean
}

/**
 * The code and the link with one button: the device's share sheet where
 * there is one (phones), otherwise copy. Compact under an invite form.
 * Used for rooms here and for study spaces.
 */
export function ShareLink({ code, path, shareTitle, hint, compact }: ShareLinkProps) {
  const link = `${window.location.origin}${path}`
  const { copied, copy } = useCopy()
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function shareOrCopy() {
    if (!canShare) return copy(link)
    try {
      await navigator.share({ title: shareTitle, text: `Join with code ${code}`, url: link })
    } catch (err) {
      // Dismissing the sheet is an AbortError; anything else (refused, unsupported data) falls back to copying.
      if (!(err instanceof DOMException && err.name === 'AbortError')) await copy(link)
    }
  }

  return (
    <>
      {compact ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Or share the link</p>
          <span className="font-mono text-sm font-bold tracking-[0.15em]">{code}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 px-4 py-5 text-center">
          <p className="text-xs font-medium text-muted-foreground">{hint}</p>
          <p className="font-mono text-4xl font-extrabold tracking-[0.18em]">{code}</p>
        </div>
      )}

      <div className={cn('flex flex-col gap-2 px-4 pb-3', compact ? 'pt-2' : 'border-t border-border pt-3')}>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 py-1 pl-3 pr-1">
          <span className="min-w-0 flex-1 truncate font-mono text-xs" title={link}>
            {link}
          </span>
          <Button size="sm" variant={copied ? 'secondary' : 'default'} onClick={() => void shareOrCopy()}>
            {copied ? <Check /> : canShare ? <Share2 /> : <Copy />}
            {copied ? 'Copied' : canShare ? 'Share link' : 'Copy link'}
          </Button>
        </div>
      </div>
    </>
  )
}
