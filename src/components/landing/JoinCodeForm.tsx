/**
 * "Have a game code?" — an input, not a button, because a visitor holding a
 * code wants to type it here rather than click through to another page.
 *
 * Works before hydration too: without JS the form GETs `/?code=…`, and once
 * the page hydrates the hero form picks that value back up (`prefillFromQuery`).
 * With JS, a valid code goes straight to `/join/:code`, which signs the player
 * in if needed and drops them in the lobby.
 */

import { useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { joinPath, parseJoinCode } from '@/lib/join-code'

/** id of the hero's code input, the target of every "Join game" shortcut. */
export const HERO_JOIN_INPUT_ID = 'join-code'

/** The hero listens for this, scrolls to its code field and focuses it. */
export const OPEN_HERO_JOIN_EVENT = 'studyarena:open-join'

/** Bring the hero's code field into view and focus it. */
export function focusHeroJoin(event?: { preventDefault(): void }) {
  event?.preventDefault()
  window.dispatchEvent(new Event(OPEN_HERO_JOIN_EVENT))
}

type Variant = 'hero' | 'band'

interface JoinCodeFormProps {
  variant: Variant
  inputId?: string
  prefillFromQuery?: boolean
  /** The "you'll sign in first" line under the hero form; off where you already are. */
  signInHint?: boolean
  className?: string
}

export function JoinCodeForm({
  variant,
  inputId,
  prefillFromQuery,
  signInHint = true,
  className,
}: JoinCodeFormProps) {
  const navigate = useNavigate()
  const fallbackId = useId()
  const id = inputId ?? fallbackId
  const errorId = `${id}-error`
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!prefillFromQuery) return
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) setValue(code.toUpperCase())
  }, [prefillFromQuery])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = parseJoinCode(value)
    if (!code) {
      setError(true)
      return
    }
    navigate(joinPath(code))
  }

  const input = (
    <input
      id={id}
      name="code"
      value={value}
      onChange={(e) => {
        setValue(e.target.value.toUpperCase())
        setError(false)
      }}
      placeholder="ENTER CODE"
      autoComplete="off"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      enterKeyHint="go"
      aria-invalid={error || undefined}
      aria-describedby={error ? errorId : undefined}
      className={cn(
        'w-full min-w-0 flex-1 rounded-lg border bg-card font-mono font-bold uppercase tracking-[0.18em] text-card-foreground outline-none transition-colors placeholder:font-medium placeholder:tracking-[0.12em] placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25',
        error ? 'border-destructive' : 'border-input',
        'h-12 px-4 text-xl',
        variant === 'band' && 'border-transparent',
      )}
    />
  )

  const submit = (
    <button
      type="submit"
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg font-bold transition-[transform,background-color] outline-none hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-primary/40',
        'h-12 px-5 text-base',
        variant === 'band'
          ? 'bg-ink text-white hover:bg-ink/90 focus-visible:ring-white/60'
          : 'bg-foreground text-background hover:bg-foreground/90',
      )}
    >
      Join
      <ArrowRight aria-hidden="true" className="size-4" />
    </button>
  )

  const errorText = error && (
    <p id={errorId} role="alert" className={cn('mt-2 text-sm font-bold', variant === 'band' ? 'text-white' : 'text-destructive')}>
      Codes are 6 letters or numbers, like K7QX9P.
    </p>
  )

  return (
    <form method="get" action="/" onSubmit={onSubmit} noValidate className={className}>
      <label
        htmlFor={id}
        className={cn('mb-2 block font-bold', variant === 'band' ? 'text-white' : 'text-foreground')}
      >
        Have a game code?
      </label>
      <div className="flex gap-2">
        {input}
        {submit}
      </div>
      {errorText}
      {variant === 'hero' && signInHint && !error && (
        <p className="mt-2 text-sm text-muted-foreground">You&apos;ll sign in, then go straight to the lobby.</p>
      )}
    </form>
  )
}
