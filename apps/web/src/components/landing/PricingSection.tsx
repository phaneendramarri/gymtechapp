import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface Plan {
  name: string;
  blurb: string;
  monthly: number;
  yearly: number;
  cta: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    blurb: 'For a single-floor gym, just getting online.',
    monthly: 1499,
    yearly: 14999,
    cta: 'Start free trial',
    features: [
      'Up to 100 active members',
      '3 staff logins',
      'QR + manual attendance',
      'Payments & dues tracker',
      'WhatsApp receipts',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    blurb: 'For a growing gym with trainers and renewals.',
    monthly: 3499,
    yearly: 34999,
    cta: 'Start free trial',
    highlight: true,
    features: [
      'Up to 500 active members',
      '10 staff logins',
      'Everything in Starter',
      'PT collections & commissions',
      'Advanced reports',
      'Excel / CSV export',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    blurb: 'For multi-branch operators and chains.',
    monthly: 7499,
    yearly: 74999,
    cta: 'Talk to us',
    features: [
      'Unlimited members',
      'Unlimited staff logins',
      'Everything in Pro',
      'Multi-branch tenants',
      'Custom API integrations',
      'Dedicated onboarding',
      '4-hour support SLA',
    ],
  },
];

const fmtRupees = (n: number) => '\u20B9' + n.toLocaleString('en-IN');

export const PricingSection: React.FC = () => {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-28 sm:py-40 border-t border-(--line) bg-(--bg)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeUp(0)} className="max-w-2xl mx-auto text-center mb-16">
          <p className="gt-kicker">Pricing</p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            Simple, honest pricing.
          </h2>
          <p className="text-body text-ink-2 mt-4">
            No seat fees. No surprise overages. One price per gym, every month.
          </p>

          {/* Toggle */}
          <motion.div {...fadeUp(0.08)} className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm font-medium transition-colors ${!yearly ? 'text-ink' : 'text-ink-3'}`}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={yearly}
              onClick={() => setYearly(!yearly)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-(--line)"
            >
              <span
                className={`inline-block size-4 rounded-full bg-(--surface) shadow-sm transition-transform ${
                  yearly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${yearly ? 'text-ink' : 'text-ink-3'}`}>
              Yearly
            </span>
            <span className="ml-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-(--positive-soft) text-(--positive)">
              Save 2 months
            </span>
          </motion.div>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {PLANS.map((p, idx) => (
            <motion.div
              key={p.name}
              {...fadeUp(idx * 0.07)}
              className={`relative flex flex-col rounded-2xl border p-8 transition-shadow duration-300 hover:shadow-lg ${
                p.highlight
                  ? 'border-(--iron) bg-(--bg) shadow-[0_0_0_1px_var(--iron),0_8px_32px_rgba(217,72,15,0.10)]'
                  : 'border-(--line) bg-(--surface) hover:border-(--ink-3)'
              }`}
            >
              {/* Highlighted badge */}
              {p.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold font-mono px-3 py-1 rounded-full bg-(--iron) text-white shadow-sm">
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    Most popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <h3 className="text-h3 text-ink">{p.name}</h3>
                <p className="text-[13px] text-ink-3 mt-1.5 leading-relaxed">{p.blurb}</p>
              </div>

              {/* Price */}
              <div className="mb-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-price text-ink num">
                    {fmtRupees(yearly ? p.yearly : p.monthly)}
                  </span>
                  <span className="text-[13px] text-ink-3">
                    /{yearly ? 'yr' : 'mo'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-3 mt-0.5">
                  {yearly ? 'Billed annually' : 'Billed monthly · cancel anytime'}
                </p>
              </div>

              {/* CTA */}
              <Button
                asChild
                className={`mt-6 h-11 gap-2 rounded-xl font-semibold text-[14px] transition-all ${
                  p.highlight
                    ? 'bg-(--iron) hover:bg-(--iron-hover) text-white shadow-[0_4px_16px_rgba(217,72,15,0.25)] hover:shadow-[0_6px_24px_rgba(217,72,15,0.35)] active:scale-[0.98]'
                    : 'bg-(--surface-2) hover:bg-(--ink) text-ink hover:text-(--ink-inverse) border border-(--line)'
                }`}
              >
                <a href="/login">
                  {p.cta}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>

              {/* Divider */}
              <div className="my-7 border-t border-(--line)" />

              {/* Features */}
              <ul className="flex flex-col gap-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <span className={`shrink-0 mt-0.5 rounded-full p-0.5 ${p.highlight ? 'bg-(--iron-soft)' : 'bg-(--positive-soft)'}`}>
                      <Check
                        className={`h-3 w-3 ${p.highlight ? 'text-(--iron)' : 'text-(--positive)'}`}
                        strokeWidth={2.5}
                      />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-12 text-center text-[13px] text-ink-3">
          All prices in INR, exclusive of GST.{' '}
          <a href="/contact" className="text-ink underline underline-offset-2 hover:text-(--iron) transition-colors">
            Need a custom plan?
          </a>
        </p>
      </div>
    </section>
  );
};
