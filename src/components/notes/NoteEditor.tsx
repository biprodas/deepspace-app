/**
 * A live, shared note: Tiptap bound to the note's Yjs room (one per note
 * id, over the app's Yjs route, which admits the space's members) with the
 * other editors' cursors. The editor, toolbar and styles come from the
 * DeepSpace `documents` feature (./editor, ./notes-ui.css).
 */

import { useEffect, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { getUserColor, useUser, useYjsRoom } from 'deepspace'
import { DocumentsTiptapToolbar } from './editor/DocumentsTiptapToolbar'
import { useDocEditor } from './editor/useDocEditor'
import './notes-ui.css'

interface NoteEditorProps {
  noteId: string
  /** Receives the editor once it exists, e.g. for "Make a quiz" to read its text. */
  onEditor?: (editor: Editor | null) => void
  /** Extra controls at the end of the toolbar row. */
  children?: ReactNode
}

export function NoteEditor({ noteId, onEditor, children }: NoteEditorProps) {
  const { user } = useUser()
  const { doc, synced, connected, canWrite, awareness } = useYjsRoom(noteId, 'content')
  const [zoom, setZoom] = useState(1)
  const editor = useDocEditor({
    doc,
    awareness,
    userName: user?.name?.trim() || user?.email?.trim() || 'Member',
    userColor: getUserColor(user?.id ?? 'anon'),
    synced,
    canWrite,
    placeholder: canWrite ? 'Write together: headings, lists, checklists…' : 'View only',
  })
  useEffect(() => onEditor?.(editor), [editor, onEditor])

  return (
    <div className="documents-feature-scope documents-paged-editor flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 py-2 backdrop-blur">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <DocumentsTiptapToolbar editor={editor} disabled={!canWrite} canvasZoom={zoom} onCanvasZoomChange={setZoom} />
        </div>
        {children}
      </div>
      {!connected && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Connecting…
        </p>
      )}
      <div
        data-testid="note-editor"
        data-synced={synced}
        className="documents-paged-editor-font mx-auto w-full max-w-3xl flex-1 px-1 py-6 sm:px-4"
        style={{ zoom }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
