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
 * is the primary button; joining is an input, and on phones it comes first.
 */

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Seo } from '../components/Seo'
import { seo } from '../seo'
import { cn } from '@/lib/utils'
import { CREATE_QUIZ_PATH } from '../components/landing/bits'
import { HERO_JOIN_INPUT_ID, JoinCodeForm } from '../components/landing/JoinCodeForm'
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
  return (
    <section id="hero" aria-labelledby="hero-title" className="relative overflow-x-clip">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pb-16 pt-6 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:pb-24 md:pt-20">
        <div className="flex flex-col">
          {/* Joining comes first in the DOM, so on a phone (where most
              visitors are players with a code) it's the first thing they
              see and reach. From md up it moves below "Create a quiz". */}
          <div id="join" className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 md:order-5 md:mt-6 md:max-w-md">
            <JoinCodeForm variant="hero" inputId={HERO_JOIN_INPUT_ID} prefillFromQuery />
          </div>

          <p className="mt-10 font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary-text md:order-1 md:mt-0">
            Live quizzes · backed by sources
          </p>
          <h1
            id="hero-title"
            className="mt-4 font-display text-[36px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:order-2 lg:text-[56px] lg:leading-[1.05]"
          >
            Turn any topic into a live quiz, with the <mark className="hl hl-load">receipts</mark>.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground md:order-3 md:text-lg">
            Pick a Wikipedia topic or paste your notes. StudyArena drafts the questions, you approve them, and your group
            competes live, then sees why each answer is right and where it came from.
          </p>
          <div className="mt-7 md:order-4">
            <Link
              to={CREATE_QUIZ_PATH}
              className={cn(pillLink, 'h-[52px] w-full bg-primary px-7 text-base text-primary-foreground hover:bg-primary/90 sm:w-auto')}
            >
              Create a quiz <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground md:order-6">
            Free to try · Up to 50 players · Works on any phone
          </p>
        </div>

        <QuizPreview />
      </div>
    </section>
  )
}
