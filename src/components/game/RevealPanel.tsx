/**
 * A revealed question: the correct option, how many picked each, the
 * explanation and the source sentence. Everything here comes from the
 * round's reveal fields, which the server fills only after the deadline.
 */

import { ExternalLink, HelpCircle, Quote } from 'lucide-react'
import { Button } from '@/components/ui'
import type { Question, Round } from '@/schemas/game-types'
import { AnswerTiles } from './AnswerTiles'

interface RevealPanelProps {
  question: Question
  round: Round
  picked?: number
  size?: 'md' | 'lg'
  /**
   * "Still confused" (docs/features.md F12). Players pass `onFlag` to get the
   * button; the host omits it and sees the count instead.
   */
  confused?: { flagged?: boolean; onFlag?: () => void; pending?: boolean }
}

export function RevealPanel({ question, round, picked, size, confused }: RevealPanelProps) {
  const count = round.confusedCount ?? 0
  return (
    <div className="space-y-4" data-testid="reveal">
      <AnswerTiles
        options={question.options}
        mode="reveal"
        correctIndex={round.correctIndex}
        distribution={round.distribution}
        picked={picked}
        size={size}
      />
      {(round.explanation || round.sourceQuote) && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
          {round.explanation && <p>{round.explanation}</p>}
          {round.sourceQuote && <SourceQuote quote={round.sourceQuote} url={round.sourceUrl} />}
        </div>
      )}
      {confused?.onFlag ? (
        <Button
          variant="outline"
          size="sm"
          data-testid="flag-confused"
          disabled={confused.flagged}
          loading={confused.pending}
          onClick={confused.onFlag}
        >
          <HelpCircle />
          {confused.flagged ? 'The host knows you’re confused' : 'Still confused?'}
        </Button>
      ) : (
        confused &&
        count > 0 && (
          <p
            role="status"
            data-testid="confused-count"
            className="inline-flex items-center gap-2 rounded-full border border-warning/50 bg-warning/10 px-3 py-1 text-sm font-medium"
          >
            <HelpCircle className="size-4" aria-hidden="true" />
            {count} {count === 1 ? 'player is' : 'players are'} still confused
          </p>
        )
      )}
    </div>
  )
}

export function SourceQuote({ quote, url }: { quote: string; url?: string }) {
  return (
    <figure className="flex gap-2 text-muted-foreground">
      <Quote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <blockquote className="italic">
          <mark className="bg-highlight/60 text-foreground">{quote}</mark>
        </blockquote>
        <figcaption className="mt-1 text-xs">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
              Source <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : (
            'From your notes'
          )}
        </figcaption>
      </div>
    </figure>
  )
}
