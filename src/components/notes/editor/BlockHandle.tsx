/**
 * The handle beside the hovered block (Notion-style): "+" adds a block
 * below and opens the "/" menu in it; the grip drags the block to a new
 * place. Built on Tiptap's DragHandle, which works with the collaborative
 * (Yjs) document, so a move shows up for everyone.
 */

import { useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import DragHandle from '@tiptap/extension-drag-handle-react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { GripVertical, Plus } from 'lucide-react'

export function BlockHandle({ editor }: { editor: Editor }) {
  // The block under the handle, kept in a ref: it changes on every hover.
  const current = useRef<{ node: PMNode | null; pos: number }>({ node: null, pos: -1 })
  const onNodeChange = useCallback(({ node, pos }: { node: PMNode | null; pos: number }) => {
    current.current = { node, pos }
  }, [])

  function addBelow() {
    const { node, pos } = current.current
    if (!node || pos < 0) return
    const at = pos + node.nodeSize
    // A new paragraph holding "/" opens the slash menu right there.
    editor
      .chain()
      .focus()
      .insertContentAt(at, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
      .setTextSelection(at + 2)
      .run()
  }

  return (
    <DragHandle editor={editor} onNodeChange={onNodeChange}>
      {/* Phones get the "/" menu instead: dragging blocks by touch isn't reliable. */}
      <div data-testid="block-handle" className="flex items-center gap-0.5 pr-1.5 text-slate-400 max-sm:hidden">
        <button
          type="button"
          aria-label="Add a block below"
          title="Add a block below"
          // Keep keyboard focus in the editor: a focused button would take the
          // next keys (Enter would "click" it again) instead of the new line.
          onMouseDown={(e) => e.preventDefault()}
          onClick={addBelow}
          className="flex size-6 items-center justify-center rounded hover:bg-slate-100 hover:text-slate-700"
        >
          <Plus className="size-4" />
        </button>
        <span
          aria-label="Drag to move this block"
          title="Drag to move"
          className="flex size-6 cursor-grab items-center justify-center rounded hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </span>
      </div>
    </DragHandle>
  )
}
