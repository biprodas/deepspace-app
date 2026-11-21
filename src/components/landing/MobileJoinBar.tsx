/**
 * Phone-only bottom bar with both actions, shown once the hero (and its join
 * field) has scrolled away. Starts hidden so the prerendered HTML and the
 * first client render agree; the observer reveals it after hydration.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { CREATE_QUIZ_PATH } from './bits'
import { focusHeroJoin } from './JoinCodeForm'
import { pillLink } from './LandingHeader'

export function MobileJoinBar({ watchId }: { watchId: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const target = document.getElementById(watchId)
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting))
    observer.observe(target)
    return () => observer.disconnect()
  }, [watchId])

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none md:hidden',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <div className="flex gap-2">
        <a
          href="#join"
          onClick={focusHeroJoin}
          className={cn(pillLink, 'h-12 flex-1 bg-foreground text-base text-background')}
        >
          Join with code
        </a>
        <Link to={CREATE_QUIZ_PATH} className={cn(pillLink, 'h-12 flex-1 bg-primary text-base text-primary-foreground')}>
          Create quiz
        </Link>
      </div>
    </div>
  )
}
