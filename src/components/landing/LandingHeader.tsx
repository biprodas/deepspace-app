import { Link } from 'react-router-dom'
import { Gamepad2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ColorModeToggle } from '../ColorModeToggle'
import { CREATE_QUIZ_PATH, Logo } from './bits'
import { focusHeroJoin } from './JoinCodeForm'

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#educators', label: 'For educators' },
  { href: '#faq', label: 'FAQ' },
]

export const pillLink =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-bold outline-none transition-[transform,background-color,color] hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-primary/40'

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        {/* Brand and nav share a text baseline: the two fonts sit at
            different heights in their line boxes, so centering the boxes
            would leave the words visibly out of line. */}
        <div className="flex items-baseline gap-4">
          <Link to="/" aria-label="StudyArena home" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40">
            <Logo />
          </Link>

          <nav aria-label="Page" className="ml-4 hidden gap-5 text-sm font-bold text-muted-foreground lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-sm outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline">
                {n.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ColorModeToggle />
          {/* The hero's code card is the one place to type a code; this
              shortcut brings it back into view from anywhere on the page. */}
          <a
            href="#join"
            onClick={focusHeroJoin}
            className={cn(pillLink, 'h-10 border border-input bg-card px-3 text-sm md:border-transparent md:bg-transparent md:hover:bg-card')}
          >
            <Gamepad2 aria-hidden="true" className="size-4" />
            <span className="md:hidden">Join</span>
            <span className="hidden md:inline">Join a game</span>
          </a>
          <Link to="/home" className={cn(pillLink, 'h-10 px-2 text-sm text-muted-foreground hover:text-foreground sm:px-3')}>
            Sign in
          </Link>
          <Link
            to={CREATE_QUIZ_PATH}
            className={cn(pillLink, 'hidden h-10 bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 sm:inline-flex')}
          >
            Create a quiz
          </Link>
        </div>
      </div>
    </header>
  )
}
