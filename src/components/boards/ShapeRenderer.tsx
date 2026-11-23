/**
 * ShapeRenderer — draws one board shape as SVG: rect, ellipse, line, arrow,
 * pen stroke (`path`), text box and sticky note. Plain SVG only (no
 * foreignObject), so the board can be exported as an image.
 *
 * Every shape's group carries `data-shape-id`, which the canvas uses to
 * tell what was pressed. Thin shapes get a wide invisible stroke to press.
 */

import { memo } from 'react'
import type { CanvasShapeClient } from 'deepspace'
import {
  arrowHeadPath,
  BOARD_FONT,
  DEFAULT_STROKE_WIDTH,
  fontSizeOf,
  isSegment,
  LINE_HEIGHT,
  NOTE_PADDING,
  penPathData,
  TEXT_PADDING,
  tint,
  wrapText,
} from '@/lib/canvas-shapes'

/** What the renderer needs; a shape being drawn has no id or timestamps yet. */
export type DrawnShape = Pick<CanvasShapeClient, 'type' | 'x' | 'y' | 'width' | 'height' | 'props'> & { id?: string }

/** Wide enough to grab a thin line with a finger. */
const HIT_WIDTH = 14

function Lines({ shape, padding, center }: { shape: DrawnShape; padding: number; center: boolean }) {
  const fontSize = fontSizeOf(shape)
  const stroke = (shape.props.stroke as string) ?? '#6366f1'
  const lines = wrapText(String(shape.props.text ?? ''), shape.width - padding * 2, fontSize)
  const lineHeight = fontSize * LINE_HEIGHT
  // Text boxes centre their lines vertically (as mind-map nodes always have); notes start at the top.
  const top = center
    ? shape.y + shape.height / 2 - ((lines.length - 1) * lineHeight) / 2
    : shape.y + padding + lineHeight / 2
  return (
    <text fill={stroke} fontSize={fontSize} fontFamily={BOARD_FONT} pointerEvents="none">
      {lines.map((line, i) => (
        <tspan key={i} x={shape.x + padding} y={top + i * lineHeight} dominantBaseline="central">
          {line || ' '}
        </tspan>
      ))}
    </text>
  )
}

export const ShapeRenderer = memo(function ShapeRenderer({
  shape,
  editing,
  faded,
}: {
  shape: DrawnShape
  editing?: boolean
  /** Under the eraser: about to be removed. */
  faded?: boolean
}) {
  const stroke = (shape.props.stroke as string) ?? '#6366f1'
  const strokeWidth = (shape.props.strokeWidth as number) ?? DEFAULT_STROKE_WIDTH
  const fill = (shape.props.fill as string) ?? 'transparent'

  let body: React.ReactNode = null
  switch (shape.type) {
    case 'rect':
      body = (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          rx={6}
        />
      )
      break
    case 'ellipse':
      body = (
        <ellipse
          cx={shape.x + shape.width / 2}
          cy={shape.y + shape.height / 2}
          rx={shape.width / 2}
          ry={shape.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )
      break
    case 'line':
    case 'arrow': {
      const d = `M${shape.x} ${shape.y}L${shape.x + shape.width} ${shape.y + shape.height}`
      body = (
        <>
          <path d={d} stroke="transparent" strokeWidth={HIT_WIDTH} />
          <path d={d} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          {shape.type === 'arrow' && (
            <path
              d={arrowHeadPath(shape, strokeWidth)}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </>
      )
      break
    }
    case 'path': {
      const points = (shape.props.points as number[]) ?? []
      const w0 = (shape.props.w0 as number) || 1
      const h0 = (shape.props.h0 as number) || 1
      const d = penPathData(points)
      // Drawn at w0 × h0; scaled to the current box. The stroke keeps its width.
      body = (
        <g transform={`translate(${shape.x} ${shape.y}) scale(${shape.width / w0} ${shape.height / h0})`}>
          <path d={d} stroke="transparent" strokeWidth={HIT_WIDTH} fill="none" vectorEffect="non-scaling-stroke" />
          <path
            d={d}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )
      break
    }
    case 'text':
      body = (
        <>
          <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={fill} rx={4} />
          {!editing && <Lines shape={shape} padding={TEXT_PADDING} center />}
        </>
      )
      break
    case 'note':
      body = (
        <>
          {/* A soft shadow, then the paper: an opaque base so the board's grid doesn't show through. */}
          <rect x={shape.x + 2} y={shape.y + 4} width={shape.width} height={shape.height} rx={6} fill="#0f172a14" />
          <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={6} fill="#fffdf5" />
          <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={6} fill={tint(stroke)} />
          {!editing && (
            <Lines
              shape={{ ...shape, props: { ...shape.props, stroke: '#1f2937' } }}
              padding={NOTE_PADDING}
              center={false}
            />
          )}
        </>
      )
      break
  }

  return (
    <g
      data-shape-id={shape.id}
      data-testid={shape.id ? `shape-${shape.id}` : undefined}
      data-kind={shape.type}
      opacity={faded ? 0.25 : undefined}
      style={{ cursor: shape.id ? 'move' : undefined }}
      pointerEvents={shape.id ? (isSegment(shape.type) || shape.type === 'path' ? 'stroke' : 'visiblePainted') : 'none'}
    >
      {body}
    </g>
  )
})
