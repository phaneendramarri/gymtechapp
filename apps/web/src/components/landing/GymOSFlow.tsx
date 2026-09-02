import React from 'react';
import { motion } from 'framer-motion';
import { Users, Layers, CreditCard, QrCode, BarChart3, ArrowRight } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface NodeDef {
  id: string;
  label: string;
  metric: string;
  unit: string;
  icon: React.ElementType;
  description: string;
}

const NODES: NodeDef[] = [
  { id: 'members', label: 'Members', metric: '142', unit: 'active members', icon: Users, description: 'Track member profiles, contact info, and pause/freeze requests in one place.' },
  { id: 'plans', label: 'Memberships', metric: '6', unit: 'active plans', icon: Layers, description: 'Monthly to annual packages with custom fees, admission charges, and GST rules.' },
  { id: 'payments', label: 'Billing', metric: '₹4.5L', unit: 'this month', icon: CreditCard, description: 'Record cash, UPI, and card payments with instant WhatsApp receipts.' },
  { id: 'attendance', label: 'Attendance', metric: '28', unit: 'today', icon: QrCode, description: 'Instant QR code and phone number check-in with automated expiry alerts.' },
  { id: 'reports', label: 'Reports', metric: '97%', unit: 'collected', icon: BarChart3, description: 'Live revenue tracking, payment dues, and 1-click accountant Excel exports.' },
];

export const GymOSFlow: React.FC = () => {
  return (
    <section id="product" className="py-24 sm:py-32 border-t border-[var(--line)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp(0)} className="max-w-2xl mx-auto text-center mb-14">
          <p className="gt-kicker">One software, end to end</p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            From the first walk-in to the monthly report.
          </h2>
          <p className="text-body text-ink-2 mt-4">
            Every daily task lives in the same place — no separate apps for billing, attendance, and reports.
          </p>
        </motion.div>

        {/* Pipeline Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {NODES.map((node, idx) => {
            const Icon = node.icon;
            return (
              <motion.div
                key={node.id}
                {...fadeUp(idx * 0.05)}
                className="relative bg-[var(--bg)] border border-[var(--line)] rounded-xl p-5 hover:border-[var(--ink-3)] transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="size-9 rounded-lg bg-[var(--iron-soft)] text-[var(--iron)] flex items-center justify-center shrink-0">
                    <Icon className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-3">
                    Step {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-ink">{node.label}</h3>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-stat-md text-ink num">{node.metric}</span>
                  <span className="text-[10px] text-ink-3">{node.unit}</span>
                </div>
                <p className="text-[12px] text-ink-3 mt-3 leading-relaxed">{node.description}</p>
                {idx < NODES.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 size-4 text-ink-3 z-10" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
