import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Dumbbell, Zap, Flame, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroProductDemo } from '@/components/landing/HeroProductDemo';

/* ─── Animation helpers ─── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const TRUST_ITEMS = [
  'No credit card required',
  'Setup in under 30 min',
  'Free member import',
];

const GYM_LIVE_HIGHLIGHTS = [
  { icon: Zap, label: '0.8s QR & Face Turnstile Pass' },
  { icon: Dumbbell, label: 'Live Workout & PT Quota Tracking' },
  { icon: Flame, label: 'Automated WhatsApp Renewals' },
];

export const HeroSection: React.FC = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden">

      {/* ── Layered background depth ── */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(251,146,60,0.13) 0%, transparent 65%)',
          }}
        />
        <div
          style={{
            background:
              'radial-gradient(ellipse 50% 60% at 85% 30%, rgba(251,146,60,0.07) 0%, transparent 60%)',
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      {/* ── Eyebrow ── */}
      <motion.div {...fadeUp(0)} className="relative mb-6">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-[11px] font-mono font-bold text-orange-500 tracking-wide shadow-xs">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-orange-500" />
          </span>
          #1 GYM MANAGEMENT SAAS · BUILT FOR HIGH-VOLUME INDIAN GYMS
        </span>
      </motion.div>

      {/* ── Headline ── */}
      <motion.div {...fadeUp(0.08)} className="relative text-center max-w-4xl mx-auto px-4">
        <h1
          className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02] text-ink"
          style={{ letterSpacing: '-0.025em' }}
        >
          The Gym Management SaaS that{' '}
          <span style={{ color: 'var(--iron)' }}>runs your gym</span>.
          <br />
          Not another spreadsheet to ignore.
        </h1>
      </motion.div>

      {/* ── Sub-headline ── */}
      <motion.p
        {...fadeUp(0.16)}
        className="relative text-center text-base sm:text-lg text-ink-2 max-w-2xl mx-auto leading-relaxed mt-6 px-4"
      >
        Biometric turnstiles, automated WhatsApp fee renewals, 18% GST invoices, personal training quotas, and member self-service passes —
        all in one unified cloud operating system your staff will actually open every morning.
      </motion.p>

      {/* ── Real Gym Live Activity Strip ── */}
      <motion.div
        {...fadeUp(0.20)}
        className="relative flex flex-wrap items-center justify-center gap-3 mt-6 px-4"
      >
        {GYM_LIVE_HIGHLIGHTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2/80 border border-border text-xs font-medium text-ink shadow-xs backdrop-blur-sm"
            >
              <span className="size-5 rounded-full bg-orange-500/15 text-orange-500 flex items-center justify-center">
                <Icon className="size-3" />
              </span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </motion.div>

      {/* ── CTAs ── */}
      <motion.div
        {...fadeUp(0.24)}
        className="relative flex flex-wrap items-center justify-center gap-3 mt-9"
      >
        <Button
          asChild
          size="lg"
          className="h-12 px-7 gap-2 rounded-full font-semibold text-sm"
          style={{
            backgroundColor: 'var(--iron)',
            color: 'var(--iron-ink)',
            boxShadow: '0 8px 32px rgba(251,146,60,0.25)',
          }}
        >
          <a href="/contact">
            Start free — email us to begin
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-12 px-6 font-medium text-sm rounded-full border-line hover:bg-surface-2"
        >
          <a href="#product">See the product</a>
        </Button>
      </motion.div>

      {/* ── Trust strip ── */}
      <motion.div
        {...fadeUp(0.3)}
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-7"
      >
        {TRUST_ITEMS.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
            <Check className="h-3.5 w-3.5 text-iron" strokeWidth={2.5} />
            {item}
          </span>
        ))}
      </motion.div>

      {/* ── Interactive Management Platform Demo ── */}
      <motion.div
        {...fadeUp(0.35)}
        className="relative w-full max-w-5xl mx-auto mt-12 px-4 flex justify-center"
      >
        <HeroProductDemo />
      </motion.div>

    </section>
  );
};
