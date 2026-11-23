/**
 * CanvasToolbar — a floating pill over the board: shape tools, a colour
 * picker (one swatch that opens the palette), undo/redo and delete.
 */

import { MousePointer2, Square, Circle, Minus, Type, Undo2, Redo2, Trash2, type LucideIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'

export type CanvasTool = 'select' | 'rect' | 'ellipse' | 'line' | 'text'

const PRESET_COLORS = [
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

interface CanvasToolbarProps {
  /** View-only connection: tools are shown but inert. */
  disabled?: boolean
  activeTool: CanvasTool
  activeColor: string
  hasSelection: boolean
  onToolChange: (tool: CanvasTool) => void
  onColorChange: (color: string) => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
}

const tools: { id: CanvasTool; label: string; icon: LucideIcon; rotate?: boolean }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  { id: 'line', label: 'Line', icon: Minus, rotate: true },
  { id: 'text', label: 'Text', icon: Type },
]

const iconButton =
  'flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4'

function Divider() {
  return <div className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />
}

export function CanvasToolbar({
  disabled,
  activeTool,
  activeColor,
  hasSelection,
  onToolChange,
  onColorChange,
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
        'flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {tools.map(({ id, label, icon: Icon, rotate }) => (
        <button
          key={id}
          type="button"
          data-testid={`tool-${id}`}
          onClick={() => onToolChange(id)}
          title={label}
          aria-label={label}
          aria-pressed={activeTool === id}
          className={cn(
            iconButton,
            activeTool === id
              ? 'bg-primary/15 text-primary-text'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className={cn(rotate && '-rotate-45')} />
        </button>
      ))}

      <Divider />

      {/* One swatch for the current colour; the palette opens on click. */}
      <Popover>
        <PopoverTrigger
          data-testid="canvas-color"
          title="Colour"
          aria-label="Colour"
          className={cn(iconButton, 'text-muted-foreground hover:bg-muted')}
        >
          <span
            className="size-5 rounded-full border-2 border-background shadow-[0_0_0_1px_var(--color-border)]"
            style={{ backgroundColor: activeColor }}
          />
        </PopoverTrigger>
        <PopoverContent side="bottom" className="w-auto p-2">
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                data-testid={`color-${color}`}
                onClick={() => onColorChange(color)}
                title={color}
                aria-label={color}
                aria-pressed={activeColor === color}
                className={cn(
                  'size-7 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring',
                  activeColor === color
                    ? 'ring-2 ring-foreground ring-offset-2 ring-offset-popover'
                    : 'hover:scale-110',
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Divider />

      <button
        type="button"
        data-testid="canvas-undo"
        onClick={onUndo}
        title="Undo"
        aria-label="Undo"
        className={cn(iconButton, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
      >
        <Undo2 />
      </button>
      <button
        type="button"
        data-testid="canvas-redo"
        onClick={onRedo}
        title="Redo"
        aria-label="Redo"
        className={cn(iconButton, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
      >
        <Redo2 />
      </button>
      <button
        type="button"
        data-testid="canvas-delete"
        onClick={onDelete}
        disabled={!hasSelection}
        title="Delete selected"
        aria-label="Delete selected"
        className={cn(
          iconButton,
          'text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:pointer-events-none disabled:opacity-30',
        )}
      >
        <Trash2 />
      </button>
    </div>
  )
}
