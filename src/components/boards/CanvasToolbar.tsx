/**
 * CanvasToolbar — a floating pill over the board: the tools (each with a
 * one-key shortcut), a style button (colour, stroke, fill) that also
 * restyles the selected shape, undo/redo and delete.
 */

import {
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'
import { STROKE_WIDTHS } from '@/lib/canvas-shapes'

export type CanvasTool = 'select' | 'hand' | 'pen' | 'eraser' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text' | 'note'

export const PRESET_COLORS = [
  '#6366f1', // indigo
  '#ef4444', // red
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#64748b', // slate
  '#000000', // black
]

export interface CanvasStyle {
  color: string
  strokeWidth: number
  filled: boolean
}

/** `desktopOnly` tools are left off phones, where the bar has to fit: a drag on the empty
 * board moves it anyway, and Arrow does what Line does. */
export const TOOLS: {
  id: CanvasTool
  label: string
  key: string
  icon: LucideIcon
  rotate?: boolean
  desktopOnly?: boolean
}[] = [
  { id: 'select', label: 'Select', key: 'V', icon: MousePointer2 },
  { id: 'hand', label: 'Move the board', key: 'H', icon: Hand, desktopOnly: true },
  { id: 'pen', label: 'Pen', key: 'P', icon: Pencil },
  { id: 'eraser', label: 'Eraser: drag over shapes to remove them', key: 'E', icon: Eraser },
  { id: 'rect', label: 'Rectangle', key: 'R', icon: Square },
  { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
  { id: 'arrow', label: 'Arrow', key: 'A', icon: ArrowUpRight },
  { id: 'line', label: 'Line', key: 'L', icon: Minus, rotate: true, desktopOnly: true },
  { id: 'text', label: 'Text', key: 'T', icon: Type },
  { id: 'note', label: 'Sticky note', key: 'N', icon: StickyNote },
]

interface CanvasToolbarProps {
  /** View-only connection: tools are shown but inert. */
  disabled?: boolean
  activeTool: CanvasTool
  style: CanvasStyle
  hasSelection: boolean
  onToolChange: (tool: CanvasTool) => void
  onStyleChange: (style: Partial<CanvasStyle>) => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
}

const iconButton =
  'flex size-8 shrink-0 items-center md:size-9 justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4'
const idle = 'text-muted-foreground hover:bg-muted hover:text-foreground'

function Divider() {
  return <div className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
}

function Segmented<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; content: React.ReactNode; testId: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-1 rounded-lg bg-muted p-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            data-testid={o.testId}
            title={o.label}
            aria-label={o.label}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-8 flex-1 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === o.value ? 'bg-card shadow-sm' : 'hover:bg-card/60',
            )}
          >
            {o.content}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CanvasToolbar({
  disabled,
  activeTool,
  style,
  hasSelection,
  onToolChange,
  onStyleChange,
  onDelete,
  onUndo,
  onRedo,
}: CanvasToolbarProps) {
  return (
    <div
      data-testid="canvas-toolbar"
      role="toolbar"
      aria-label="Drawing tools"
      aria-disabled={disabled}
      className={cn(
        'flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur [scrollbar-width:none]',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {TOOLS.map(({ id, label, key, icon: Icon, rotate, desktopOnly }, i) => (
        <span key={id} className="contents">
          {/* Navigation tools | drawing tools */}
          {i === 2 && <Divider />}
          <button
            type="button"
            data-testid={`tool-${id}`}
            onClick={() => onToolChange(id)}
            title={`${label} (${key})`}
            aria-label={label}
            aria-keyshortcuts={key}
            aria-pressed={activeTool === id}
            className={cn(
              iconButton,
              activeTool === id ? 'bg-primary/15 text-primary-text' : idle,
              desktopOnly && 'max-md:hidden',
            )}
          >
            <Icon className={cn(rotate && '-rotate-45')} />
          </button>
        </span>
      ))}

      <Divider />

      {/* Style: one swatch for the current colour; colour, stroke and fill open on click. */}
      <Popover>
        <PopoverTrigger
          data-testid="canvas-color"
          title={hasSelection ? 'Style of the selected shape' : 'Style'}
          aria-label="Style"
          className={cn(iconButton, idle)}
        >
          <span
            className="size-5 rounded-full border-2 border-background shadow-[0_0_0_1px_var(--color-border)]"
            style={{ backgroundColor: style.color }}
          />
        </PopoverTrigger>
        <PopoverContent side="bottom" className="w-56 space-y-3 p-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Colour</p>
            <div className="grid grid-cols-5 gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  data-testid={`color-${color}`}
                  onClick={() => onStyleChange({ color })}
                  title={color}
                  aria-label={color}
                  aria-pressed={style.color === color}
                  className={cn(
                    'size-7 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring',
                    style.color === color
                      ? 'ring-2 ring-foreground ring-offset-2 ring-offset-popover'
                      : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <Segmented
            label="Stroke"
            value={style.strokeWidth}
            onChange={(strokeWidth) => onStyleChange({ strokeWidth })}
            options={STROKE_WIDTHS.map((w, i) => ({
              value: w,
              label: ['Thin', 'Medium', 'Bold'][i],
              testId: `stroke-${w}`,
              content: <span className="w-6 rounded-full bg-foreground" style={{ height: w }} />,
            }))}
          />
          <Segmented
            label="Fill (shapes)"
            value={style.filled}
            onChange={(filled) => onStyleChange({ filled })}
            options={[
              {
                value: false,
                label: 'No fill',
                testId: 'fill-none',
                content: <span className="size-4 rounded border-2" style={{ borderColor: style.color }} />,
              },
              {
                value: true,
                label: 'Filled',
                testId: 'fill-tint',
                content: (
                  <span
                    className="size-4 rounded border-2"
                    style={{ borderColor: style.color, backgroundColor: `${style.color}55` }}
                  />
                ),
              },
            ]}
          />
        </PopoverContent>
      </Popover>

      <Divider />

      <button
        type="button"
        data-testid="canvas-undo"
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        className={cn(iconButton, idle)}
      >
        <Undo2 />
      </button>
      <button
        type="button"
        data-testid="canvas-redo"
        onClick={onRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        className={cn(iconButton, idle, 'max-md:hidden')}
      >
        <Redo2 />
      </button>
      <button
        type="button"
        data-testid="canvas-delete"
        onClick={onDelete}
        disabled={!hasSelection}
        title="Delete selected (Delete)"
        aria-label="Delete selected"
        className={cn(
          iconButton,
          // Phones delete with the eraser (a tap removes a shape), so the bar fits.
          'max-md:hidden text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:pointer-events-none disabled:opacity-30',
        )}
      >
        <Trash2 />
      </button>
    </div>
  )
}
