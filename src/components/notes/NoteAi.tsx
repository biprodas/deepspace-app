/**
 * AI help in a note (docs/features.md F14): an "AI" menu in the note's
 * header with
 * - "Draft notes from a topic": Claude writes study notes from a Wikipedia
 *   article, added to the note (everyone sees them live; undo works), with a
 *   link to the source at the end;
 * - "Review this note": a side panel of suggestions (possible mistakes,
 *   missing points, unclear passages, structure). It never changes the note:
 *   a suggestion can show its passage, add its missing text, or be dismissed.
 * Both run on the server (src/actions/note-ai.ts) and share a daily limit.
 */

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  ChevronDown,
  CircleHelp,
  CirclePlus,
  ListTree,
  Plus,
  RotateCcw,
  ScanSearch,
  TriangleAlert,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Modal,
  cn,
  useToast,
} from '@/components/ui'
import { DAILY_NOTE_AI_LIMIT, MAX_NOTES_CHARS } from '@/lib/game-rules'
import type { NoteDraft, NoteReview, Suggestion, SuggestionKind } from '@/lib/note-ai'
import { draftToContent, findQuote, insertToContent, wikipediaUrl, type TextBlock } from '@/lib/note-content'
import { useAction } from '@/lib/use-action'

const KINDS: Record<SuggestionKind, { label: string; icon: LucideIcon; tone: string }> = {
  mistake: { label: 'Possible mistake', icon: TriangleAlert, tone: 'bg-destructive/10 text-destructive' },
  missing: { label: 'Missing', icon: CirclePlus, tone: 'bg-primary/10 text-primary-text' },
  unclear: { label: 'Unclear', icon: CircleHelp, tone: 'bg-warning/15 text-[#92400e] dark:text-[#fcd34d]' },
  structure: { label: 'Structure', icon: ListTree, tone: 'bg-muted text-muted-foreground' },
}

/** The note's text blocks with their document positions, for finding quoted passages. */
function textBlocks(editor: Editor): TextBlock[] {
  const blocks: TextBlock[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    blocks.push({ pos, size: node.nodeSize, text: node.textContent })
    return false
  })
  return blocks
}

/** Adds content at the end of the note (or fills it, when it's empty) and shows it. */
function appendToNote(editor: Editor, content: ReturnType<typeof insertToContent>) {
  if (editor.isEmpty) {
    editor.chain().focus().insertContentAt({ from: 0, to: editor.state.doc.content.size }, content).scrollIntoView().run()
  } else {
    editor.chain().focus('end').insertContentAt(editor.state.doc.content.size, content).scrollIntoView().run()
  }
}

export function NoteAiMenu({ editor, noteId, noteTitle }: { editor: Editor | null; noteId: string; noteTitle: string }) {
  const [drafting, setDrafting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const canEdit = !!editor?.isEditable

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" disabled={!editor} data-testid="note-ai-menu" aria-label="AI help" />}
        >
          <WandSparkles />
          <span className="hidden sm:inline">AI</span>
          <ChevronDown className="hidden sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => setDrafting(true)} disabled={!canEdit} data-testid="note-ai-draft">
            <WandSparkles aria-hidden />
            <span>
              Draft notes from a topic
              <span className="block text-xs text-muted-foreground">Written from a Wikipedia article</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setReviewing(true)} data-testid="note-ai-review">
            <ScanSearch aria-hidden />
            <span>
              Review this note
              <span className="block text-xs text-muted-foreground">Suggestions only; nothing changes</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {drafting && editor && (
        <DraftModal editor={editor} noteId={noteId} noteTitle={noteTitle} onClose={() => setDrafting(false)} />
      )}
      {reviewing && editor && (
        <ReviewPanel editor={editor} noteId={noteId} noteTitle={noteTitle} onClose={() => setReviewing(false)} />
      )}
    </>
  )
}

function DraftModal({
  editor,
  noteId,
  noteTitle,
  onClose,
}: {
  editor: Editor
  noteId: string
  noteTitle: string
  onClose: () => void
}) {
  const { run, pending } = useAction()
  const { success } = useToast()
  const [topic, setTopic] = useState(noteTitle)

  async function draft() {
    const res = await run<{ draft: NoteDraft; sourceTitle: string }>('draftNote', { noteId, topic: topic.trim() })
    if (!res.success) return
    appendToNote(editor, draftToContent(res.data.draft, res.data.sourceTitle))
    success('Notes added', `Written from Wikipedia · ${res.data.sourceTitle}. Ctrl+Z undoes it.`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="md" data-testid="note-draft">
      <Modal.Header>
        <Modal.Title>Draft notes from a topic</Modal.Title>
        <Modal.Description>
          Claude reads the Wikipedia article and writes study notes into this note: headings, short points and key
          terms, with the source linked at the end. Everyone in the note sees them, and you can edit or undo them.
        </Modal.Description>
      </Modal.Header>
      <Modal.Body className="space-y-1.5">
        <Label htmlFor="note-draft-topic">Topic</Label>
        <Input
          id="note-draft-topic"
          value={topic}
          maxLength={120}
          autoFocus
          placeholder="e.g. Krebs cycle"
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && topic.trim() && pending !== 'draftNote' && void draft()}
        />
        {pending === 'draftNote' ? (
          <p role="status" className="pt-1 text-xs text-muted-foreground">
            Reading the article and writing notes, about 20 seconds…
          </p>
        ) : (
          <p className="pt-1 text-xs text-muted-foreground">
            Up to {DAILY_NOTE_AI_LIMIT} AI drafts and reviews a day.
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => void draft()}
          disabled={!topic.trim()}
          loading={pending === 'draftNote'}
          data-testid="note-draft-submit"
        >
          <WandSparkles /> Write notes
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function ReviewPanel({
  editor,
  noteId,
  noteTitle,
  onClose,
}: {
  editor: Editor
  noteId: string
  noteTitle: string
  onClose: () => void
}) {
  const { run, pending } = useAction()
  const { error } = useToast()
  const [checkFacts, setCheckFacts] = useState(false)
  const [topic, setTopic] = useState(noteTitle)
  const [result, setResult] = useState<(NoteReview & { sourceTitle?: string }) | null>(null)
  /** Per suggestion (by index): dismissed, or its text added to the note. */
  const [done, setDone] = useState<Record<number, 'dismissed' | 'added'>>({})

  // Tells the note page to make room for the panel beside the note (wide screens).
  useEffect(() => {
    document.body.classList.add('note-review-open')
    return () => document.body.classList.remove('note-review-open')
  }, [])

  async function review() {
    const text = editor.getText({ blockSeparator: '\n' })
    if (text.length > MAX_NOTES_CHARS) {
      error(`This note is over ${MAX_NOTES_CHARS.toLocaleString()} characters, too long to review`)
      return
    }
    const res = await run<{ review: NoteReview; sourceTitle?: string }>('reviewNote', {
      noteId,
      text,
      ...(checkFacts && topic.trim() ? { topic: topic.trim() } : {}),
    })
    if (!res.success) return
    setResult({ ...res.data.review, sourceTitle: res.data.sourceTitle })
    setDone({})
  }

  function showPassage(s: Suggestion) {
    const hit = s.quote ? findQuote(textBlocks(editor), s.quote) : null
    if (!hit) return error('That passage has changed since the review')
    editor.chain().focus().setTextSelection({ from: hit.from, to: hit.to }).scrollIntoView().run()
  }

  function addToNote(i: number, s: Suggestion) {
    if (!s.insert || !editor.isEditable) return
    appendToNote(editor, insertToContent(s.insert))
    setDone((d) => ({ ...d, [i]: 'added' }))
  }

  const open = result?.suggestions.filter((_, i) => done[i] !== 'dismissed') ?? []

  return (
    <aside
      data-testid="note-review"
      aria-label="Review this note"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col rounded-t-2xl border border-border bg-card shadow-2xl md:inset-x-auto md:bottom-0 md:right-0 md:top-12 md:max-h-none md:w-[400px] md:rounded-none md:border-y-0 md:border-r-0"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ScanSearch className="size-4 text-primary-text" aria-hidden="true" />
        <h2 className="flex-1 font-display text-base font-bold">Review this note</h2>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close review">
          <X />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!result ? (
          <>
            <p className="text-sm text-muted-foreground">
              Claude reads this note and suggests improvements: possible mistakes, missing points, unclear parts and
              structure. It won’t change the note; you choose what to use.
            </p>
            <div className="space-y-2 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={checkFacts} onCheckedChange={setCheckFacts} data-testid="note-review-check-facts" />
                Check facts against Wikipedia
              </label>
              {checkFacts && (
                <Input
                  value={topic}
                  maxLength={120}
                  aria-label="Wikipedia topic to check against"
                  placeholder="e.g. Photosynthesis"
                  onChange={(e) => setTopic(e.target.value)}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {checkFacts
                  ? 'Only statements the article contradicts are flagged as mistakes.'
                  : 'Without a source, Claude flags what looks doubtful and says how sure it is.'}
              </p>
            </div>
          </>
        ) : (
          <>
            {result.summary && <p className="text-sm">{result.summary}</p>}
            {result.sourceTitle && (
              <p className="text-xs text-muted-foreground">
                Facts checked against{' '}
                <a
                  href={wikipediaUrl(result.sourceTitle)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary-text hover:underline"
                >
                  Wikipedia · {result.sourceTitle}
                </a>
              </p>
            )}
            {open.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {result.suggestions.length === 0 ? 'No suggestions: this note looks good.' : 'All suggestions dismissed.'}
              </p>
            ) : (
              <ul className="space-y-3" data-testid="note-review-suggestions">
                {result.suggestions.map((s, i) => {
                  if (done[i] === 'dismissed') return null
                  const kind = KINDS[s.kind]
                  return (
                    <li key={i} className="rounded-xl border border-border bg-background p-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                          kind.tone,
                        )}
                      >
                        <kind.icon className="size-3.5" aria-hidden="true" /> {kind.label}
                      </span>
                      <p className="mt-2 text-sm font-semibold">{s.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                      {s.quote && (
                        <blockquote className="mt-2 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                          “{s.quote}”
                        </blockquote>
                      )}
                      {s.insert && (
                        <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/60 px-2.5 py-2 text-xs">{s.insert}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {s.quote && (
                          <Button size="sm" variant="outline" onClick={() => showPassage(s)}>
                            Show in note
                          </Button>
                        )}
                        {s.insert &&
                          (done[i] === 'added' ? (
                            <span className="inline-flex items-center px-2 text-xs font-semibold text-correct-text">
                              Added to the note
                            </span>
                          ) : (
                            <Button size="sm" onClick={() => addToNote(i, s)} disabled={!editor.isEditable}>
                              <Plus /> Add to note
                            </Button>
                          ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => setDone((d) => ({ ...d, [i]: 'dismissed' }))}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
        {pending === 'reviewNote' ? (
          <p role="status" className="flex-1 text-xs text-muted-foreground">
            Reading the note{checkFacts ? ' and the article' : ''}, about 20 seconds…
          </p>
        ) : (
          <p className="flex-1 text-xs text-muted-foreground">Up to {DAILY_NOTE_AI_LIMIT} AI uses a day.</p>
        )}
        <Button
          onClick={() => void review()}
          loading={pending === 'reviewNote'}
          disabled={checkFacts && !topic.trim()}
          data-testid="note-review-run"
        >
          {result ? (
            <>
              <RotateCcw /> Review again
            </>
          ) : (
            <>
              <ScanSearch /> Review
            </>
          )}
        </Button>
      </footer>
    </aside>
  )
}
