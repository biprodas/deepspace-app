/**
 * CanvasView — the board: an SVG canvas over DeepSpace's `useCanvas`, with
 * tools, selection, resize handles, in-place text editing, zoom/pan and
 * members' cursors. From DeepSpace's canvas feature, adapted for
 * study-space boards (docs/features.md F15): read-only when the socket
 * can't write, an initial centre, and drawing a generated mind map once
 * (`drawOnce`).
 *
 * Pointer events throughout, so mouse, pen and touch all draw; two fingers
 * pinch to zoom. A drag is previewed locally and sent once when it ends,
 * so each move or resize is one step of undo (not one per mouse movement).
 */

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useCanvas, useUserLookup, type CanvasShapeClient } from 'deepspace'
import { Download, Maximize, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { ConfirmModal } from '@/components/ui'
import type { LaidOutShape } from '@/lib/mindmap'
import {
  BOARD_FONT,
  boundsOf,
  boxFromPoints,
  DEFAULT_STROKE_WIDTH,
  fontSizeOf,
  handlesFor,
  isSegment,
  LINE_HEIGHT,
  NOTE_PADDING,
  NOTE_SIZE,
  penShape,
  resizeBox,
  TEXT_FONT_SIZE,
  TEXT_PADDING,
  textHeight,
  tint,
  unionBounds,
  type Box,
  type Handle,
} from '@/lib/canvas-shapes'
import { CanvasToolbar, PRESET_COLORS, TOOLS, type CanvasStyle, type CanvasTool } from './CanvasToolbar'
import { ShapeRenderer, type DrawnShape } from './ShapeRenderer'

interface CanvasViewProps {
  docId: string
  className?: string
  /** Canvas point to centre in view on first render. */
  center?: { x: number; y: number }
  /** Shapes to add once, on an empty canvas this client can write to (a generated mind map). */
  drawOnce?: LaidOutShape[]
  onDrawn?: () => void
  /**
   * The page's title card, floated top left over the board. A function gets
   * the board's own actions, for the card's menu (e.g. "Clear board").
   */
  header?: ReactNode | ((board: BoardActions) => ReactNode)
  /** File name (without extension) for "Download as image". */
  exportName?: string
}

type Point = { x: number; y: number }
type View = { x: number; y: number; zoom: number }

export interface BoardActions {
  /** Asks to confirm, then removes every shape (with a Restore offer); a no-op when it can't. */
  clear: () => void
  /** The board has shapes and this connection can write. */
  canClear: boolean
}
/** A change this client made to a shape, shown until the room's copy of it changes. */
type LocalPatch = Partial<Box> & { props?: Record<string, unknown> }

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; view: View }
  | { kind: 'move'; id: string; sx: number; sy: number; orig: Box; box?: Box }
  | { kind: 'resize'; id: string; handle: Handle; orig: DrawnShape; box?: Box }
  | { kind: 'create'; tool: CanvasTool; start: Point; sx: number; sy: number; points: Point[]; dragged: boolean }
  | { kind: 'pinch'; d0: number; m0: Point; view: View }
  | { kind: 'erase'; last: Point; ids: Set<string> }

// User colors for multi-user cursors
const CURSOR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
/** Screen pixels a press may wander and still count as a click. */
const CLICK_SLOP = 4
const TEXT_MAX = 500
const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  start: 'move',
  end: 'move',
}

const clampZoom = (z: number) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM)
const newId = () => crypto.randomUUID()

/** True when a key press belongs to a text field, not the board. */
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** The toolbar style that a shape was drawn with (so selecting a shape shows, and keeps, its style). */
function styleOf(shape: DrawnShape, fallback: CanvasStyle): CanvasStyle {
  const stroke = shape.props.stroke
  return {
    color: typeof stroke === 'string' && PRESET_COLORS.includes(stroke) ? stroke : fallback.color,
    strokeWidth: (shape.props.strokeWidth as number) ?? DEFAULT_STROKE_WIDTH,
    filled:
      (shape.type === 'rect' || shape.type === 'ellipse') && (shape.props.fill ?? 'transparent') !== 'transparent',
  }
}

/** The shape a finished press or drag makes with `tool`, or null when it makes none (a click with a line). */
function makeShape(
  tool: CanvasTool,
  start: Point,
  end: Point,
  dragged: boolean,
  style: CanvasStyle,
): DrawnShape | null {
  const stroke = style.color
  const box = boxFromPoints(start, end)
  switch (tool) {
    case 'rect':
    case 'ellipse': {
      const b = dragged ? box : { x: start.x - 70, y: start.y - 45, width: 140, height: 90 }
      return {
        type: tool,
        ...b,
        props: { stroke, strokeWidth: style.strokeWidth, fill: style.filled ? tint(stroke) : 'transparent' },
      }
    }
    case 'line':
    case 'arrow':
      if (!dragged) return null
      return {
        type: tool,
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
        props: { stroke, strokeWidth: style.strokeWidth, fill: 'transparent' },
      }
    case 'text': {
      const width = dragged ? Math.max(box.width, 60) : 220
      const height = Math.max(dragged ? box.height : 0, Math.ceil(TEXT_FONT_SIZE * LINE_HEIGHT + TEXT_PADDING * 2))
      const at = dragged ? box : { x: start.x, y: start.y - height / 2 }
      return {
        type: 'text',
        x: at.x,
        y: at.y,
        width,
        height,
        props: { text: '', fontSize: TEXT_FONT_SIZE, stroke, fill: 'transparent' },
      }
    }
    case 'note': {
      const b = dragged
        ? { ...box, width: Math.max(box.width, 80), height: Math.max(box.height, 60) }
        : { x: start.x - NOTE_SIZE.width / 2, y: start.y - NOTE_SIZE.height / 2, ...NOTE_SIZE }
      return { type: 'note', ...b, props: { text: '', fontSize: TEXT_FONT_SIZE, stroke } }
    }
    default:
      return null
  }
}

export function CanvasView({ docId, className, center, drawOnce, onDrawn, header, exportName }: CanvasViewProps) {
  const {
    shapes,
    viewports,
    connected,
    canWrite,
    addShape,
    updateShape: sendUpdate,
    moveShape: sendMove,
    resizeShape: sendResize,
    deleteShape,
    setViewport,
    undo,
    redo,
  } = useCanvas(docId)

  const [tool, setTool] = useState<CanvasTool>('select')
  const [style, setStyle] = useState<CanvasStyle>({
    color: '#6366f1',
    strokeWidth: DEFAULT_STROKE_WIDTH,
    filled: false,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  /** A shape being drawn, shown before it's sent. */
  const [draft, setDraft] = useState<DrawnShape | null>(null)
  /** A shape being moved or resized: its box, shown before it's sent. */
  const [override, setOverride] = useState<({ id: string } & Box) | null>(null)
  const [panning, setPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  /** Shapes the eraser has passed over; removed when it lifts. */
  const [erasing, setErasing] = useState<Set<string>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  /** What "Clear board" removed, while it can still be restored. */
  const [cleared, setCleared] = useState<DrawnShape[] | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const contentRef = useRef<SVGGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const clipboard = useRef<DrawnShape | null>(null)
  /** Ids this client added that the room hasn't sent back yet. */
  const pendingIds = useRef(new Set<string>())
  const viewRef = useRef(view)
  const shapesRef = useRef(shapes)
  const { getName } = useUserLookup()
  const drawn = useRef(false)
  const centred = useRef(false)

  useEffect(() => {
    viewRef.current = view
  }, [view])
  useEffect(() => {
    shapesRef.current = shapes
  }, [shapes])

  // The room sends a move, resize or edit to everyone *but* its author, and useCanvas doesn't
  // apply it locally, so this client keeps its own changes here. Each is laid over the room's
  // copy of the shape it was made on, and dropped once that copy changes (someone else's edit,
  // an undo, a reconnect), since the room's version then already includes it or replaces it.
  const [localEdits, setLocalEdits] = useState(new Map<string, { base: CanvasShapeClient; patch: LocalPatch }>())
  const current = useMemo(
    () =>
      shapes.map((s) => {
        const edit = localEdits.get(s.id)
        if (!edit || edit.base !== s) return s
        const { props, ...box } = edit.patch
        return { ...s, ...box, props: props ? { ...s.props, ...props } : s.props }
      }),
    [shapes, localEdits],
  )
  const remember = useCallback(
    (id: string, patch: LocalPatch) =>
      setLocalEdits((prev) => {
        const base = shapesRef.current.find((s) => s.id === id)
        if (!base) return prev
        const old = prev.get(id)
        const merged =
          old && old.base === base
            ? { ...old.patch, ...patch, props: patch.props ? { ...old.patch.props, ...patch.props } : old.patch.props }
            : patch
        return new Map(prev).set(id, { base, patch: merged })
      }),
    [],
  )
  const moveShape = useCallback(
    (id: string, x: number, y: number) => {
      sendMove(id, x, y)
      remember(id, { x, y })
    },
    [sendMove, remember],
  )
  const resizeShape = useCallback(
    (id: string, width: number, height: number, x?: number, y?: number) => {
      sendResize(id, width, height, x, y)
      remember(id, { width, height, ...(x !== undefined && { x }), ...(y !== undefined && { y }) })
    },
    [sendResize, remember],
  )
  const updateShape = useCallback(
    (id: string, props: Record<string, unknown>) => {
      sendUpdate(id, props)
      remember(id, { props })
    },
    [sendUpdate, remember],
  )

  const displayed = useMemo(
    () => (override ? current.map((s) => (s.id === override.id ? { ...s, ...override } : s)) : current),
    [current, override],
  )
  const selected = displayed.find((s) => s.id === selectedId)
  const editing = displayed.find((s) => s.id === editingId)

  // Centre the requested point once the canvas has a size.
  useEffect(() => {
    const svg = svgRef.current
    if (!center || centred.current || !svg) return
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return
    centred.current = true
    setView((v) => ({ ...v, x: rect.width / 2 - center.x * v.zoom, y: rect.height / 2 - center.y * v.zoom }))
  }, [center])

  // Draw a generated mind map once: only on an empty board, only if we can write.
  useEffect(() => {
    if (!drawOnce || drawn.current || !connected || !canWrite) return
    drawn.current = true
    if (shapes.length === 0) for (const shape of drawOnce) addShape(shape)
    onDrawn?.()
  }, [drawOnce, connected, canWrite, shapes.length, addShape, onDrawn])

  // Report viewport on pan/zoom change
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setViewport({
      x: -view.x / view.zoom,
      y: -view.y / view.zoom,
      width: rect.width / view.zoom,
      height: rect.height / view.zoom,
      zoom: view.zoom,
    })
  }, [view, setViewport])

  // A shape deleted elsewhere (or undone) can't stay selected or open for editing. A shape
  // this client just added isn't in `shapes` until the room sends it back, so it waits.
  useEffect(() => {
    for (const s of shapes) pendingIds.current.delete(s.id)
    const gone = (id: string | null) => !!id && !pendingIds.current.has(id) && !shapes.some((s) => s.id === id)
    if (gone(selectedId)) setSelectedId(null)
    if (gone(editingId)) setEditingId(null)
  }, [shapes, selectedId, editingId])

  /** Adds a shape with a known id, so it can be selected or edited before the room confirms it. */
  const add = useCallback(
    (shape: DrawnShape & { id: string }) => {
      pendingIds.current.add(shape.id)
      addShape(shape)
    },
    [addShape],
  )

  const toCanvas = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current?.getBoundingClientRect()
    const v = viewRef.current
    if (!rect) return { x: 0, y: 0 }
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom }
  }, [])

  /** Zoom to `next(zoom)` keeping the screen point (sx, sy) still; the middle of the board by default. */
  const zoomAt = useCallback((next: (zoom: number) => number, sx?: number, sy?: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = sx ?? rect.width / 2
    const cy = sy ?? rect.height / 2
    setView((v) => {
      const zoom = clampZoom(next(v.zoom))
      return { x: cx - (cx - v.x) * (zoom / v.zoom), y: cy - (cy - v.y) * (zoom / v.zoom), zoom }
    })
  }, [])

  /** Zoom and pan so every shape is in view (or back to 100% on an empty board). */
  const fitToContent = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect()
    const bounds = unionBounds(current)
    if (!rect) return
    if (!bounds) return setView({ x: 0, y: 0, zoom: 1 })
    const zoom = clampZoom(Math.min((rect.width - 120) / bounds.width, (rect.height - 200) / bounds.height, 2))
    setView({
      x: rect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
      zoom,
    })
  }, [current])

  // Wheel: scroll pans; Ctrl/⌘ + wheel (and a trackpad pinch, which sends ctrlKey) zooms at the pointer.
  // A native listener, because React's wheel listener is passive and can't stop the page scrolling.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = svg.getBoundingClientRect()
        const delta = Math.max(-50, Math.min(50, e.deltaY))
        zoomAt((z) => z * Math.exp(-delta * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      const shape = id && current.find((s) => s.id === id)
      if (shape) setStyle((s) => styleOf(shape, s))
    },
    [current],
  )

  // ─── Text editing ──────────────────────────────────────

  const [editText, setEditText] = useState('')
  const startEditing = useCallback(
    (id: string) => {
      const shape = current.find((s) => s.id === id)
      if (!shape || !canWrite || (shape.type !== 'text' && shape.type !== 'note')) return
      setSelectedId(id)
      setEditText(String(shape.props.text ?? ''))
      setEditingId(id)
    },
    [current, canWrite],
  )

  const finishEditing = useCallback(
    (save: boolean) => {
      const shape = current.find((s) => s.id === editingId)
      setEditingId(null)
      if (!shape || !save) return
      const text = editText.slice(0, TEXT_MAX)
      // An emptied text box goes away; an empty sticky note stays (it's still a note).
      if (shape.type === 'text' && !text.trim()) {
        deleteShape(shape.id)
        setSelectedId(null)
        return
      }
      if (text !== (shape.props.text ?? '')) updateShape(shape.id, { ...shape.props, text })
      const needed = textHeight({ ...shape, props: { ...shape.props, text } })
      if (needed > shape.height) resizeShape(shape.id, shape.width, needed)
    },
    [current, editingId, editText, deleteShape, updateShape, resizeShape],
  )

  // ─── Pointer gestures ──────────────────────────────────

  /**
   * Marks every shape under the eraser's path from its last point to (x, y):
   * sampled every few pixels, so a quick swipe doesn't skip a thin line.
   */
  const eraseAlong = (g: Extract<Gesture, { kind: 'erase' }>, x: number, y: number) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x - g.last.x, y - g.last.y) / 4))
    let added = false
    for (let i = 1; i <= steps; i++) {
      const px = g.last.x + ((x - g.last.x) * i) / steps
      const py = g.last.y + ((y - g.last.y) * i) / steps
      for (const el of document.elementsFromPoint(px, py)) {
        const id = el.closest('[data-shape-id]')?.getAttribute('data-shape-id')
        if (id && !g.ids.has(id)) {
          g.ids.add(id)
          added = true
        }
      }
    }
    g.last = { x, y }
    if (added) setErasing(new Set(g.ids))
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // A second finger turns whatever was happening into a pinch.
    if (pointers.current.size === 2) {
      const rect = e.currentTarget.getBoundingClientRect()
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        kind: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        m0: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
        view: viewRef.current,
      }
      setDraft(null)
      setOverride(null)
      return
    }
    if (pointers.current.size > 2) return
    if (editingId) finishEditing(true)

    const panGesture = (): Gesture => ({ kind: 'pan', sx: e.clientX, sy: e.clientY, view: viewRef.current })
    if (e.button === 1 || tool === 'hand' || spaceHeld) {
      e.preventDefault()
      gesture.current = panGesture()
      setPanning(true)
      return
    }
    if (e.button !== 0) return

    const target = e.target as Element
    const handle = target.closest('[data-handle]')?.getAttribute('data-handle') as Handle | undefined
    if (handle && selected && canWrite) {
      gesture.current = { kind: 'resize', id: selected.id, handle, orig: selected }
      return
    }

    if (tool === 'select') {
      const id = target.closest('[data-shape-id]')?.getAttribute('data-shape-id')
      const shape = id ? current.find((s) => s.id === id) : undefined
      if (shape) {
        select(shape.id)
        if (canWrite) gesture.current = { kind: 'move', id: shape.id, sx: e.clientX, sy: e.clientY, orig: shape }
        return
      }
      // Empty board: deselect, and a drag pans.
      select(null)
      gesture.current = panGesture()
      setPanning(true)
      return
    }

    if (!canWrite) return
    if (tool === 'eraser') {
      const g: Gesture = { kind: 'erase', last: { x: e.clientX, y: e.clientY }, ids: new Set() }
      gesture.current = g
      eraseAlong(g, e.clientX, e.clientY)
      return
    }
    const start = toCanvas(e.clientX, e.clientY)
    gesture.current = { kind: 'create', tool, start, sx: e.clientX, sy: e.clientY, points: [start], dragged: false }
    if (tool === 'pen') setDraft(penShape([start], style.color, style.strokeWidth))
  }

  const onPointerMove = (e: PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return

    switch (g.kind) {
      case 'erase':
        eraseAlong(g, e.clientX, e.clientY)
        return
      case 'pinch': {
        const rect = svgRef.current?.getBoundingClientRect()
        if (!rect || pointers.current.size < 2) return
        const [a, b] = [...pointers.current.values()]
        const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
        const zoom = clampZoom((g.view.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0)
        // The canvas point that was under the fingers stays under them.
        setView({
          x: mid.x - ((g.m0.x - g.view.x) / g.view.zoom) * zoom,
          y: mid.y - ((g.m0.y - g.view.y) / g.view.zoom) * zoom,
          zoom,
        })
        return
      }
      case 'pan':
        setView({ ...g.view, x: g.view.x + e.clientX - g.sx, y: g.view.y + e.clientY - g.sy })
        return
      case 'move': {
        const zoom = viewRef.current.zoom
        g.box = { ...g.orig, x: g.orig.x + (e.clientX - g.sx) / zoom, y: g.orig.y + (e.clientY - g.sy) / zoom }
        setOverride({ id: g.id, ...g.box })
        return
      }
      case 'resize':
        g.box = resizeBox(g.orig, g.handle, toCanvas(e.clientX, e.clientY))
        setOverride({ id: g.id, ...g.box })
        return
      case 'create': {
        const pos = toCanvas(e.clientX, e.clientY)
        if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > CLICK_SLOP) g.dragged = true
        if (g.tool === 'pen') {
          const last = g.points[g.points.length - 1]
          if (Math.hypot(pos.x - last.x, pos.y - last.y) * viewRef.current.zoom < 1.5) return
          g.points.push(pos)
          setDraft(penShape(g.points, style.color, style.strokeWidth))
        } else if (g.dragged) {
          setDraft(makeShape(g.tool, g.start, pos, true, style))
        }
      }
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      // Lifting one finger ends the pinch; the other doesn't start drawing.
      if (pointers.current.size < 2) gesture.current = null
      return
    }
    gesture.current = null
    const cancelled = e.type === 'pointercancel'

    switch (g.kind) {
      case 'erase':
        if (!cancelled) for (const id of g.ids) deleteShape(id)
        setErasing(new Set())
        break
      case 'pan':
        setPanning(false)
        break
      case 'move':
        if (g.box && !cancelled) moveShape(g.id, g.box.x, g.box.y)
        setOverride(null)
        break
      case 'resize':
        if (g.box && !cancelled) {
          const box =
            g.orig.type === 'text' || g.orig.type === 'note'
              ? { ...g.box, height: Math.max(g.box.height, textHeight({ ...g.orig, ...g.box })) }
              : g.box
          resizeShape(g.id, box.width, box.height, box.x, box.y)
        }
        setOverride(null)
        break
      case 'create': {
        setDraft(null)
        if (cancelled) break
        const shape =
          g.tool === 'pen'
            ? penShape(g.points, style.color, style.strokeWidth)
            : makeShape(g.tool, g.start, toCanvas(e.clientX, e.clientY), g.dragged, style)
        if (!shape) break
        const id = newId()
        add({ ...shape, id })
        // The pen stays out for the next stroke; other tools hand back to Select.
        if (g.tool !== 'pen') {
          setTool('select')
          setSelectedId(id)
        }
        if (g.tool === 'text' || g.tool === 'note') {
          setEditText('')
          setEditingId(id)
        }
      }
    }
  }

  // Moves and releases are followed on the window, so a drag can leave the board and come back.
  const handlers = useRef({ move: onPointerMove, up: onPointerUp })
  useEffect(() => {
    handlers.current = { move: onPointerMove, up: onPointerUp }
  })
  useEffect(() => {
    const move = (e: PointerEvent) => handlers.current.move(e)
    const up = (e: PointerEvent) => handlers.current.up(e)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!canWrite || tool !== 'select') return
    const id = (e.target as Element).closest('[data-shape-id]')?.getAttribute('data-shape-id')
    if (id) return startEditing(id)
    // Double-click on the empty board: a text box right there.
    const shape = makeShape('text', toCanvas(e.clientX, e.clientY), toCanvas(e.clientX, e.clientY), false, style)!
    const newShapeId = newId()
    add({ ...shape, id: newShapeId })
    setSelectedId(newShapeId)
    setEditText('')
    setEditingId(newShapeId)
  }

  // ─── Shape actions ─────────────────────────────────────

  const handleDelete = useCallback(() => {
    if (!selectedId) return
    deleteShape(selectedId)
    setSelectedId(null)
  }, [selectedId, deleteShape])

  /** Adds a copy of `shape` a little down and right of `offset` steps, and selects it. */
  const placeCopy = useCallback(
    (shape: DrawnShape, offset: number) => {
      const id = newId()
      add({
        type: shape.type,
        x: shape.x + 24 * offset,
        y: shape.y + 24 * offset,
        width: shape.width,
        height: shape.height,
        props: { ...shape.props },
        id,
      })
      setSelectedId(id)
    },
    [add],
  )
  const pasteCount = useRef(0)

  /** The toolbar's style also restyles the selected shape. */
  const changeStyle = useCallback(
    (change: Partial<CanvasStyle>) => {
      const next = { ...style, ...change }
      setStyle(next)
      if (!selected || !canWrite) return
      const props = { ...selected.props }
      const fillable = selected.type === 'rect' || selected.type === 'ellipse'
      const hasFill = (props.fill ?? 'transparent') !== 'transparent'
      if (change.color) {
        props.stroke = change.color
        if (hasFill && selected.type !== 'note') props.fill = tint(change.color)
      }
      if (change.strokeWidth && selected.type !== 'text' && selected.type !== 'note')
        props.strokeWidth = change.strokeWidth
      if (change.filled !== undefined && fillable) props.fill = change.filled ? tint(next.color) : 'transparent'
      updateShape(selected.id, props)
    },
    [style, selected, canWrite, updateShape],
  )

  // ─── Clearing ─────────────────────────────────────────

  /** Removes every shape, keeping a copy so the clear can be restored in one go. */
  const clearBoard = useCallback(() => {
    setConfirmClear(false)
    if (current.length === 0) return
    setCleared(
      current.map(({ id, type, x, y, width, height, rotation, props }) => ({
        id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        props,
      })),
    )
    for (const shape of current) deleteShape(shape.id)
    setSelectedId(null)
    setEditingId(null)
  }, [current, deleteShape])

  /** Puts back what "Clear board" removed, with the same ids. */
  const restoreCleared = useCallback(() => {
    if (!cleared) return
    for (const shape of cleared) add({ ...shape, id: shape.id! })
    setCleared(null)
  }, [cleared, add])

  // The offer to restore lasts 15 seconds.
  useEffect(() => {
    if (!cleared) return
    const timer = setTimeout(() => setCleared(null), 15_000)
    return () => clearTimeout(timer)
  }, [cleared])

  const boardActions: BoardActions = {
    clear: () => {
      if (canWrite && current.length > 0) setConfirmClear(true)
    },
    canClear: canWrite && current.length > 0,
  }

  // ─── Keyboard ──────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (typingIn(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setSpaceHeld(true)
        return
      }
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && key === 'c' && selected) {
        clipboard.current = selected
        pasteCount.current = 0
        return
      }
      if (mod && key === 'v' && clipboard.current && canWrite) {
        e.preventDefault()
        pasteCount.current += 1
        placeCopy(clipboard.current, pasteCount.current)
        return
      }
      if (mod && key === 'd' && selected && canWrite) {
        e.preventDefault()
        placeCopy(selected, 1)
        return
      }
      if (mod || e.altKey) return

      if (key === 'escape') {
        setSelectedId(null)
        setTool('select')
        return
      }
      if ((key === 'delete' || key === 'backspace') && selected && canWrite) {
        e.preventDefault()
        handleDelete()
        return
      }
      if (key === 'enter' && selected) {
        e.preventDefault()
        startEditing(selected.id)
        return
      }
      if (key.startsWith('arrow') && selected && canWrite) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
        moveShape(selected.id, selected.x + dx, selected.y + dy)
        return
      }
      if (key === '+' || key === '=') return zoomAt((z) => z * 1.2)
      if (key === '-') return zoomAt((z) => z / 1.2)
      if (key === '0') return zoomAt(() => 1)
      if (key === '1' && e.shiftKey) return fitToContent()

      const pick = TOOLS.find((t) => t.key.toLowerCase() === key)
      if (pick && (canWrite || pick.id === 'select' || pick.id === 'hand')) setTool(pick.id)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [selected, canWrite, undo, redo, handleDelete, startEditing, moveShape, placeCopy, zoomAt, fitToContent])

  // ─── Export ────────────────────────────────────────────

  /** Downloads the board's shapes as a PNG on white (no grid, cursors or selection). */
  const downloadImage = useCallback(() => {
    const content = contentRef.current
    const bounds = unionBounds(current)
    if (!content || !bounds) return
    const pad = 32
    const width = bounds.width + pad * 2
    const height = bounds.height + pad * 2
    const scale = Math.min(2, 8000 / Math.max(width, height))
    const markup = new XMLSerializer().serializeToString(content)
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" ` +
      `viewBox="${bounds.x - pad} ${bounds.y - pad} ${width} ${height}">` +
      `<rect x="${bounds.x - pad}" y="${bounds.y - pad}" width="${width}" height="${height}" fill="#ffffff"/>${markup}</svg>`
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(width * scale)
      canvas.height = Math.ceil(height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) return
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${(exportName || 'board').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'board'}.png`
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      }, 'image/png')
    }
    img.src = url
  }, [current, exportName])

  // ─── Render ────────────────────────────────────────────

  const { zoom } = view
  const cursor = panning
    ? 'grabbing'
    : tool === 'hand' || spaceHeld
      ? 'grab'
      : tool === 'select'
        ? 'default'
        : tool === 'text'
          ? 'text'
          : tool === 'eraser'
            ? 'cell'
            : 'crosshair'

  const editingFont = editing ? fontSizeOf(editing) : TEXT_FONT_SIZE
  const editingPad = editing?.type === 'note' ? NOTE_PADDING : TEXT_PADDING
  const toolHint = TOOLS.find((t) => t.id === tool)

  const zoomButton =
    'flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'

  // The board fills the space; everything else floats over it (title card,
  // toolbar, status, zoom), so the page has one bar: the space bar above.
  return (
    <div data-testid="canvas-view" className={`relative h-full overflow-hidden bg-background ${className ?? ''}`}>
      {/* Top left: the page's title card (board name, menu). */}
      {header && (
        <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] md:max-w-xs">
          {typeof header === 'function' ? header(boardActions) : header}
        </div>
      )}

      {/* The tools: top centre on wide screens, bottom centre (thumb reach) on phones. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-14 z-20 flex justify-center px-3 md:bottom-auto md:top-3 md:pl-[21rem] xl:pl-3">
        <div className="pointer-events-auto max-w-full">
          <CanvasToolbar
            disabled={!canWrite}
            activeTool={tool}
            style={style}
            hasSelection={!!selected}
            onToolChange={setTool}
            onStyleChange={changeStyle}
            onDelete={handleDelete}
            onUndo={undo}
            onRedo={redo}
          />
        </div>
      </div>

      {/* An empty board says how to start. */}
      {shapes.length === 0 && !draft && connected && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
          <p className="max-w-xs text-sm text-muted-foreground">
            {canWrite
              ? 'Pick a tool to start drawing, or double-click anywhere to write.'
              : 'Nothing on this board yet.'}
          </p>
        </div>
      )}

      {/* Writing in a text box or sticky note, right on the board. */}
      {editing && (
        <textarea
          data-testid="canvas-text-input"
          aria-label="Text"
          autoFocus
          value={editText}
          maxLength={TEXT_MAX}
          placeholder={editing.type === 'note' ? 'Write a note…' : 'Type here…'}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              finishEditing(false)
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              finishEditing(true)
            }
          }}
          className="absolute z-30 resize-none overflow-hidden rounded-sm bg-transparent outline-none ring-2 ring-primary/50 placeholder:text-muted-foreground/70"
          style={{
            left: view.x + editing.x * zoom,
            top: view.y + editing.y * zoom,
            width: editing.width * zoom,
            height:
              Math.max(editing.height, textHeight({ ...editing, props: { ...editing.props, text: editText } })) * zoom,
            padding: editingPad * zoom,
            fontSize: editingFont * zoom,
            lineHeight: LINE_HEIGHT,
            fontFamily: BOARD_FONT,
            color: editing.type === 'note' ? '#1f2937' : ((editing.props.stroke as string) ?? undefined),
          }}
        />
      )}

      {/* After "Clear board": one click puts everything back. */}
      {cleared && (
        <div
          role="status"
          data-testid="canvas-cleared"
          className="absolute inset-x-0 bottom-28 z-30 flex justify-center px-3 md:bottom-4"
        >
          <div className="flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-4 pr-1 text-sm shadow-lg">
            <span>
              Board cleared ({cleared.length} {cleared.length === 1 ? 'shape' : 'shapes'})
            </span>
            <button
              type="button"
              onClick={restoreCleared}
              data-testid="canvas-restore"
              className="ml-2 inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold text-primary-text hover:bg-primary/10"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Restore
            </button>
            <button
              type="button"
              onClick={() => setCleared(null)}
              aria-label="Dismiss"
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear the whole board?"
        description={`This removes ${current.length === 1 ? 'the 1 shape' : `all ${current.length} shapes`} for everyone in the space. You can restore them for a few seconds afterwards.`}
        confirmText="Clear board"
        onConfirm={clearBoard}
      />

      {/* Bottom left: connection status, quiet while connected. */}
      <div
        role="status"
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur"
      >
        <span
          className={`size-2 rounded-full ${connected ? 'bg-correct' : 'animate-pulse bg-warning'}`}
          aria-hidden="true"
        />
        {connected ? (canWrite ? 'Connected' : 'Connected · view only') : 'Connecting…'}
      </div>

      {/* Bottom right: download, zoom out / level (click to reset) / zoom in, fit. */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center rounded-full border border-border bg-card/90 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={downloadImage}
          disabled={shapes.length === 0}
          title="Download as image"
          aria-label="Download as image"
          data-testid="canvas-download"
          className={zoomButton}
        >
          <Download />
        </button>
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={() => zoomAt((z) => z / 1.2)}
          aria-label="Zoom out"
          title="Zoom out (−)"
          className={zoomButton}
        >
          <Minus />
        </button>
        <button
          type="button"
          onClick={() => zoomAt(() => 1)}
          title="Reset to 100% (0)"
          data-testid="canvas-zoom"
          className="min-w-12 px-1 text-xs tabular-nums text-muted-foreground hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomAt((z) => z * 1.2)}
          aria-label="Zoom in"
          title="Zoom in (+)"
          className={zoomButton}
        >
          <Plus />
        </button>
        <button
          type="button"
          onClick={fitToContent}
          title="Fit everything in view (Shift+1)"
          aria-label="Fit everything in view"
          data-testid="canvas-fit"
          className={zoomButton}
        >
          <Maximize />
        </button>
      </div>

      <svg
        ref={svgRef}
        data-testid="canvas-svg"
        aria-label={toolHint ? `Board, ${toolHint.label.toLowerCase()} tool` : 'Board'}
        className="h-full w-full select-none"
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Grid background */}
        <defs>
          <pattern
            id="grid"
            width={20 * zoom}
            height={20 * zoom}
            patternUnits="userSpaceOnUse"
            x={view.x % (20 * zoom)}
            y={view.y % (20 * zoom)}
          >
            <circle cx={1} cy={1} r={0.5} fill="currentColor" className="text-border" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Canvas content with pan/zoom transform */}
        <g transform={`translate(${view.x}, ${view.y}) scale(${zoom})`}>
          {/* Shapes only: this group is what "Download as image" draws. */}
          <g ref={contentRef}>
            {displayed.map((shape) => (
              <ShapeRenderer
                key={shape.id}
                shape={shape}
                editing={shape.id === editingId}
                faded={erasing.has(shape.id)}
              />
            ))}
          </g>

          {/* The shape being drawn */}
          {draft && <ShapeRenderer shape={draft} />}

          {/* Selection: a dashed box, and handles when it can be changed. */}
          {selected && (
            <g>
              {isSegment(selected.type) ? null : (
                <rect
                  {...(() => {
                    const b = boundsOf(selected)
                    return {
                      x: b.x - 4 / zoom,
                      y: b.y - 4 / zoom,
                      width: b.width + 8 / zoom,
                      height: b.height + 8 / zoom,
                    }
                  })()}
                  fill="none"
                  style={{ stroke: 'var(--color-primary)' }}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  rx={2 / zoom}
                  pointerEvents="none"
                />
              )}
              {canWrite &&
                !editingId &&
                tool === 'select' &&
                handlesFor(selected).map(({ handle, x, y }) => (
                  <rect
                    key={handle}
                    data-handle={handle}
                    data-testid={`handle-${handle}`}
                    x={x - 5 / zoom}
                    y={y - 5 / zoom}
                    width={10 / zoom}
                    height={10 / zoom}
                    rx={isSegment(selected.type) ? 5 / zoom : 2 / zoom}
                    style={{
                      fill: 'var(--color-card)',
                      stroke: 'var(--color-primary)',
                      cursor: HANDLE_CURSORS[handle],
                    }}
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            </g>
          )}

          {/* Other users' cursors */}
          {viewports.map((vp, i) => (
            <g key={vp.userId} pointerEvents="none">
              {/* Cursor dot */}
              <circle
                cx={vp.x + vp.width / 2}
                cy={vp.y + 20}
                r={4 / zoom}
                fill={CURSOR_COLORS[i % CURSOR_COLORS.length]}
              />
              {/* User label */}
              <text
                x={vp.x + vp.width / 2 + 8 / zoom}
                y={vp.y + 24 / zoom}
                fontSize={11 / zoom}
                fill={CURSOR_COLORS[i % CURSOR_COLORS.length]}
                fontFamily="system-ui, sans-serif"
              >
                {getName(vp.userId) ?? 'Member'}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
