/**
 * Share-link entry: /join/:code (docs/features.md F3). Sign-in is handled by
 * the (protected) layout; this page joins the room once and hands over to
 * /rooms/:roomId. `joinRoom` is idempotent, so a refresh or a second click
 * on the link just lands back in the room.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, DoorClosed, SearchX, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { callAction } from '@/lib/actions-client'
import { parseJoinCode } from '@/lib/join-code'

/** Refusals players can hit, keyed by `joinRoom`'s error code. */
const REFUSALS: Record<string, { icon: ReactNode; title: string; help: string }> = {
  not_found: {
    icon: <SearchX />,
    title: 'No game with that code',
    help: 'Check the code with your host.',
  },
  room_full: {
    icon: <Users />,
    title: 'This game is full',
    help: 'Ask your host to make room, then try the link again.',
  },
  removed: {
    icon: <Ban />,
    title: 'You were removed from this game',
    help: 'The host removed you, so this code no longer works for you.',
  },
  room_closed: {
    icon: <DoorClosed />,
    title: 'This game has finished',
    help: 'Ask your host for the code of their next game.',
  },
}

export default function JoinPage() {
  const { code: raw = '' } = useParams()
  const code = parseJoinCode(raw)
  const navigate = useNavigate()
  const [refusal, setRefusal] = useState<{ code?: string; error: string } | null>(null)
  // React's dev double-mount would otherwise send two joins (harmless, but noisy).
  const sent = useRef(false)

  useEffect(() => {
    if (!code || sent.current) return
    sent.current = true
    void callAction<{ roomId: string }>('joinRoom', { code }).then((result) => {
      if (result.success) navigate(`/rooms/${result.data.roomId}`, { replace: true })
      else setRefusal({ code: result.code, error: result.error })
    })
  }, [code, navigate])

  const known = refusal?.code ? REFUSALS[refusal.code] : undefined

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      {!code ? (
        <>
          <h1 className="font-display text-2xl font-bold">That code doesn&apos;t look right</h1>
          <p className="text-sm text-muted-foreground">Codes are 6 letters or numbers, like K7QX9P.</p>
        </>
      ) : refusal ? (
        <>
          {known && (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground [&_svg]:size-6">
              {known.icon}
            </div>
          )}
          <h1 className="font-display text-2xl font-bold">{known?.title ?? 'Couldn’t join'}</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{known?.help ?? refusal.error}</p>
          <p className="font-mono text-sm font-bold tracking-[0.2em] text-muted-foreground">{code}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Joining room</p>
          <p className="font-mono text-4xl font-bold tracking-[0.2em]">{code}</p>
          <span
            aria-hidden="true"
            className="mt-2 size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
          />
        </>
      )}
      <Link to="/" className="mt-2 text-sm font-bold text-primary-text underline-offset-4 hover:underline">
        Back to StudyArena
      </Link>
    </div>
  )
}
