import React, { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Quote, Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Testimonial {
  quote: string
  name: string
  role: string
  gym: string
  initials: string
  /** Hash used for a deterministic colour so avatars feel varied. */
  hue: number
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I run a 280-member studio in Andheri. GymTech cut my daily admin in half — WhatsApp renewals alone saved me 2 hours every evening.",
    name: "Priya Sharma",
    role: "Studio Owner",
    gym: "Pulse Studio",
    initials: "PS",
    hue: 160,
  },
  {
    quote:
      "The QR check-in replaced three clipboards. Members love that they can see their own attendance on the portal — it actually makes them come back.",
    name: "Karan Mehta",
    role: "Founder",
    gym: "Iron Paradise",
    initials: "KM",
    hue: 210,
  },
  {
    quote:
      "Renewal recovery is a different game now. The system flags who's at risk and we just hit send. Our renewal rate went from 64% to 81% in 4 months.",
    name: "Rohit Iyer",
    role: "GM",
    gym: "Core Movement",
    initials: "RI",
    hue: 30,
  },
  {
    quote:
      "Honestly the cleanest gym software I've used. I switched from a 6-tool stack to just GymTech and haven't looked back.",
    name: "Aarav Khanna",
    role: "Operations Lead",
    gym: "Apex Athletics",
    initials: "AK",
    hue: 280,
  },
  {
    quote:
      "Setup took an afternoon. My accountant uses the reports page every Monday. It paid for itself in the first month.",
    name: "Nisha Patel",
    role: "Co-owner",
    gym: "The Strength Co.",
    initials: "NP",
    hue: 340,
  },
  {
    quote:
      "I was skeptical about another SaaS but the WhatsApp receipts alone make it worth it. Members tip better when they get a proper receipt.",
    name: "Vikram Desai",
    role: "Owner-trainer",
    gym: "Vibe Fitness",
    initials: "VD",
    hue: 190,
  },
]

export const LandingTestimonials: React.FC = () => {
  const prefersReducedMotion = useReducedMotion()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) return
    const id = setInterval(() => setI((v) => (v + 1) % TESTIMONIALS.length), 5500)
    return () => clearInterval(id)
  }, [prefersReducedMotion])

  const t = TESTIMONIALS[i]

  return (
    <section className="py-20 border-t border-(--line) bg-(--surface-2)/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Loved by operators
          </p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            What gym owners say
          </h2>
        </div>

        <div className="relative min-h-55">
          <AnimatePresence mode="wait">
            <motion.div
              key={t.name}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="border-(--line) shadow-sm bg-(--surface)">
                <CardContent className="p-6 sm:p-8">
                  <Quote className="size-6 text-(--iron)/40" />
                  <p className="mt-3 text-base sm:text-lg leading-relaxed text-ink text-balance">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div
                      className="size-10 rounded-full flex items-center justify-center font-display text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: `hsl(${t.hue} 55% 45%)` }}
                      aria-hidden
                    >
                      {t.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{t.name}</p>
                      <p className="text-xs text-ink-3 font-mono">
                        {t.role} · {t.gym}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-0.5 text-(--warning)">
                      {[0, 1, 2, 3, 4].map((n) => (
                        <Star key={n} className="size-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {TESTIMONIALS.map((tt, idx) => (
            <button
              key={tt.name}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Show testimonial from ${tt.name}`}
              className={cn(
                "size-2 rounded-full transition-all",
                idx === i ? "bg-(--iron) w-6" : "bg-(--ink-3)/30 hover:bg-(--ink-3)/60"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
