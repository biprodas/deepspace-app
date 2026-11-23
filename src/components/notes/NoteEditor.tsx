/**
 * A live, shared note: Tiptap bound to the note's Yjs room (one per note
 * id, over the app's Yjs route, which admits the space's members) with the
 * other editors' cursors. The editor, toolbar and styles come from the
 * DeepSpace `documents` feature (./editor, ./notes-ui.css).
 *
 * Notion-style editing: "/" opens a block menu (./editor/SlashCommand), a
 * handle beside each block adds a block or drags it (./editor/BlockHandle),
 * and selecting text shows a formatting bar (./editor/NoteBubbleMenu). The
 * page is a bordered white sheet on a desk, with a slim bar on top: undo,
 * redo, a hint, who else is editing and whether changes are saved. The page stays white in
 * dark mode, as the stylesheet's text colours assume.
 */

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { getUserColor, useUser, useYjsRoom, type Awareness } from 'deepspace'
import { cn } from '@/components/ui'
import { GripVertical, Redo2, Undo2 } from 'lucide-react'
import { BlockHandle } from './editor/BlockHandle'
import { NoteBubbleMenu } from './editor/NoteBubbleMenu'
import { useDocEditor } from './editor/useDocEditor'
import './notes-ui.css'

interface NoteEditorProps {
  noteId: string
  /** Receives the editor once it exists, e.g. for "Make a quiz" to read its text. */
  onEditor?: (editor: Editor | null) => void
}

export function NoteEditor({ noteId, onEditor }: NoteEditorProps) {
  const { user } = useUser()
  const { doc, synced, connected, canWrite, awareness } = useYjsRoom(noteId, 'content')
  const editor = useDocEditor({
    doc,
    awareness,
    userName: user?.name?.trim() || user?.email?.trim() || 'Member',
    userColor: getUserColor(user?.id ?? 'anon'),
    synced,
    canWrite,
    placeholder: canWrite ? "Type '/' for commands" : 'View only',
  })
  useEffect(() => onEditor?.(editor), [editor, onEditor])

  return (
    <div className="documents-feature-scope documents-paged-editor flex min-h-0 flex-1 flex-col">
      <div
        data-testid="note-page"
        className="documents-editor-paper note-paper mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-clip rounded-xl"
      >
        <div
          className="sticky top-0 z-10 flex items-center gap-2 border-b pr-3"
          style={{
            borderColor: 'var(--documents-el-line)',
            backgroundColor: 'color-mix(in srgb, var(--documents-el-surface) 96%, transparent)',
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-0.5 py-1.5 pl-2">
            <BarButton label="Undo" disabled={!editor || !canWrite} onClick={() => editor?.chain().focus().undo().run()}>
              <Undo2 className="size-4" />
            </BarButton>
            <BarButton label="Redo" disabled={!editor || !canWrite} onClick={() => editor?.chain().focus().redo().run()}>
              <Redo2 className="size-4" />
            </BarButton>
            {canWrite && (
              <p className="ml-2 hidden truncate text-xs sm:block" style={{ color: 'var(--documents-el-muted)' }}>
                Type <kbd className="rounded border px-1 font-mono" style={{ borderColor: 'var(--documents-el-line)' }}>/</kbd> for
                blocks, select text to format, drag <GripVertical className="inline size-3" aria-hidden="true" /> to move
              </p>
            )}
          </div>
          <Collaborators awareness={awareness} />
          <SyncStatus connected={connected} synced={synced} canWrite={canWrite} />
        </div>

        <div
          data-testid="note-editor"
          data-synced={synced}
          className="documents-paged-editor-font min-h-[60vh] flex-1 px-5 py-8 sm:py-10 sm:pl-20 sm:pr-14"
          // Clicking the empty part of the page puts the cursor at the end, like a word processor.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && editor && canWrite) {
              e.preventDefault()
              editor.chain().focus('end').run()
            }
          }}
        >
          {editor && canWrite && <BlockHandle editor={editor} />}
          {editor && canWrite && <NoteBubbleMenu editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

function BarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function SyncStatus({ connected, synced, canWrite }: { connected: boolean; synced: boolean; canWrite: boolean }) {
  const state = !connected || !synced ? 'connecting' : canWrite ? 'saved' : 'readonly'
  const label = { connecting: 'Connecting…', saved: 'Saved', readonly: 'View only' }[state]
  return (
    <span
      role="status"
      data-testid="note-status"
      data-state={state}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs"
      style={{ color: 'var(--documents-el-muted)' }}
      title={state === 'saved' ? 'Every change is saved and shared as you type' : undefined}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          state === 'saved' && 'bg-correct',
          state === 'connecting' && 'animate-pulse bg-warning',
          state === 'readonly' && 'bg-muted-foreground',
        )}
      />
      {label}
    </span>
  )
}

interface Peer {
  key: number
  name: string
  color: string
}

/** Everyone else with this note open, from the editor's awareness (the same data that draws their cursors). */
function usePeers(awareness: Awareness | null): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([])
  useEffect(() => {
    if (!awareness) return
    const read = () => {
      const list: Peer[] = []
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return
        const u = (state as { user?: { name?: string; color?: string } }).user
        if (u?.name) list.push({ key: clientId, name: u.name, color: u.color ?? '#2563eb' })
      })
      setPeers(list)
    }
    read()
    awareness.on('change', read)
    return () => awareness.off('change', read)
  }, [awareness])
  return peers
}

function Collaborators({ awareness }: { awareness: Awareness | null }) {
  const peers = usePeers(awareness)
  if (peers.length === 0) return null
  const shown = peers.slice(0, 4)
  return (
    <span
      data-testid="note-collaborators"
      className="flex shrink-0 -space-x-1.5"
      aria-label={`Also editing: ${peers.map((p) => p.name).join(', ')}`}
    >
      {shown.map((p) => (
        <span
          key={p.key}
          title={p.name}
          className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
          style={{ backgroundColor: p.color }}
        >
          {p.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {peers.length > shown.length && (
        <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold ring-2 ring-white">
          +{peers.length - shown.length}
        </span>
      )}
    </span>
  )
}
