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
}

const FEATURES: FeatureDef[] = [
  {
    title: 'Member Management',
    description: 'Full profiles with emergency contacts, medical notes, profile photos, and freeze history.',
    icon: Users,
    stat: { value: '143', label: 'active members' },
  },
  {
    title: 'Plans & Memberships',
    description: 'Monthly to annual packages. Custom admission fees, GST rules, and freeze windows per plan.',
    icon: Calendar,
    accent: true,
    stat: { value: '6', label: 'active plans' },
  },
  {
    title: 'Billing & GST Invoices',
    description: 'UPI, cash, card. GST-compliant receipts sent over WhatsApp instantly.',
    icon: CreditCard,
    stat: { value: '₹4.5L', label: 'this month' },
  },
  {
    title: 'QR Check-in',
    description: 'Members scan their digital card or enter phone number. Verified in under a second.',
    icon: QrCode,
    span: 'wide',
  },
  {
    title: 'Attendance Tracking',
    description: 'Daily log with trend charts. Know your peak hours and member engagement at a glance.',
    icon: BarChart3,
  },
  {
    title: 'PT Commissions',
    description: 'Assign trainers to members. Track sessions delivered vs. paid automatically.',
    icon: Zap,
  },
  {
    title: 'Staff Roles',
    description: 'Receptionist, trainer, billing admin — each with exactly the access they need.',
    icon: Shield,
  },
  {
    title: 'Mobile-First',
    description: 'Opens on any phone, tablet, or desktop. No installation. Just open and go.',
    icon: Smartphone,
    span: 'wide',
  },
];

const ICON_SIZE = 20;
const ACCENT = 'var(--iron)';

export const BentoGrid: React.FC = () => {
  return (
    <section id="features" className="py-24 sm:py-32 border-t border-(--line) bg-(--bg)">
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
                className={`
                  group relative overflow-hidden rounded-2xl border border-(--line)
                  bg-(--surface) p-6
                  hover:border-(--iron)/30 hover:shadow-lg hover:shadow-(--iron)/5
                  transition-all duration-300
                  ${isWide ? 'lg:col-span-2' : ''}
                `}
              >
                {/* Top accent line on hover */}
                <div
                  className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
                />

                {/* Icon */}
                <div
                  className="size-10 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300"
                  style={{
                    backgroundColor: isAccent ? 'var(--iron-soft)' : 'var(--surface-2)',
                    color: isAccent ? ACCENT : 'var(--ink-2)',
                  }}
                >
                  <Icon size={ICON_SIZE} strokeWidth={1.5} />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h3 className="text-[15px] font-semibold text-ink">{feature.title}</h3>
                  <p className="text-[13px] text-ink-2 leading-relaxed">{feature.description}</p>
                </div>

                {/* Optional stat */}
                {feature.stat && (
                  <div className="flex items-baseline gap-2 mt-4 pt-4 border-t border-(--line)/60">
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
