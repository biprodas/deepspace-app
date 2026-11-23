/**
 * "Join with a code" from anywhere: a Join button in the header (a small
 * popover on desktop) and a code field at the top of the phone menu. A
 * valid code goes to /join/:code, which joins the game, or the study space
 * when no game has that code. Pasting a whole invite link works too.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'
import { joinPath, parseJoinCode } from '@/lib/join-code'

/** The code field and its Join button; `onJoined` closes whatever holds it. */
export function QuickJoinForm({ onJoined, autoFocus }: { onJoined?: () => void; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const code = parseJoinCode(value)
    if (!code) return setError(true)
    setValue('')
    onJoined?.()
    navigate(joinPath(code))
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Join with a code" data-testid="quick-join">
      <div className="flex gap-2">
        <input
          name="code"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase())
            setError(false)
          }}
          placeholder="ENTER CODE"
          aria-label="Game or space code"
          aria-invalid={error || undefined}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className={cn(
            'h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-base font-bold uppercase tracking-[0.15em] outline-none placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
            error ? 'border-destructive' : 'border-input',
          )}
        />
        <Button type="submit" className="h-10">
          Join <ArrowRight />
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          Codes are 6 letters or numbers, like K7QX9P.
        </p>
      )}
    </form>
  )
}

/** Desktop header button: opens the code field in a popover. */
export function QuickJoinButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-testid="header-join"
        render={<Button variant="outline" size="sm" className={cn('rounded-full', className)} />}
      >
        <LogIn aria-hidden="true" /> Join
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="text-sm font-semibold">Join with a code</p>
        <p className="mb-3 text-xs text-muted-foreground">A game or a study space code, or paste an invite link.</p>
        <QuickJoinForm autoFocus onJoined={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
