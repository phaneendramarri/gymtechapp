import React from "react"

const LOGOS = [
  "Iron Paradise",
  "Pulse Studio",
  "Flex Cult",
  "Core Movement",
  "Apex Athletics",
  "The Strength Co.",
  "Vibe Fitness",
  "North Star Gym",
  "Rhythm Box",
  "Bold Body",
]

/**
 * Pure-CSS infinite logo marquee (Phase 7.1). Pauses on hover, gradient-mask
 * edges so logos fade in/out. Respects `prefers-reduced-motion` via the
 * global rule in `index.css`.
 */
export const LandingLogoMarquee: React.FC = () => {
  return (
    <section className="py-10 sm:py-14 border-y border-border/40 bg-card/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <p className="text-center text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Trusted by 200+ gyms across India
        </p>

        <div
          className="relative mt-6 overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0, black 8%, black 92%, transparent 100%)",
            maskImage:
              "linear-gradient(90deg, transparent 0, black 8%, black 92%, transparent 100%)",
          }}
        >
          <div className="animate-marquee">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-10 px-5" aria-hidden={dup === 1}>
                {LOGOS.map((name) => (
                  <div
                    key={`${dup}-${name}`}
                    className="flex items-center gap-2 text-muted-foreground/80 hover:text-foreground transition-colors"
                  >
                    <span className="size-2 rounded-full bg-primary/60" />
                    <span className="text-sm font-display font-semibold whitespace-nowrap">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
