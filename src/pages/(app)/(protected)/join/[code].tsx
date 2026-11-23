/**
 * Share-link entry: /join/:code (docs/features.md F3). Sign-in is handled by
 * the (protected) layout; this page joins the room once and hands over to
 * /rooms/:roomId. `joinRoom` is idempotent, so a refresh or a second click
 * on the link just lands back in the room.
 *
 * Game and study-space codes look alike, so a code with no game is tried as
 * a space next (`joinSpace`, also idempotent) and opens that space. The
 * header's Join box and the Home code field both land here.
 */

import { usePageTitle } from '@/lib/page-title'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, DoorClosed, SearchX, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { callAction } from '@/lib/actions-client'
import { parseJoinCode } from '@/lib/join-code'

/** Refusals people can hit, keyed by `joinRoom`'s error code (`space:` + `joinSpace`'s). */
const REFUSALS: Record<string, { icon: ReactNode; title: string; help: string }> = {
  not_found: {
    icon: <SearchX />,
    title: 'No game or space with that code',
    help: 'Check the code with whoever shared it.',
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
  'space:removed': {
    icon: <Ban />,
    title: 'You were removed from this space',
    help: 'The owner removed you, so this code no longer works for you.',
  },
  'space:space_full': {
    icon: <Users />,
    title: 'This space is full',
    help: 'Ask the owner to make room, then try the code again.',
  },
}

export default function JoinPage() {
  const { code: raw = '' } = useParams()
  const code = parseJoinCode(raw)
  const navigate = useNavigate()
  usePageTitle(code ? `Join ${code}` : 'Join a game')
  const [refusal, setRefusal] = useState<{ code?: string; error: string } | null>(null)
  // React's dev double-mount would otherwise send two joins (harmless, but noisy).
  const sent = useRef(false)

  useEffect(() => {
    if (!code || sent.current) return
    sent.current = true
    void (async () => {
      const room = await callAction<{ roomId: string }>('joinRoom', { code })
      if (room.success) return navigate(`/rooms/${room.data.roomId}`, { replace: true })
      if (room.code !== 'not_found') return setRefusal({ code: room.code, error: room.error })
      // No game with this code: it may be a study space's.
      const space = await callAction<{ spaceId: string }>('joinSpace', { code })
      if (space.success) return navigate(`/spaces/${space.data.spaceId}`, { replace: true })
      setRefusal(
        space.code === 'not_found'
          ? { code: 'not_found', error: space.error }
          : { code: `space:${space.code}`, error: space.error },
      )
    })()
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
          <p className="text-sm text-muted-foreground">Joining</p>
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
