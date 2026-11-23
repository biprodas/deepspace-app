/**
 * The "/" menu's blocks (Notion-style): what each inserts, and the search
 * that filters them as you type after the slash. Every block here is a node
 * the editor already has (StarterKit + task lists), so notes stay the same
 * shape for collaboration and for "Add to notes".
 */

import type { ChainedCommands } from '@tiptap/react'

export interface SlashCommand {
  id: string
  title: string
  description: string
  /** Extra words that find it, e.g. "h1" for Heading 1. */
  keywords: string[]
  /** Runs on a chain that has already deleted the "/query" text. */
  run: (chain: ChainedCommands) => ChainedCommands
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'text',
    title: 'Text',
    description: 'Plain paragraph',
    keywords: ['paragraph', 'p', 'plain'],
    run: (c) => c.setParagraph(),
  },
  {
    id: 'h1',
    title: 'Heading 1',
    description: 'Big section heading',
    keywords: ['h1', 'title', 'heading'],
    run: (c) => c.setHeading({ level: 1 }),
  },
  {
    id: 'h2',
    title: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'subtitle', 'heading'],
    run: (c) => c.setHeading({ level: 2 }),
  },
  {
    id: 'h3',
    title: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading'],
    run: (c) => c.setHeading({ level: 3 }),
  },
  {
    id: 'bullets',
    title: 'Bulleted list',
    description: 'A simple list',
    keywords: ['ul', 'bullet', 'list', 'unordered'],
    run: (c) => c.toggleBulletList(),
  },
  {
    id: 'numbers',
    title: 'Numbered list',
    description: 'A list with numbers',
    keywords: ['ol', 'ordered', 'numbered', 'list', '1.'],
    run: (c) => c.toggleOrderedList(),
  },
  {
    id: 'todo',
    title: 'To-do list',
    description: 'Track tasks with checkboxes',
    keywords: ['todo', 'task', 'checkbox', 'check', '[]'],
    run: (c) => c.toggleTaskList(),
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a quote or source line',
    keywords: ['blockquote', 'citation', '>'],
    run: (c) => c.toggleBlockquote(),
  },
  {
    id: 'code',
    title: 'Code',
    description: 'A code or formula block',
    keywords: ['codeblock', 'pre', 'snippet', '```'],
    run: (c) => c.toggleCodeBlock(),
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'A line between sections',
    keywords: ['hr', 'line', 'separator', '---'],
    run: (c) => c.setHorizontalRule(),
  },
]

/**
 * Commands matching what's typed after "/": title or keyword prefixes first,
 * then anything containing the query. Empty query lists everything.
 */
export function filterSlashCommands(query: string, commands: SlashCommand[] = SLASH_COMMANDS): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  const words = (c: SlashCommand) => [c.title.toLowerCase(), ...c.keywords]
  const starts = commands.filter((c) => words(c).some((w) => w.startsWith(q) || w.split(' ').some((p) => p.startsWith(q))))
  const contains = commands.filter((c) => !starts.includes(c) && words(c).some((w) => w.includes(q)))
  return [...starts, ...contains]
}
