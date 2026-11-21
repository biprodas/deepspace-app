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

/** Scroll the hero join field into view and focus it. */
export function focusHeroJoin(event?: { preventDefault(): void }) {
  const input = document.getElementById(HERO_JOIN_INPUT_ID)
  if (!input) return
  event?.preventDefault()
  input.scrollIntoView({ behavior: 'smooth', block: 'center' })
  input.focus({ preventScroll: true })
}

type Variant = 'hero' | 'header' | 'band'

interface JoinCodeFormProps {
  variant: Variant
  inputId?: string
  prefillFromQuery?: boolean
  className?: string
}

export function JoinCodeForm({ variant, inputId, prefillFromQuery, className }: JoinCodeFormProps) {
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
      placeholder={variant === 'header' ? 'Game code' : 'ENTER CODE'}
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
        variant === 'header' ? 'h-10 px-3 text-sm' : 'h-12 px-4 text-xl',
        variant === 'hero' && 'join-pulse',
        variant === 'band' && 'border-transparent',
      )}
    />
  )

  const submit = (
    <button
      type="submit"
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg font-bold transition-[transform,background-color] outline-none hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-primary/40',
        variant === 'header' ? 'h-10 px-3 text-sm' : 'h-12 px-5 text-base',
        variant === 'band'
          ? 'bg-ink text-white hover:bg-ink/90 focus-visible:ring-white/60'
          : 'bg-foreground text-background hover:bg-foreground/90',
      )}
    >
      Join
      {variant !== 'header' && <ArrowRight aria-hidden="true" className="size-4" />}
    </button>
  )

  const errorText = error && (
    <p id={errorId} role="alert" className={cn('mt-2 text-sm font-bold', variant === 'band' ? 'text-white' : 'text-destructive')}>
      Codes are 6 letters or numbers, like K7QX9P.
    </p>
  )

  if (variant === 'header') {
    return (
      <form method="get" action="/" onSubmit={onSubmit} noValidate className={cn('relative', className)}>
        <label htmlFor={id} className="sr-only">
          Game code
        </label>
        <div className="flex items-center gap-1.5">
          {input}
          {submit}
        </div>
        {error && (
          <p id={errorId} role="alert" className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-md bg-card px-2 py-1 text-xs font-bold text-destructive shadow-sm">
            Use a 6-character code, like K7QX9P.
          </p>
        )}
      </form>
    )
  }

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
      {variant === 'hero' && !error && (
        <p className="mt-2 text-sm text-muted-foreground">You&apos;ll sign in, then go straight to the lobby.</p>
      )}
    </form>
  )
}
