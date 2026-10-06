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
    <section id="how-it-works" className="py-24 sm:py-32 bg-bg border-t border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp(0)} className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Day 1, ready by 6 PM</p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            Onboarded in an afternoon.
          </h2>
          <p className="text-body text-ink-2 mt-4">
            No new hardware. No installation. Open it on a tablet, laptop, or phone.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line rounded-3xl overflow-hidden shadow-sm">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const stepBadges = [
              '⚡ 1 min 45s setup',
              '📊 Auto-maps Excel .xlsx',
              '🚀 Live on floor tonight',
            ];
            return (
              <motion.div
                key={s.n}
                {...fadeUp(idx * 0.05)}
                whileHover={{ y: -2 }}
                className="bg-surface p-8 hover:bg-surface-2 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="size-11 rounded-2xl bg-ink text-ink-inverse flex items-center justify-center group-hover:scale-105 group-hover:bg-iron transition-all shadow-xs">
                      <Icon className="size-5" strokeWidth={1.5} />
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-line text-ink-3">
                      STEP {s.n}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-ink group-hover:text-iron transition-colors">{s.title}</h3>
                  <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">{s.desc}</p>
                </div>
                
                <div className="mt-8 pt-4 border-t border-line/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-iron font-semibold">
                    {stepBadges[idx]}
                  </span>
                  <ArrowRight className="size-3.5 text-ink-3 group-hover:text-iron group-hover:translate-x-1 transition-all" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
