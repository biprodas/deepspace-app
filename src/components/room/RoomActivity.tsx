/**
 * Live extras under a lobby or game screen (docs/features.md F12): the
 * room's latest poll, the host's "Poll" button, and everyone's reaction bar,
 * with reactions floating over the screen. Fixed to the bottom of the
 * viewport, with a spacer of the same height so it never covers the end of
 * the screen's content.
 */

import { useEffect, useRef, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { RoomState } from '@/lib/use-room'
import { PollCard } from './PollCard'
import { PollComposer } from './PollComposer'
import { ReactionBar, ReactionOverlay, useRoomReactions } from './Reactions'

export function RoomActivity({ state }: { state: RoomState }) {
  const { room, role, poll, myVotes } = state
  const { floating, send } = useRoomReactions(state)
  const [composing, setComposing] = useState(false)
  // A closed poll can be hidden; a new poll shows again.
  const [hiddenPollId, setHiddenPollId] = useState<string | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const [dockHeight, setDockHeight] = useState(0)

  useEffect(() => {
    const el = dockRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setDockHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [room?.recordId])

  if (!room) return null

  const canManage = role === 'host' || role === 'co-host'
  const showPoll = poll && (poll.data.status === 'open' || poll.recordId !== hiddenPollId)

  return (
    <>
      <ReactionOverlay floating={floating} />
      {/* Reserves the dock's height at the end of the page so nothing ends up underneath it. */}
      <div aria-hidden="true" style={{ height: dockHeight }} />
      <div
        ref={dockRef}
        data-testid="room-activity"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-4 pb-4 sm:items-end sm:px-6"
      >
        {showPoll && (
          <div className="pointer-events-auto w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-2">
            <PollCard
              pollId={poll.recordId}
              poll={poll.data}
              myChoice={myVotes.get(poll.recordId)}
              canManage={canManage}
              onDismiss={() => setHiddenPollId(poll.recordId)}
            />
          </div>
        )}
        <div className="pointer-events-auto flex items-center gap-2">
          <ReactionBar onSend={send} />
          {canManage && (
            <Button variant="outline" className="h-11 rounded-full shadow-lg" onClick={() => setComposing(true)} data-testid="new-poll">
              <BarChart3 /> Poll
            </Button>
          )}
        </div>
      </div>
      {canManage && <PollComposer roomId={room.recordId} open={composing} onClose={() => setComposing(false)} />}
    </>
  )
}
