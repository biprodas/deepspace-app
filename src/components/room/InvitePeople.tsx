/**
 * Invite form, for a game (host's invite card) or a study space: pick people
 * from earlier games or type emails, then send. Account holders get a live
 * invite on Home; everyone with an address also gets an email
 * (docs: src/actions/invite.ts).
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Mail, Search, Send, X } from 'lucide-react'
import { Button, Checkbox, Input, cn, useToast } from '@/components/ui'
import { Initials } from '@/components/landing/bits'
import { MAX_INVITES_PER_CALL } from '@/lib/game-rules'
import { useAction } from '@/lib/use-action'
import type { InviteOutcome, RecentPlayer } from '@/actions/invite'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Where the invites go: a room (`invitePlayers`) or a space (`inviteToSpace`). */
export type InviteTarget = { roomId: string } | { spaceId: string }

interface InvitePeopleProps {
  target: InviteTarget
  /** Account ids already in (playing, hosting, or members); marked as such in the list. */
  inRoom: Set<string>
}

export function InvitePeople({ target, inRoom }: InvitePeopleProps) {
  const action = 'spaceId' in target ? 'inviteToSpace' : 'invitePlayers'
  const inLabel = 'spaceId' in target ? 'Member' : 'In game'
  const { run, pending } = useAction()
  const toast = useToast()
  const [recent, setRecent] = useState<RecentPlayer[] | null>(null)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [emails, setEmails] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState('')

  useEffect(() => {
    let live = true
    void run<{ players: RecentPlayer[] }>('recentPlayers', {}, 'recentPlayers', { toast: false }).then((res) => {
      if (live) setRecent(res.success ? res.data.players : [])
    })
    return () => {
      live = false
    }
  }, [run])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (recent ?? []).filter((p) => !q || p.displayName.toLowerCase().includes(q))
  }, [recent, search])

  const count = picked.size + emails.length
  const full = count >= MAX_INVITES_PER_CALL

  function togglePick(userId: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else if (!full) next.add(userId)
      return next
    })
  }

  /** Adds every address in the draft (comma/space separated); keeps any that aren't valid. */
  function addDraft(): boolean {
    const parts = draft.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    if (parts.length === 0) return false
    const valid = parts.filter((e) => EMAIL.test(e))
    const invalid = parts.filter((e) => !EMAIL.test(e))
    const room = MAX_INVITES_PER_CALL - count
    const added = valid.filter((e) => !emails.includes(e)).slice(0, room)
    setEmails((prev) => [...prev, ...added])
    setDraft(invalid.join(' '))
    setDraftError(
      invalid.length
        ? `Not an email: ${invalid.join(', ')}`
        : added.length < valid.filter((e) => !emails.includes(e)).length
          ? `Up to ${MAX_INVITES_PER_CALL} people at a time`
          : '',
    )
    return added.length > 0
  }

  function onDraftKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addDraft()
    } else if (e.key === 'Backspace' && !draft && emails.length) {
      setEmails((prev) => prev.slice(0, -1))
    }
  }

  async function send() {
    // Include a typed-but-not-added address, so "type, then Send" just works.
    const pendingDraft = draft.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => EMAIL.test(s))
    const allEmails = [...new Set([...emails, ...pendingDraft])].slice(0, MAX_INVITES_PER_CALL - picked.size)
    if (picked.size + allEmails.length === 0) return

    const res = await run<{ results: { label: string; outcome: InviteOutcome }[] }>(action, {
      ...target,
      userIds: [...picked],
      emails: allEmails,
      origin: window.location.origin,
    })
    if (!res.success) return

    const by = (o: InviteOutcome) => res.data.results.filter((r) => r.outcome === o).map((r) => r.label)
    const invited = by('invited')
    const skipped = [...by('already_invited'), ...by('already_in')]
    const failed = by('email_failed')
    if (invited.length) toast.success(`Invited ${list(invited)}`)
    if (skipped.length) toast.info(`Already invited or already in: ${list(skipped)}`)
    if (failed.length) toast.error(`Couldn’t email ${list(failed)}`, 'Share the link with them instead.')

    setPicked(new Set())
    setEmails([])
    setDraft('')
    setDraftError('')
  }

  const canSend = count > 0 || draft.trim().length > 0

  return (
    <div data-testid="invite-people" className="flex flex-col gap-3 px-4 py-3">
      <div>
        <label htmlFor="invite-emails" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Invite by email
        </label>
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring',
            draftError && 'border-destructive',
          )}
        >
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {emails.map((email) => (
            <span key={email} className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2 pr-1 text-xs">
              {email}
              <button
                type="button"
                aria-label={`Remove ${email}`}
                onClick={() => setEmails((prev) => prev.filter((e) => e !== email))}
                className="rounded-full p-0.5 hover:bg-background"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            id="invite-emails"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={emails.length ? '' : 'name@example.com'}
            value={draft}
            disabled={full}
            onChange={(e) => {
              setDraft(e.target.value)
              setDraftError('')
            }}
            onKeyDown={onDraftKey}
            onBlur={addDraft}
            className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {draftError && <p className="mt-1 text-xs text-destructive">{draftError}</p>}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">From your earlier games</p>
        {recent === null ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="rounded-lg bg-secondary/50 px-3 py-3 text-center text-xs text-muted-foreground">
            People who play your games will show up here.
          </p>
        ) : (
          <>
            {recent.length > 5 && (
              <div className="relative mb-1.5">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name"
                  aria-label="Search people from earlier games"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            )}
            <ul className="max-h-44 overflow-y-auto rounded-lg border border-border">
              {shown.map((p, i) => {
                const playing = inRoom.has(p.userId)
                const checked = picked.has(p.userId)
                return (
                  <li key={p.userId}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-sm hover:bg-accent',
                        (playing || (full && !checked)) && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                      )}
                    >
                      <Checkbox
                        checked={checked || playing}
                        disabled={playing || (full && !checked)}
                        onCheckedChange={() => togglePick(p.userId)}
                        aria-label={`Invite ${p.displayName}`}
                      />
                      <Initials name={p.displayName} i={i} className="size-6 text-[10px]" />
                      <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                      {playing && <span className="text-[11px] text-muted-foreground">{inLabel}</span>}
                    </label>
                  </li>
                )
              })}
              {shown.length === 0 && (
                <li className="px-3 py-3 text-center text-xs text-muted-foreground">No one matches “{search}”.</li>
              )}
            </ul>
          </>
        )}
      </div>

      <Button
        size="sm"
        disabled={!canSend}
        loading={pending === action}
        onClick={() => void send()}
        data-testid="send-invites"
      >
        <Send /> {count > 0 ? `Send ${count} invite${count === 1 ? '' : 's'}` : 'Send invites'}
      </Button>
    </div>
  )
}

function list(labels: string[]): string {
  return labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`
}
