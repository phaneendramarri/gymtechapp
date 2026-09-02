import * as React from "react"
import { cn } from "@/lib/utils"

interface IllustrationProps {
  className?: string
  /** When true, applies a soft primary tint to the highlights. */
  tinted?: boolean
}

/**
 * Inline-SVG illustrations used by `EmptyState`. Each is monochrome and
 * uses `currentColor` so the parent can theme it.
 */

export const EmptyMembersIllustration: React.FC<IllustrationProps> = ({ className, tinted = true }) => (
  <svg viewBox="0 0 200 140" className={cn("text-muted-foreground", className)} aria-hidden>
    <defs>
      <linearGradient id="emp-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.06" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
      </linearGradient>
    </defs>
    <rect x="20" y="24" width="160" height="92" rx="10" fill="url(#emp-bg)" />
    <circle cx="62" cy="58" r="14" fill="currentColor" opacity="0.3" />
    <path d="M44 92 Q44 76 62 76 Q80 76 80 92" fill="currentColor" opacity="0.3" />
    <circle cx="106" cy="58" r="14" fill="currentColor" opacity="0.5" />
    <path d="M88 92 Q88 76 106 76 Q124 76 124 92" fill={tinted ? "var(--primary)" : "currentColor"} opacity={tinted ? 0.7 : 0.5} />
    <circle cx="150" cy="58" r="14" fill="currentColor" opacity="0.3" strokeDasharray="2 2" />
    <path d="M132 92 Q132 76 150 76 Q168 76 168 92" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeDasharray="3 3" />
    <line x1="38" y1="108" x2="162" y2="108" stroke="currentColor" strokeOpacity="0.2" />
  </svg>
)

export const EmptyPaymentsIllustration: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 140" className={cn("text-muted-foreground", className)} aria-hidden>
    <rect x="40" y="34" width="120" height="72" rx="6" fill="currentColor" opacity="0.08" />
    <rect x="40" y="34" width="120" height="14" fill="currentColor" opacity="0.18" />
    <line x1="52" y1="62" x2="100" y2="62" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
    <line x1="52" y1="74" x2="84" y2="74" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
    <line x1="52" y1="86" x2="120" y2="86" stroke="var(--primary)" strokeOpacity="0.7" strokeWidth="2.5" />
    <circle cx="148" cy="98" r="6" fill="var(--primary)" opacity="0.7" />
  </svg>
)

/** A short "how to get started" hint rendered below an empty state CTA. */
export interface OnboardingStep {
  n: number
  label: string
}
export const OnboardingHints: React.FC<{ steps: OnboardingStep[]; className?: string }> = ({
  steps,
  className,
}) => (
  <ol className={cn("mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-mono text-muted-foreground", className)}>
    {steps.map((s, i) => (
      <li key={s.n} className="inline-flex items-center gap-1.5">
        <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
          {s.n}
        </span>
        <span>{s.label}</span>
        {i < steps.length - 1 && <span className="text-muted-foreground/40">→</span>}
      </li>
    ))}
  </ol>
)
