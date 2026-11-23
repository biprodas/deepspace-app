/**
 * The "/" menu (Notion-style): type "/" at the start of a line or after a
 * space, keep typing to filter, ↑/↓ and Enter to pick, Esc to close. Built
 * on Tiptap's Suggestion utility; the popup is a React list mounted and
 * positioned by the plugin (`props.mount`).
 */

import { forwardRef, useEffect, useImperativeHandle, useState, type ComponentType } from 'react'
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
  type LucideProps,
} from 'lucide-react'
import { filterSlashCommands, type SlashCommand } from './slash-commands'

const ICONS: Record<string, ComponentType<LucideProps>> = {
  text: Type,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  bullets: List,
  numbers: ListOrdered,
  todo: CheckSquare,
  quote: Quote,
  code: Code2,
  divider: Minus,
}

export const slashCommandKey = new PluginKey('slashCommand')

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand, SlashCommand>({
        editor: this.editor,
        pluginKey: slashCommandKey,
        char: '/',
        // Only at the start of a line or after a space, so "and/or" and URLs don't open it.
        allowedPrefixes: [' '],
        startOfLine: false,
        // Not inside code, where "/" is just a character.
        allow: ({ editor }) => !editor.isActive('codeBlock'),
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props }) => {
          props.run(editor.chain().focus().deleteRange(range)).run()
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle, SuggestionProps<SlashCommand, SlashCommand>> | null = null
          let unmount: (() => void) | null = null
          return {
            onStart(props) {
              component = new ReactRenderer(SlashMenu, { props, editor: props.editor })
              unmount = props.mount(component.element as HTMLElement)
            },
            onUpdate(props) {
              component?.updateProps(props)
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                unmount?.()
                unmount = null
                component?.destroy()
                component = null
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit() {
              unmount?.()
              component?.destroy()
              unmount = null
              component = null
            },
          }
        },
      }),
    ]
  },
})

interface SlashMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const SlashMenu = forwardRef<SlashMenuHandle, SuggestionProps<SlashCommand, SlashCommand>>(function SlashMenu(
  { items, command },
  ref,
) {
  const [active, setActive] = useState(0)
  // A new filter result starts at the top.
  const [prevItems, setPrevItems] = useState(items)
  if (prevItems !== items) {
    setPrevItems(items)
    setActive(0)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowDown') {
        setActive((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setActive((i) => (i - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        command(items[active])
        return true
      }
      return false
    },
  }))

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    document.querySelector(`[data-slash-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div
      data-testid="slash-menu"
      role="listbox"
      aria-label="Insert a block"
      className="note-paper z-50 max-h-80 w-72 overflow-y-auto rounded-xl border bg-white p-1 shadow-xl"
      style={{ borderColor: 'var(--documents-el-line)' }}
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm" style={{ color: 'var(--documents-el-muted)' }}>
          No matching blocks
        </p>
      ) : (
        <>
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--documents-el-muted)' }}>
            Blocks
          </p>
          {items.map((item, i) => {
            const Icon = ICONS[item.id] ?? Type
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={i === active}
                data-slash-index={i}
                // Keep focus in the editor; a click would otherwise blur it first.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => command(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left ${i === active ? 'bg-slate-100' : ''}`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-white" style={{ borderColor: 'var(--documents-el-line)' }}>
                  <Icon className="size-4 text-slate-700" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                  <span className="block truncate text-xs" style={{ color: 'var(--documents-el-muted)' }}>
                    {item.description}
                  </span>
                </span>
              </button>
            )
          })}
        </>
      )}
    </div>
  )
})
