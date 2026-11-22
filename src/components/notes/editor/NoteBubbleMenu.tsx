/**
 * The formatting bar that floats over selected text (Notion-style): turn
 * the block into text/heading/list, bold, italic, underline, strike, code,
 * highlight and link. Hidden for empty selections and inside code blocks.
 */

import { useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Code, Highlighter, Italic, Link2, Strikethrough, Underline } from 'lucide-react'
import { cn } from '@/components/ui'

const BLOCK_TYPES = [
  { id: 'p', label: 'Text' },
  { id: 'h1', label: 'Heading 1' },
  { id: 'h2', label: 'Heading 2' },
  { id: 'h3', label: 'Heading 3' },
  { id: 'ul', label: 'Bulleted list' },
  { id: 'ol', label: 'Numbered list' },
  { id: 'todo', label: 'To-do list' },
] as const

type BlockType = (typeof BLOCK_TYPES)[number]['id']

function currentBlock(editor: Editor): BlockType {
  if (editor.isActive('taskList')) return 'todo'
  if (editor.isActive('bulletList')) return 'ul'
  if (editor.isActive('orderedList')) return 'ol'
  for (const level of [1, 2, 3] as const) if (editor.isActive('heading', { level })) return `h${level}`
  return 'p'
}

function turnInto(editor: Editor, type: BlockType) {
  const c = editor.chain().focus()
  // Lists toggle off by turning into the same list again; clear any list first.
  const plain = editor.isActive('taskList')
    ? c.toggleTaskList()
    : editor.isActive('bulletList')
      ? c.toggleBulletList()
      : editor.isActive('orderedList')
        ? c.toggleOrderedList()
        : c
  if (type === 'p') return plain.setParagraph().run()
  if (type === 'ul') return plain.setParagraph().toggleBulletList().run()
  if (type === 'ol') return plain.setParagraph().toggleOrderedList().run()
  if (type === 'todo') return plain.setParagraph().toggleTaskList().run()
  return plain.setHeading({ level: Number(type.slice(1)) as 1 | 2 | 3 }).run()
}

export function NoteBubbleMenu({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false)
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: currentBlock(e),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      href: (e.getAttributes('link').href as string | undefined) ?? '',
    }),
  })

  const mark = (active: boolean, label: string, icon: React.ReactNode, run: () => void) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={cn('flex size-8 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100', active && 'bg-slate-200 text-slate-900')}
    >
      {icon}
    </button>
  )

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top-start', offset: 8, flip: true, shift: { padding: 8 } }}
      shouldShow={({ editor: e, from, to }) => from !== to && e.isEditable && !e.isActive('codeBlock')}
    >
      <div
        data-testid="note-bubble-menu"
        className="note-paper flex items-center gap-0.5 rounded-lg border bg-white p-1 shadow-lg"
        style={{ borderColor: 'var(--documents-el-line)' }}
      >
        {linking ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              const href = String(new FormData(e.currentTarget).get('href') ?? '').trim()
              const chain = editor.chain().focus().extendMarkRange('link')
              if (href) chain.setLink({ href: /^[a-z]+:/i.test(href) ? href : `https://${href}` }).run()
              else chain.unsetLink().run()
              setLinking(false)
            }}
          >
            <input
              name="href"
              autoFocus
              defaultValue={state.href}
              placeholder="Paste a link"
              aria-label="Link address"
              onKeyDown={(e) => e.key === 'Escape' && setLinking(false)}
              className="w-56 rounded-md border px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: 'var(--documents-el-line)' }}
            />
            <button type="submit" className="rounded-md px-2 py-1 text-sm font-medium text-blue-700 hover:bg-slate-100">
              {state.href ? 'Update' : 'Add'}
            </button>
          </form>
        ) : (
          <>
            <select
              aria-label="Turn into"
              value={state.block}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => turnInto(editor, e.target.value as BlockType)}
              className="h-8 rounded-md bg-transparent px-1.5 text-sm text-slate-800 outline-none hover:bg-slate-100"
            >
              {BLOCK_TYPES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-200" />
            {mark(state.bold, 'Bold', <Bold className="size-4" />, () => editor.chain().focus().toggleBold().run())}
            {mark(state.italic, 'Italic', <Italic className="size-4" />, () => editor.chain().focus().toggleItalic().run())}
            {mark(state.underline, 'Underline', <Underline className="size-4" />, () => editor.chain().focus().toggleUnderline().run())}
            {mark(state.strike, 'Strikethrough', <Strikethrough className="size-4" />, () => editor.chain().focus().toggleStrike().run())}
            {mark(state.code, 'Inline code', <Code className="size-4" />, () => editor.chain().focus().toggleCode().run())}
            {mark(state.highlight, 'Highlight', <Highlighter className="size-4" />, () =>
              editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run(),
            )}
            {mark(state.link, state.link ? 'Edit link' : 'Add link', <Link2 className="size-4" />, () => setLinking(true))}
          </>
        )}
      </div>
    </BubbleMenu>
  )
}
