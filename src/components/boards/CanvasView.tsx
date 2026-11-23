/**
 * CanvasView — SVG canvas with shape rendering, mouse interaction, zoom/pan,
 * and multi-user cursors. From DeepSpace's canvas feature, adapted for
 * study-space boards (docs/features.md F15): members' names on cursors,
 * editing a text box's words, read-only when the socket can't write, an
 * initial centre, and drawing a generated mind map once (`drawOnce`).
 */

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { useCanvas, useUserLookup } from 'deepspace'
import type { LaidOutShape } from '@/lib/mindmap'
import { CanvasToolbar, type CanvasTool } from './CanvasToolbar'
import { ShapeRenderer } from './ShapeRenderer'
import { Minus, Plus } from 'lucide-react'

interface CanvasViewProps {
  docId: string
  className?: string
  /** Canvas point to centre in view on first render. */
  center?: { x: number; y: number }
  /** Shapes to add once, on an empty canvas this client can write to (a generated mind map). */
  drawOnce?: LaidOutShape[]
  onDrawn?: () => void
  /** The page's title card, floated top left over the board. */
  header?: ReactNode
}

interface DragState {
  type: 'create' | 'move'
  startX: number
  startY: number
  shapeId?: string
  originalX?: number
  originalY?: number
}

// User colors for multi-user cursors
const CURSOR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']

export function CanvasView({ docId, className, center, drawOnce, onDrawn, header }: CanvasViewProps) {
  const {
    shapes,
    viewports,
    connected,
    canWrite,
    addShape,
    updateShape,
    moveShape,
    deleteShape,
    setViewport,
    undo,
    redo,
  } = useCanvas(docId)

  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [activeColor, setActiveColor] = useState('#6366f1')
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })

  const svgRef = useRef<SVGSVGElement>(null)
  const { getName } = useUserLookup()
  const drawn = useRef(false)
  const centred = useRef(false)

  // Centre the requested point once the canvas has a size.
  useEffect(() => {
    const svg = svgRef.current
    if (!center || centred.current || !svg) return
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return
    centred.current = true
    setPan({ x: rect.width / 2 - center.x * zoom, y: rect.height / 2 - center.y * zoom })
  }, [center, zoom])

  // Draw a generated mind map once: only on an empty board, only if we can write.
  useEffect(() => {
    if (!drawOnce || drawn.current || !connected || !canWrite) return
    drawn.current = true
    if (shapes.length === 0) for (const shape of drawOnce) addShape(shape)
    onDrawn?.()
  }, [drawOnce, connected, canWrite, shapes.length, addShape, onDrawn])

  const selectedShape = shapes.find((s) => s.id === selectedShapeId)

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      }
    },
    [pan, zoom],
  )

  // Report viewport on pan/zoom change
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setViewport({
      x: -pan.x / zoom,
      y: -pan.y / zoom,
      width: rect.width / zoom,
      height: rect.height / zoom,
      zoom,
    })
  }, [pan, zoom, setViewport])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedShapeId && document.activeElement === document.body) {
          e.preventDefault()
          deleteShape(selectedShapeId)
          setSelectedShapeId(null)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedShapeId, deleteShape, undo, redo])

  // Mouse down on SVG background
  const handleSvgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse button or space+click for panning
      if (e.button === 1) {
        e.preventDefault()
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y })
        return
      }

      if (e.button !== 0) return

      const pos = screenToCanvas(e.clientX, e.clientY)

      if (activeTool === 'select') {
        // Deselect when clicking background
        setSelectedShapeId(null)
        // Start panning
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y })
        return
      }

      // Start creating a shape
      setDragState({
        type: 'create',
        startX: pos.x,
        startY: pos.y,
      })
    },
    [activeTool, screenToCanvas, pan],
  )

  // Mouse down on a shape
  const handleShapeMouseDown = useCallback(
    (e: React.MouseEvent, shapeId: string) => {
      if (activeTool !== 'select') return

      const shape = shapes.find((s) => s.id === shapeId)
      if (!shape) return

      setSelectedShapeId(shapeId)
      setDragState({
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        shapeId,
        originalX: shape.x,
        originalY: shape.y,
      })
    },
    [activeTool, shapes],
  )

  // Mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: panStart.panX + (e.clientX - panStart.x),
          y: panStart.panY + (e.clientY - panStart.y),
        })
        return
      }

      if (!dragState) return

      if (dragState.type === 'move' && dragState.shapeId) {
        const dx = (e.clientX - dragState.startX) / zoom
        const dy = (e.clientY - dragState.startY) / zoom
        moveShape(dragState.shapeId, dragState.originalX! + dx, dragState.originalY! + dy)
      }
    },
    [dragState, isPanning, panStart, zoom, moveShape],
  )

  // Mouse up
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false)
        return
      }

      if (!dragState) return

      if (dragState.type === 'create') {
        const pos = screenToCanvas(e.clientX, e.clientY)
        const x = Math.min(dragState.startX, pos.x)
        const y = Math.min(dragState.startY, pos.y)
        const width = Math.max(Math.abs(pos.x - dragState.startX), 20)
        const height = Math.max(Math.abs(pos.y - dragState.startY), 20)

        addShape({
          type: activeTool,
          x,
          y,
          width,
          height,
          props: {
            stroke: activeColor,
            fill: 'transparent',
            ...(activeTool === 'text' ? { text: 'Text' } : {}),
          },
        })

        // Switch back to select after creating
        setActiveTool('select')
      }

      setDragState(null)
    },
    [dragState, isPanning, screenToCanvas, activeTool, activeColor, addShape],
  )

  // Wheel for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 5)

      // Zoom towards mouse position
      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
      })
      setZoom(newZoom)
    },
    [zoom, pan],
  )

  const handleDelete = useCallback(() => {
    if (selectedShapeId) {
      deleteShape(selectedShapeId)
      setSelectedShapeId(null)
    }
  }, [selectedShapeId, deleteShape])

  // Zoom buttons: zoom around the middle of the view, like the wheel does around the mouse.
  const zoomTo = useCallback(
    (next: number) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const newZoom = Math.min(Math.max(next, 0.1), 5)
      const cx = rect.width / 2
      const cy = rect.height / 2
      setPan({ x: cx - (cx - pan.x) * (newZoom / zoom), y: cy - (cy - pan.y) * (newZoom / zoom) })
      setZoom(newZoom)
    },
    [zoom, pan],
  )

  // The board fills the space; everything else floats over it (title card,
  // toolbar, status, zoom), so the page has one bar: the space bar above.
  return (
    <div data-testid="canvas-view" className={`relative h-full overflow-hidden bg-background ${className ?? ''}`}>
      {/* Top left: the page's title card (board name, menu). */}
      {header && <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] md:max-w-xs">{header}</div>}

      {/* The tools: top centre on wide screens, bottom centre (thumb reach) on phones. */}
      <div className="absolute inset-x-0 bottom-14 z-20 flex justify-center px-3 md:bottom-auto md:top-3 md:pl-[21rem] lg:pl-0">
        <CanvasToolbar
          disabled={!canWrite}
          activeTool={activeTool}
          activeColor={activeColor}
          hasSelection={selectedShapeId !== null}
          onToolChange={setActiveTool}
          onColorChange={setActiveColor}
          onDelete={handleDelete}
          onUndo={undo}
          onRedo={redo}
        />
      </div>

      {/* Edit the selected text box's words, just under the tools. */}
      {selectedShape?.type === 'text' && canWrite && (
        <div className="absolute inset-x-0 top-[4.25rem] z-20 flex justify-center px-3 max-md:top-auto max-md:bottom-28">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
            <label htmlFor="canvas-text" className="px-1 text-xs font-medium text-muted-foreground">
              Text
            </label>
            <input
              id="canvas-text"
              data-testid="canvas-text-input"
              key={selectedShape.id}
              defaultValue={(selectedShape.props.text as string) ?? ''}
              maxLength={80}
              onChange={(e) => updateShape(selectedShape.id, { ...selectedShape.props, text: e.target.value })}
              className="w-56 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Bottom left: connection status, quiet while connected. */}
      <div
        role="status"
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur"
      >
        <span
          className={`size-2 rounded-full ${connected ? 'bg-correct' : 'animate-pulse bg-warning'}`}
          aria-hidden="true"
        />
        {connected ? 'Connected' : 'Connecting…'}
      </div>

      {/* Bottom right: zoom out, the level (click to reset), zoom in. */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center rounded-full border border-border bg-card/90 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoomTo(zoom / 1.2)}
          aria-label="Zoom out"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomTo(1)}
          title="Reset to 100%"
          data-testid="canvas-zoom"
          className="min-w-12 px-1 text-xs tabular-nums text-muted-foreground hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomTo(zoom * 1.2)}
          aria-label="Zoom in"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <svg
        ref={svgRef}
        data-testid="canvas-svg"
        className="w-full h-full"
        style={{
          cursor: activeTool === 'select' ? (isPanning ? 'grabbing' : 'default') : 'crosshair',
        }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid background */}
        <defs>
          <pattern
            id="grid"
            width={20 * zoom}
            height={20 * zoom}
            patternUnits="userSpaceOnUse"
            x={pan.x % (20 * zoom)}
            y={pan.y % (20 * zoom)}
          >
            <circle cx={1} cy={1} r={0.5} fill="currentColor" className="text-border" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Canvas content with pan/zoom transform */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Shapes */}
          {shapes.map((shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              isSelected={shape.id === selectedShapeId}
              onMouseDown={handleShapeMouseDown}
            />
          ))}

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

        {/* Drag preview for shape creation */}
        {dragState?.type === 'create' && (
          <rect
            x={0}
            y={0}
            width={0}
            height={0}
            fill="transparent"
            stroke={activeColor}
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
            style={{ display: 'none' }}
          />
        )}
      </svg>
    </div>
  )
}
