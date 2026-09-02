import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroProductDemo } from '@/components/landing/HeroProductDemo';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export const HeroSection: React.FC = () => {
  return (
    <section className="relative pt-12 sm:pt-16 pb-20 sm:pb-28 bg-[var(--bg)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Kicker */}
        <motion.div {...fadeUp(0)} className="flex items-center justify-center mb-6">
          <span className="gt-kicker">
            <span className="size-1.5 rounded-full bg-[var(--iron)]" />
            Built for gyms across India
          </span>
        </motion.div>

        {/* Headline — Inter for body, Fraunces for the italic emphasis. */}
        <motion.h1
          {...fadeUp(0.05)}
          className="font-display text-center text-[40px] sm:text-6xl lg:text-7xl font-semibold tracking-[-0.025em] leading-[1.05] text-ink max-w-4xl mx-auto"
        >
          The gym management software that <span className="text-italic-accent">actually</span> gets used.
        </motion.h1>

        {/* Subhead — product truth, not marketing-speak. */}
        <motion.p
          {...fadeUp(0.1)}
          className="text-center text-base sm:text-lg text-ink-2 max-w-2xl mx-auto leading-relaxed mt-6"
        >
          Members, payments, attendance, GST invoices, and PT commissions — in one place your staff will actually open every morning.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp(0.15)}
          className="flex flex-wrap items-center justify-center gap-3 mt-8"
        >
          <Button
            asChild
            size="lg"
            className="bg-[var(--ink)] text-[var(--ink-inverse)] hover:bg-[var(--ink-2)] border-[var(--ink)] font-medium h-11 px-6 gap-2 rounded-lg"
          >
            <a href="#/login">
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-6 font-medium text-sm border-[var(--line)] hover:bg-[var(--surface-2)] rounded-lg"
          >
            <a href="#product">See the product</a>
          </Button>
        </motion.div>

        {/* One-line trust strip — three real, concrete promises. */}
        <motion.div
          {...fadeUp(0.2)}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-[12px] text-ink-3"
        >
          {[
            'No credit card',
            'Free Excel member import',
            'Set up in under 30 minutes',
          ].map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-[var(--positive)]" />
              <span>{p}</span>
            </span>
          ))}
        </motion.div>

        {/* Product demo — single, focused, no fake mesh glow. */}
        <motion.div
          {...fadeUp(0.3)}
          className="mt-16 sm:mt-20 max-w-5xl mx-auto"
        >
          <HeroProductDemo />
        </motion.div>
      </div>
    </section>
  );
};
