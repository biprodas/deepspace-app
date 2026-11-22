/**
 * Space share link: /spaces/join/:code. Joins once and hands over to the
 * space. `joinSpace` is idempotent, so a refresh just lands back in it.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ban, SearchX, UsersRound } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { callAction } from '@/lib/actions-client'
import { parseJoinCode } from '@/lib/join-code'
import { usePageTitle } from '@/lib/page-title'

const REFUSALS: Record<string, { icon: ReactNode; title: string; help: string }> = {
  not_found: { icon: <SearchX />, title: 'No space with that code', help: 'Check the code with whoever invited you.' },
  removed: { icon: <Ban />, title: 'You were removed from this space', help: 'The owner removed you, so this code no longer works for you.' },
  space_full: { icon: <UsersRound />, title: 'This space is full', help: 'Ask the owner to make room, then try the link again.' },
}

export default function JoinSpacePage() {
  const { code: raw = '' } = useParams()
  const code = parseJoinCode(raw)
  const navigate = useNavigate()
  usePageTitle('Join a space')
  const [refusal, setRefusal] = useState<{ code?: string; error: string } | null>(null)
  const sent = useRef(false)

  useEffect(() => {
    if (!code || sent.current) return
    sent.current = true
    void callAction<{ spaceId: string }>('joinSpace', { code }).then((result) => {
      if (result.success) navigate(`/spaces/${result.data.spaceId}`, { replace: true })
      else setRefusal({ code: result.code, error: result.error })
    })
  }, [code, navigate])

  if (!code) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="That link doesn’t have a valid code"
        description="Codes are 6 letters or numbers, like K7QX9P."
        action={{ label: 'Go to spaces', onClick: () => navigate('/spaces') }}
      />
    )
  }
  if (refusal) {
    const known = refusal.code ? REFUSALS[refusal.code] : undefined
    return (
      <EmptyState
        icon={known?.icon ?? <SearchX />}
        title={known?.title ?? 'Couldn’t join the space'}
        description={known?.help ?? refusal.error}
        action={{ label: 'Go to spaces', onClick: () => navigate('/spaces') }}
      />
    )
  }
  return <p className="p-10 text-center text-sm text-muted-foreground">Joining space {code}…</p>
}
