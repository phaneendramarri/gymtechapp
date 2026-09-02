import * as React from "react"
import { cn } from "@/lib/utils"

interface SparklineProps {
  /** Series of numeric values; older first → newer last. */
  data: number[]
  /** Stroke colour. Defaults to current `text-primary`. */
  strokeClassName?: string
  /** Fill under the line. */
  fillClassName?: string
  /** SVG width in px. */
  width?: number
  /** SVG height in px. */
  height?: number
  className?: string
  /** Render a tiny end-point dot (good for the latest value). */
  showEndDot?: boolean
  /** Optional aria label for accessibility. */
  ariaLabel?: string
}

/**
 * A lightweight, dependency-free sparkline. Used on StatCards and KPI tiles.
 * It doesn't pull in recharts (faster to render in lists of 8-12 cards).
 */
export const Sparkline: React.FC<SparklineProps> = ({
  data,
  strokeClassName = "stroke-primary",
  fillClassName = "fill-primary/15",
  width = 96,
  height = 28,
  className,
  showEndDot = true,
  ariaLabel,
}) => {
  if (!data?.length) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : 0

  const points = data.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y] as const
  })

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ")

  const area = `${path} L${width},${height} L0,${height} Z`
  const [endX, endY] = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
    >
      <path d={area} className={cn(fillClassName)} />
      <path d={path} className={cn("fill-none", strokeClassName)} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {showEndDot && (
        <circle cx={endX} cy={endY} r={2.5} className={cn("fill-primary", strokeClassName)} />
      )}
    </svg>
  )
}

/**
 * Tiny delta pill that pairs well with a Sparkline.
 *
 *   <DeltaPill delta={12} />   //  +12% (up, green)
 *   <DeltaPill delta={-4} />   //  -4%  (down, red)
 */
export const DeltaPill: React.FC<{ delta: number; className?: string; suffix?: string }> = ({
  delta,
  className,
  suffix = "%",
}) => {
  const isUp = delta >= 0
  const Icon = isUp ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold",
        isUp ? "bg-ok/10 text-ok" : "bg-destructive/10 text-destructive",
        className
      )}
    >
      <Icon className="size-2.5" />
      {isUp ? "+" : ""}
      {delta}
      {suffix}
    </span>
  )
}

const TrendingUp: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 12 12" className={className} aria-hidden>
    <path d="M2 9l4-4 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 3h3v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const TrendingDown: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 12 12" className={className} aria-hidden>
    <path d="M2 3l4 4 2-2 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 9h3V6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
