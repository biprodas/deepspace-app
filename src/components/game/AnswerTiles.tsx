/**
 * The four answer tiles, in the brand's answer colors with letter + shape
 * (never color alone). One component for every phase:
 *  - `choose`: a player taps one (big targets for phones);
 *  - `show`: the host's screen while the clock runs;
 *  - `reveal`: correct tile marked, others dimmed, with how many picked each.
 */

import { Check } from 'lucide-react'
import { cn } from '@/components/ui'
import { ANSWER_STYLES, AnswerShape } from '@/components/landing/bits'

interface AnswerTilesProps {
  options: string[]
  mode: 'choose' | 'show' | 'reveal'
  /** The viewer's pick, if any (outlined in every mode). */
  picked?: number
  correctIndex?: number
  distribution?: number[]
  disabled?: boolean
  onChoose?: (index: number) => void
  size?: 'md' | 'lg'
}

export function AnswerTiles({
  options,
  mode,
  picked,
  correctIndex,
  distribution,
  disabled,
  onChoose,
  size = 'md',
}: AnswerTilesProps) {
  const total = distribution?.reduce((a, b) => a + b, 0) ?? 0

  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-testid="answer-tiles">
      {options.map((option, i) => {
        const style = ANSWER_STYLES[i]
        const isCorrect = mode === 'reveal' && correctIndex === i
        const dimmed = mode === 'reveal' && correctIndex !== i
        const count = distribution?.[i] ?? 0
        const body = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/35 font-mono text-sm font-extrabold">
              <span className="sr-only">Option </span>
              {style.letter}
              <AnswerShape shape={style.shape} className="ml-0.5 size-2.5" />
            </span>
            <span className={cn('min-w-0 flex-1 break-words text-left font-bold', size === 'lg' ? 'text-xl' : 'text-base')}>
              {option}
            </span>
            {isCorrect && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-correct text-white">
                <Check className="size-5" strokeWidth={3} aria-label="Correct answer" />
              </span>
            )}
            {mode === 'reveal' && distribution && (
              <span className="shrink-0 font-mono text-sm font-bold" aria-label={`${count} picked this`}>
                {count}
              </span>
            )}
          </>
        )
        const tileClass = cn(
          'relative flex w-full items-center gap-3 overflow-hidden rounded-xl p-3 text-ink transition-all',
          size === 'lg' ? 'min-h-24' : 'min-h-16',
          style.bg,
          dimmed && 'opacity-35',
          picked === i && 'ring-4 ring-foreground ring-offset-2 ring-offset-background',
        )

        return (
          <li key={i} className="relative">
            {mode === 'choose' ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChoose?.(i)}
                className={cn(
                  tileClass,
                  'cursor-pointer active:scale-[0.98] disabled:cursor-default',
                  picked !== i && 'disabled:opacity-50',
                )}
              >
                {body}
              </button>
            ) : (
              <div className={tileClass} data-correct={isCorrect || undefined}>
                {mode === 'reveal' && total > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-white/25"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                )}
                <span className="relative flex w-full items-center gap-3">{body}</span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
