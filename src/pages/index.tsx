/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Top-level pages are also prerendered to static HTML at build
 * (prerender.ts, via vite.config.ts) so crawlers read real content.
 * Keep them renderable without a browser: no window/document during render,
 * prose in HTML text, reveal animations in CSS keyframes rather than JS-driven
 * initial states. `<Seo>` comes first and reads src/seo.ts.
 *
 * Two visitors arrive here: hosts (usually on a laptop, deciding whether to
 * try it) and players (usually on a phone, holding a code). "Create a quiz"
 * is the primary button; the game-code card is always in the hero, and
 * "Join a game" beside it jumps to that field.
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Gamepad2 } from 'lucide-react'
import { Seo } from '../components/Seo'
import { seo } from '../seo'
import { cn } from '@/lib/utils'
import { CREATE_QUIZ_PATH } from '../components/landing/bits'
import { focusHeroJoin, HERO_JOIN_INPUT_ID, JoinCodeForm, OPEN_HERO_JOIN_EVENT } from '../components/landing/JoinCodeForm'
import { LandingHeader, pillLink } from '../components/landing/LandingHeader'
import {
  Audiences,
  CtaBand,
  Faq,
  HowItWorks,
  LandingFooter,
  PlayerSide,
  Receipts,
} from '../components/landing/LandingSections'
import { Features } from '../components/landing/Features'
import { MobileJoinBar } from '../components/landing/MobileJoinBar'
import { QuizPreview } from '../components/landing/QuizPreview'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="text-base text-foreground md:text-[17px]">
        <LandingHeader />
        <main>
          <Hero />
          <HowItWorks />
          <Features />
          <Receipts />
          <PlayerSide />
          <Audiences />
          <Faq />
          <CtaBand />
        </main>
        <LandingFooter />
        <MobileJoinBar watchId="hero" />
      </div>
    </>
  )
}

function Hero() {
  // The code card is always visible, so a player holding a code can type it
  // straight away. "Join a game" and the header / mobile-bar shortcuts
  // (OPEN_HERO_JOIN_EVENT) bring it into view and focus it.
  useEffect(() => {
    const focusJoin = () => {
      const input = document.getElementById(HERO_JOIN_INPUT_ID)
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      input?.focus({ preventScroll: true })
    }
    window.addEventListener(OPEN_HERO_JOIN_EVENT, focusJoin)
    return () => window.removeEventListener(OPEN_HERO_JOIN_EVENT, focusJoin)
  }, [])

  return (
    <section id="hero" aria-labelledby="hero-title" className="relative isolate overflow-x-clip">
      {/* Backdrop: a dot grid that fades out toward the edges, and soft
          glows (pink behind the quiz preview, amber on the left). Gives the top of the page its
          own atmosphere so it doesn't run into the sections below. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="hero-dots absolute inset-0" />
        <div className="absolute right-[6%] top-[22%] size-[420px] rounded-full bg-answer-b/12 blur-3xl dark:bg-answer-b/10" />
        <div className="absolute left-[-10%] top-[30%] size-[320px] rounded-full bg-answer-c/10 blur-3xl dark:bg-answer-c/5" />
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:pb-24 md:pt-20">
        <div className="flex flex-col items-start">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-bold shadow-[0_1px_2px_rgba(20,20,43,0.04)]">
            <span aria-hidden="true" className="live-dot relative size-2.5 rounded-full bg-correct" />
            Good energy. Great questions.
          </p>

          <h1
            id="hero-title"
            className="mt-6 font-display text-[40px] font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-[60px] lg:leading-[1.04]"
          >
            Make learning a game everyone wants to{' '}
            <span className="relative inline-block whitespace-nowrap">
              play
              <svg
                aria-hidden="true"
                viewBox="0 0 120 14"
                preserveAspectRatio="none"
                className="absolute -bottom-[0.16em] left-[-0.04em] h-[0.24em] w-[calc(100%+0.08em)] overflow-visible"
              >
                <path
                  d="M3 9.5C28 4.5 62 3.5 117 6.5"
                  pathLength={1}
                  className="underline-draw fill-none stroke-highlight"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>

          <p className="mt-6 max-w-xl text-muted-foreground md:text-lg">
            Create a quiz, bring your people together, and turn that “one more round” feeling into learning that sticks.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              to={CREATE_QUIZ_PATH}
              className={cn(pillLink, 'h-[52px] whitespace-nowrap bg-primary px-6 text-base text-primary-foreground hover:bg-primary/90')}
            >
              Create a quiz <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => focusHeroJoin()}
              className={cn(
                pillLink,
                'h-[52px] cursor-pointer whitespace-nowrap border border-input bg-card px-6 text-base text-foreground shadow-[0_1px_2px_rgba(20,20,43,0.05)] hover:border-foreground/30',
              )}
            >
              <Gamepad2 aria-hidden="true" className="size-5" />
              Join a game
            </button>
          </div>

          <div id="join" className="mt-4 w-full scroll-mt-24 rounded-2xl border border-border bg-card p-4 md:max-w-md">
            <JoinCodeForm variant="hero" inputId={HERO_JOIN_INPUT_ID} prefillFromQuery />
          </div>

          <p className="mt-6 inline-flex items-center gap-2.5 text-sm text-muted-foreground">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-correct/20 text-correct-text">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            Made for classrooms, study groups, and curious teams.
          </p>
        </div>

        <QuizPreview />
      </div>
    </section>
  )
}
