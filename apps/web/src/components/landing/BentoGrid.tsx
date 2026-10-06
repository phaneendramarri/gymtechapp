import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  CreditCard,
  QrCode,
  BarChart3,
  Calendar,
  Shield,
  Zap,
  Smartphone,
} from 'lucide-react';

/* ─── Animation helpers ─── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as const },
});

/* ─── Feature cards ─── */
interface FeatureDef {
  title: string;
  description: string;
  icon: React.ElementType;
  accent?: boolean;
  span?: 'col' | 'row' | 'wide';
  stat?: { value: string; label: string };
  previewTag?: string;
}

const FEATURES: FeatureDef[] = [
  {
    title: 'Member Management',
    description: 'Full profiles with emergency contacts, medical notes, profile photos, and freeze history.',
    icon: Users,
    stat: { value: '143', label: 'active members' },
    previewTag: '1-Click Freeze & Pause Active',
  },
  {
    title: 'Plans & Memberships',
    description: 'Monthly to annual packages. Custom admission fees, GST rules, and freeze windows per plan.',
    icon: Calendar,
    accent: true,
    stat: { value: '6', label: 'active plans' },
    previewTag: 'Auto-Calculates 18% CGST + SGST',
  },
  {
    title: 'Billing & GST Invoices',
    description: 'UPI, cash, card. GST-compliant receipts sent over WhatsApp instantly.',
    icon: CreditCard,
    stat: { value: '₹4.5L', label: 'this month' },
    previewTag: 'Instant WhatsApp PDF Receipt',
  },
  {
    title: 'QR & Face Turnstile Check-in',
    description: 'Members scan digital passes or face ID. Hardware relay triggers in under 0.2 seconds.',
    icon: QrCode,
    span: 'wide',
    previewTag: '0.18s Gate Unlock · Zero Tailgating',
  },
  {
    title: 'Attendance Tracking',
    description: 'Daily log with peak hour heatmaps. Know member engagement and floor volume at a glance.',
    icon: BarChart3,
    previewTag: 'Peak Floor Hours: 6:00 - 8:30 PM',
  },
  {
    title: 'PT Commissions',
    description: 'Assign trainers to members. Track sessions delivered vs. paid automatically.',
    icon: Zap,
    previewTag: 'Zero-Leakage Trainer Commission Ledger',
  },
  {
    title: 'Staff Roles & Security',
    description: 'Receptionist, trainer, billing admin — each with strictly scoped access.',
    icon: Shield,
    previewTag: 'Scoped API Role Governance',
  },
  {
    title: 'Mobile-First Athlete Hub',
    description: 'Opens on any phone, tablet, or desktop kiosk. No installation or app store downloads required.',
    icon: Smartphone,
    span: 'wide',
    previewTag: 'Runs Smoothly on 4G & Offline Cache',
  },
];

const ICON_SIZE = 20;
const ACCENT = 'var(--iron)';

export const BentoGrid: React.FC = () => {
  return (
    <section id="features" className="py-24 sm:py-32 border-t border-line bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="max-w-2xl mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Everything you need</p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            One platform. Every daily task.
          </h2>
          <p className="text-body text-ink-2 mt-4">
            No duct-taping together a Excel sheet, a separate attendance app, and a WhatsApp broadcast tool. GymTech replaces all of it.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Feature cards */}
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            const isWide = feature.span === 'wide';
            const isAccent = feature.accent;

            return (
              <motion.div
                key={feature.title}
                {...fadeUp(idx * 0.04)}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`
                  group relative overflow-hidden rounded-2xl border border-line
                  bg-surface p-6
                  hover:border-iron/40 hover:shadow-xl hover:shadow-iron/5
                  transition-all duration-300 flex flex-col justify-between
                  ${isWide ? 'lg:col-span-2' : ''}
                `}
              >
                {/* Top accent line on hover */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
                />

                <div>
                  <div className="flex items-center justify-between mb-5">
                    {/* Icon */}
                    <div
                      className="size-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105"
                      style={{
                        backgroundColor: isAccent ? 'var(--iron-soft)' : 'var(--surface-2)',
                        color: isAccent ? ACCENT : 'var(--ink-2)',
                      }}
                    >
                      <Icon size={ICON_SIZE} strokeWidth={1.5} />
                    </div>

                    {/* Interactive Real-World Tag */}
                    {feature.previewTag && (
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-(--surface-2) border border-(--line) text-(--ink-3) group-hover:border-iron/30 group-hover:text-iron transition-colors">
                        {feature.previewTag}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <h3 className="text-[15px] font-bold text-ink flex items-center gap-1.5">
                      {feature.title}
                    </h3>
                    <p className="text-[13px] text-ink-2 leading-relaxed">{feature.description}</p>
                  </div>
                </div>

                {/* Optional stat */}
                {feature.stat && (
                  <div className="flex items-baseline gap-2 mt-4 pt-4 border-t border-line/60">
                    <span
                      className="text-2xl font-display font-bold"
                      style={{ color: isAccent ? ACCENT : 'var(--ink)' }}
                    >
                      {feature.stat.value}
                    </span>
                    <span className="text-[12px] text-ink-3">{feature.stat.label}</span>
                  </div>
                )}
              </motion.div>
            );
          })}

        </div>
      </div>
    </section>
  );
};
