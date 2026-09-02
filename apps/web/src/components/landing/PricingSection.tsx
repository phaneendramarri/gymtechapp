import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
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
    cta: 'Start with Starter',
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
    blurb: 'For a busy gym with trainers and renewals.',
    monthly: 3499,
    yearly: 34999,
    cta: 'Choose Pro',
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

const fmtRupees = (n: number) => '₹' + n.toLocaleString('en-IN');

export const PricingSection: React.FC = () => {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-24 sm:py-32 border-t border-(--line) bg-(--surface)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp(0)} className="max-w-2xl mx-auto text-center mb-10">
          <p className="gt-kicker">Pricing</p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            Simple, per-gym pricing.
          </h2>
          <p className="text-body text-ink-2 mt-4">
            All plans include the owner dashboard, QR attendance, and WhatsApp receipts. No setup fees, ever.
          </p>
        </motion.div>

        {/* Toggle */}
        <motion.div {...fadeUp(0.05)} className="flex items-center justify-center mb-10">
          <div
            role="tablist"
            aria-label="Billing period"
            className="inline-flex items-center gap-1 p-1 bg-(--surface-2) border border-(--line) rounded-lg"
          >
            {(['monthly', 'yearly'] as const).map((v) => {
              const active = (v === 'yearly') === yearly;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setYearly(v === 'yearly')}
                  className={
                    'px-3.5 h-8 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 ' +
                    (active
                      ? 'bg-(--ink) text-(--ink-inverse)'
                      : 'text-ink-2 hover:text-ink')
                  }
                >
                  {v === 'monthly' ? 'Monthly' : 'Yearly'}
                  {v === 'yearly' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-(--positive-soft) text-(--positive)">
                      Save 2 months
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-(--line) border border-(--line) rounded-2xl overflow-hidden">
          {PLANS.map((p, idx) => (
            <motion.div
              key={p.name}
              {...fadeUp(idx * 0.05)}
              className={
                'p-8 flex flex-col bg-(--surface) ' +
                (p.highlight ? 'bg-(--bg)' : '')
              }
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-h3 text-ink">{p.name}</h3>
                {p.highlight && (
                  <span className="gt-tag" data-tone="iron">Most popular</span>
                )}
              </div>
              <p className="text-[13px] text-ink-3 leading-relaxed min-h-[3em]">{p.blurb}</p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-display-serif-sm text-ink num">
                  {fmtRupees(yearly ? p.yearly : p.monthly)}
                </span>
                <span className="text-[12px] text-ink-3">
                  /{yearly ? 'year' : 'month'}
                </span>
              </div>
              <p className="text-[11px] text-ink-3 mt-1">
                {yearly ? 'Billed annually' : 'Billed monthly · cancel anytime'}
              </p>

              <Button
                asChild
                className={
                  'mt-6 h-10 gap-1.5 rounded-lg font-medium ' +
                  (p.highlight
                    ? 'bg-(--iron) hover:bg-(--iron-hover) text-white border-transparent shadow-sm'
                    : 'bg-(--surface) text-ink hover:bg-(--surface-2) border-(--line)')
                }
              >
                <a href="/login">
                  {p.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </Button>

              <ul className="mt-7 flex flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-ink-2">
                    <Check className="h-3.5 w-3.5 text-(--positive) shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="mt-6 text-center text-[12px] text-ink-3">
          All prices in INR, exclusive of GST. Need a custom plan? <a href="/contact" className="text-ink underline underline-offset-2">Talk to us</a>.
        </p>
      </div>
    </section>
  );
};
