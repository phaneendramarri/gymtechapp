import React from 'react';
import { motion } from 'framer-motion';
import { Settings, FileSpreadsheet, Zap, ArrowRight } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const STEPS = [
  {
    n: '01',
    title: 'Set up your gym & plans',
    desc: 'Membership tiers, admission fees, and staff logins. Under 2 minutes.',
    icon: Settings,
  },
  {
    n: '02',
    title: 'Import your existing members',
    desc: 'Upload your Excel register. Active package dates and phone numbers carry over cleanly.',
    icon: FileSpreadsheet,
  },
  {
    n: '03',
    title: 'Open the desk and go live',
    desc: 'QR check-ins, fee receipts on WhatsApp, and daily reports — instant.',
    icon: Zap,
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 bg-(--bg) border-t border-(--line)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp(0)} className="max-w-2xl mx-auto text-center mb-14">
          <p className="gt-kicker">Day 1, ready by 6 PM</p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            Onboarded in an afternoon.
          </h2>
          <p className="text-body text-ink-2 mt-4">
            No new hardware. No installation. Open it on a tablet, laptop, or phone.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-(--line) border border-(--line) rounded-2xl overflow-hidden">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.n}
                {...fadeUp(idx * 0.05)}
                className="bg-(--surface) p-8 hover:bg-(--bg) transition-colors hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="size-10 rounded-lg bg-(--ink) text-(--ink-inverse) flex items-center justify-center">
                    <Icon className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="text-[11px] font-mono text-ink-3">Step {s.n}</span>
                </div>
                <h3 className="text-h3 text-ink">{s.title}</h3>
                <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">{s.desc}</p>
                <p className="text-[11px] text-ink-3 mt-6 inline-flex items-center gap-1">
                  Ready <ArrowRight className="size-3" />
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
