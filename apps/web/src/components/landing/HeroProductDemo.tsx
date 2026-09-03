import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Users,
  Layers,
  CreditCard,
  QrCode,
  BarChart3,
  CheckCircle2,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';

/* ─── Step Definitions ─── */
const STEPS = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'plans', label: 'Plans', icon: Layers },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'attendance', label: 'Attendance', icon: QrCode },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
] as const;

const STEP_DURATION = 4500;

/* ─── Ambient floating animation ─── */
const floatVariant: Variants = {
  initial: { y: 0, rotateX: 0 },
  animate: {
    y: [-8, 8, -8],
    rotateX: [-0.5, 0.5, -0.5],
    transition: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
  },
};

const platformVariant: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

/* ─── Content transition ─── */
const contentVariants: Variants = {
  enter: { opacity: 0, y: 18, filter: 'blur(6px)' },
  center: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.28 } },
};

/* ─── Step Renderers — cinematic product views ─── */

const MemberStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--iron)' }}>
      <CheckCircle2 className="size-3.5" />
      <span>New member registered</span>
      <span className="text-ink-3 font-normal">· just now</span>
    </div>
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-(--line) bg-(--surface-2)">
      <div
        className="size-11 rounded-xl flex items-center justify-center font-bold text-sm font-mono shrink-0"
        style={{ backgroundColor: 'var(--iron-soft)', color: 'var(--iron)' }}
      >
        PM
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-bold text-ink">Priya Mehta</span>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
            style={{ backgroundColor: 'var(--iron-soft)', color: 'var(--iron)' }}
          >
            ACTIVE
          </span>
        </div>
        <p className="text-[11px] font-mono text-ink-3">MEM-1044 · +91 98765 43210</p>
        <p className="text-[10px] font-mono text-ink-3">Joined: Aug 29, 2026 · Emergency: Rajesh Mehta</p>
      </div>
    </div>
  </div>
);

const PlanStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--iron)' }}>
      <CheckCircle2 className="size-3.5" />
      <span>Plan assigned — Priya Mehta</span>
    </div>
    <div className="p-4 rounded-2xl border border-(--line) bg-(--surface-2) space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-ink">Annual Strength Pro</span>
        <Badge
          variant="outline"
          className="text-[9px] font-mono font-bold"
          style={{ borderColor: 'var(--iron)', color: 'var(--iron)', backgroundColor: 'var(--iron-soft)' }}
        >
          365 Days
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-2.5 rounded-xl bg-(--surface) border border-(--line)">
          <span className="text-[10px] text-ink-3">Starts</span>
          <p className="font-bold text-ink text-[11px] font-mono">Aug 29, 2026</p>
        </div>
        <div className="p-2.5 rounded-xl bg-(--surface) border border-(--line)">
          <span className="text-[10px] text-ink-3">Expires</span>
          <p className="font-bold text-ink text-[11px] font-mono">Aug 28, 2027</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-(--line)/60 text-[11px] font-mono">
        <span className="text-ink-3">Base: ₹14,000</span>
        <span className="font-bold flex items-center gap-1" style={{ color: 'var(--iron)' }}>
          <CheckCircle2 className="size-3" /> Membership Activated
        </span>
      </div>
    </div>
  </div>
);

const PaymentStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--iron)' }}>
      <CheckCircle2 className="size-3.5" />
      <span>Payment received via UPI</span>
    </div>
    <div className="p-4 rounded-2xl border border-(--line) bg-(--surface-2) space-y-2.5">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="font-bold text-ink">Receipt #RCP-2026-0891</span>
        <span className="font-bold" style={{ color: 'var(--iron)' }}>PAID ✓</span>
      </div>
      <div className="space-y-1.5 text-[11px] font-mono">
        <div className="flex justify-between">
          <span className="text-ink-3">Plan Fee</span>
          <span className="text-ink">₹14,000</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-3">GST (18%)</span>
          <span className="text-ink">₹2,520</span>
        </div>
        <div className="flex justify-between pt-1.5 border-t border-(--line)/60 font-bold text-xs">
          <span className="text-ink">Total Received</span>
          <span className="font-display font-bold" style={{ color: 'var(--iron)' }}>₹16,520</span>
        </div>
      </div>
      <div
        className="mt-1 p-2.5 rounded-xl flex items-center gap-2 text-[10px] font-mono"
        style={{ backgroundColor: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.15)', color: '#25D366' }}
      >
        <MessageSquare className="size-3.5" />
        <span>WhatsApp receipt sent to member</span>
      </div>
    </div>
  </div>
);

const AttendanceStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--iron)' }}>
      <QrCode className="size-3.5" />
      <span>QR scanned at Front Desk</span>
    </div>
    <div
      className="p-4 rounded-2xl space-y-3"
      style={{ border: '1px solid rgba(217,72,15,0.3)', backgroundColor: 'var(--iron-soft)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-xl flex items-center justify-center font-bold text-xs font-mono"
          style={{ backgroundColor: 'var(--iron)', color: 'var(--iron-ink)' }}
        >
          PM
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-ink">Priya Mehta</span>
            <CheckCircle2 className="size-3.5" style={{ color: 'var(--iron)' }} />
          </div>
          <p className="text-[10px] font-mono text-ink-3">Annual Strength Pro · Valid till Aug 28, 2027</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(217,72,15,0.2)' }}>
        <div className="flex items-center gap-4 text-[10px] font-mono text-ink-3">
          <span>Check-in: 10:14 AM</span>
          <span>Verified in 0.18s</span>
        </div>
        <span
          className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold"
          style={{ backgroundColor: 'var(--iron)', color: 'var(--iron-ink)' }}
        >
          VALID ENTRY ✓
        </span>
      </div>
    </div>
  </div>
);

const DashboardStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--iron)' }}>
      <BarChart3 className="size-3.5" />
      <span>Owner dashboard updated</span>
    </div>
    <div className="grid grid-cols-2 gap-2.5">
      {[
        { label: 'Active Members', value: 143, change: '+1 today', accent: false },
        { label: 'Check-ins Today', value: 29, change: '+1 just now', accent: false },
        { label: 'Revenue MTD', value: 61520, prefix: '₹', change: '+₹16.5k', accent: true },
        { label: 'Collection Rate', value: 97, suffix: '%', change: '↑ from 96%', accent: false },
      ].map((m) => (
        <div key={m.label} className="p-3 rounded-2xl bg-(--surface-2) border border-(--line)">
          <span className="text-[9px] font-mono uppercase tracking-wider text-ink-3">{m.label}</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-display font-bold text-ink">
              {m.prefix ?? ''}<AnimatedCounter value={m.value} />{m.suffix ?? ''}
            </span>
          </div>
          <span className="text-[9px] font-mono font-semibold" style={{ color: m.accent ? 'var(--iron)' : 'var(--iron)' }}>{m.change}</span>
        </div>
      ))}
    </div>
  </div>
);

/* ─── Main Component ─── */
export const HeroProductDemo: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const advanceStep = useCallback(() => {
    setActiveStep((prev) => (prev + 1) % STEPS.length);
    setProgress(0);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(advanceStep, STEP_DURATION);
    return () => clearInterval(timer);
  }, [isPaused, advanceStep]);

  useEffect(() => {
    if (isPaused) return;
    setProgress(0);
    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + 2.5, 100));
    }, STEP_DURATION / 40);
    return () => clearInterval(tick);
  }, [activeStep, isPaused]);

  const handleStepClick = (idx: number) => {
    setActiveStep(idx);
    setProgress(0);
  };

  const STEP_RENDERERS = [MemberStep, PlanStep, PaymentStep, AttendanceStep, DashboardStep];
  const ActiveContent = STEP_RENDERERS[activeStep];

  return (
    <div
      className="relative w-full max-w-[860px] mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ambient glow */}
      <div
        className="absolute -inset-8 rounded-3xl pointer-events-none opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(ellipse at center, rgba(217,72,15,0.25) 0%, transparent 70%)' }}
      />

      {/* Floating window */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-(--line)"
        style={{
          background: 'linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 24px 64px -12px rgba(0,0,0,0.5), 0 8px 24px -8px rgba(0,0,0,0.4)',
        }}
      >
        {/* Top accent strip */}
        <div
          className="absolute top-0 left-0 right-0 h-px opacity-70"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(217,72,15,0.7) 50%, transparent 100%)' }}
        />

        {/* Title bar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-(--line)" style={{ backgroundColor: 'var(--surface-2)' }}>
          {/* Traffic lights */}
          <div className="flex gap-1.5 shrink-0">
            <div className="size-3.5 rounded-full" style={{ backgroundColor: 'rgba(217,72,15,0.8)' }} />
            <div className="size-3.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <div className="size-3.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* URL pill */}
          <div className="flex-1 flex justify-center">
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-[11px] font-mono font-medium border"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--line)',
                color: 'var(--ink-2)',
              }}
            >
              <span className="size-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#22c55e' }} />
              gymtech.app/admin
            </div>
          </div>

          {/* Synced badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Activity size={11} className="animate-pulse" style={{ color: 'var(--iron)' }} />
            <span className="text-[10px] font-mono font-semibold hidden sm:flex" style={{ color: 'var(--iron)' }}>Synced</span>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex" style={{ minHeight: 300 }}>
          {/* Left sidebar nav */}
          <nav className="w-[136px] shrink-0 border-r border-(--line) py-4 flex flex-col gap-1 px-2.5" style={{ backgroundColor: 'var(--surface-2)' }}>
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  className="group flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200"
                >
                  <div
                    className="size-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? 'var(--iron)' : 'var(--surface)',
                      color: isActive ? 'var(--iron-ink)' : 'var(--ink-3)',
                    }}
                  >
                    <Icon size={12} strokeWidth={2} />
                  </div>
                  <span
                    className="text-[11px] font-medium transition-colors duration-200"
                    style={{ color: isActive ? 'var(--iron)' : 'var(--ink-3)' }}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}

            {/* Active indicator */}
            <div className="relative flex-1">
              <motion.div
                className="absolute right-0 w-0.5 rounded-full"
                style={{ backgroundColor: 'var(--iron)' }}
                animate={{ top: `${activeStep * 52 + 14}px`, height: 24 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            </div>
          </nav>

          {/* Content panel */}
          <div className="relative flex-1 p-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <ActiveContent />
              </motion.div>
            </AnimatePresence>

            {/* Step dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: activeStep === idx ? 24 : 6,
                    backgroundColor: activeStep === idx ? 'var(--iron)' : 'var(--line)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5" style={{ backgroundColor: 'var(--line)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--iron), #F97316)' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>
      </motion.div>

      {/* Depth shadow below */}
      <div
        className="absolute -bottom-6 left-4 right-4 h-8 rounded-full pointer-events-none opacity-30 blur-lg"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 70%)' }}
      />
    </div>
  );
};
