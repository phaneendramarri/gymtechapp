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
  Play,
  Pause,
  ChevronRight,
  ShieldCheck,
  Zap,
  Lock,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';

/* ─── Step Definitions ─── */
const STEPS = [
  { id: 'members', stepNum: '01', label: 'Members', icon: Users, subtitle: 'Biometric profile' },
  { id: 'plans', stepNum: '02', label: 'Plans', icon: Layers, subtitle: 'Automated quotas' },
  { id: 'payments', stepNum: '03', label: 'Payments', icon: CreditCard, subtitle: 'UPI & GST billing' },
  { id: 'attendance', stepNum: '04', label: 'Attendance', icon: QrCode, subtitle: '0.18s Turnstile pass' },
  { id: 'dashboard', stepNum: '05', label: 'Analytics', icon: BarChart3, subtitle: 'Real-time ledger' },
] as const;

const STEP_DURATION = 4800;

/* ─── Content transitions ─── */
const contentVariants: Variants = {
  enter: { opacity: 0, y: 16, filter: 'blur(4px)' },
  center: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, filter: 'blur(3px)', transition: { duration: 0.22 } },
};

/* ─── STEP 1: Member Registration ─── */
const MemberStep: React.FC = () => (
  <div className="space-y-3.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-semibold text-(--iron)">
        <span className="size-2 rounded-full bg-(--iron) animate-ping" />
        <CheckCircle2 className="size-3.5" />
        <span>New Athlete Onboarded</span>
        <span className="text-(--ink-3) font-normal text-[11px]">· 0.4s Registration</span>
      </div>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-(--surface-2) border border-(--line) text-(--ink-2) font-semibold">
        STEP 1 / 5
      </span>
    </div>

    {/* Profile card */}
    <div className="p-4 sm:p-5 rounded-2xl border border-(--line) bg-(--surface) shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-start gap-4">
        <div className="relative">
          <div
            className="size-13 rounded-2xl flex items-center justify-center font-bold text-base font-mono shrink-0 shadow-xs border border-orange-500/30"
            style={{ backgroundColor: 'var(--iron-soft)', color: 'var(--iron)' }}
          >
            PM
          </div>
          <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
            <CheckCircle2 className="size-2.5 text-white" />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base font-bold text-(--ink) font-display">Priya Mehta</span>
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide"
              style={{ backgroundColor: 'var(--iron-soft)', color: 'var(--iron)' }}
            >
              MEM-1044 · ACTIVE
            </span>
          </div>
          <p className="text-xs text-(--ink-2) font-mono">+91 98765 43210 · priya.m@fitness.in</p>
          <p className="text-[11px] text-(--ink-3) mt-1 flex items-center gap-2">
            <span>Joined: Today</span>
            <span>·</span>
            <span>Emergency: Rajesh Mehta (+91 98112...)</span>
          </p>
        </div>
      </div>

      {/* Biometric verification chip */}
      <div className="mt-3.5 pt-3 border-t border-(--line) flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[11px] font-mono text-(--ink-2)">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Face ID Vectorized (128-D Encrypted)</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          READY FOR TURNSTILE
        </span>
      </div>
    </div>
  </div>
);

/* ─── STEP 2: Plan Assignment ─── */
const PlanStep: React.FC = () => (
  <div className="space-y-3.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-semibold text-(--iron)">
        <CheckCircle2 className="size-3.5" />
        <span>Membership Package Configured</span>
      </div>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-(--surface-2) border border-(--line) text-(--ink-2) font-semibold">
        STEP 2 / 5
      </span>
    </div>

    <div className="p-4 sm:p-5 rounded-2xl border border-(--line) bg-(--surface) shadow-sm space-y-3.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-base font-bold text-(--ink) font-display">Annual Strength Pro</span>
          <p className="text-xs text-(--ink-3) mt-0.5">Assigned to Priya Mehta · All Floor Access</p>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-mono font-bold px-3 py-1"
          style={{ borderColor: 'var(--iron)', color: 'var(--iron)', backgroundColor: 'var(--iron-soft)' }}
        >
          365 Days Active
        </Badge>
      </div>

      {/* Visual Validity Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-(--ink-3)">
          <span>Package Validity Window</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Unlocked</span>
        </div>
        <div className="h-2 w-full rounded-full bg-(--surface-2) border border-(--line) overflow-hidden p-0.5">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-(--surface-2) border border-(--line)">
          <span className="text-[10px] font-mono uppercase text-(--ink-3) font-bold">Start Date</span>
          <p className="font-bold text-(--ink) text-xs font-mono mt-0.5">Aug 29, 2026</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Immediate start</span>
        </div>
        <div className="p-3 rounded-xl bg-(--surface-2) border border-(--line)">
          <span className="text-[10px] font-mono uppercase text-(--ink-3) font-bold">Expiry Date</span>
          <p className="font-bold text-(--ink) text-xs font-mono mt-0.5">Aug 28, 2027</p>
          <span className="text-[10px] text-(--ink-3) font-mono">Auto-renewal enabled</span>
        </div>
      </div>

      {/* Feature inclusions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {['Unlimited Floor Access', 'Locker #42 Assigned', '12 Free PT Quotas', 'Sauna Access'].map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-(--surface-2) border border-(--line) text-(--ink-2)"
          >
            ✓ {tag}
          </span>
        ))}
      </div>
    </div>
  </div>
);

/* ─── STEP 3: Payment & Automated GST WhatsApp Receipt ─── */
const PaymentStep: React.FC = () => (
  <div className="space-y-3.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-semibold text-(--iron)">
        <CheckCircle2 className="size-3.5" />
        <span>UPI Payment Captured & Receipt Dispatched</span>
      </div>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-(--surface-2) border border-(--line) text-(--ink-2) font-semibold">
        STEP 3 / 5
      </span>
    </div>

    <div className="p-4 sm:p-5 rounded-2xl border border-(--line) bg-(--surface) shadow-sm space-y-3">
      <div className="flex items-center justify-between text-xs font-mono border-b border-(--line) pb-2.5">
        <div>
          <span className="font-bold text-(--ink)">TAX INVOICE #RCP-2026-0891</span>
          <span className="text-[10px] text-(--ink-3) block font-sans">Payment via UPI · Ref: 489201842910</span>
        </div>
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="font-bold px-2 py-0.5 rounded-md text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[11px]"
        >
          SETTLED ✓
        </motion.span>
      </div>

      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex justify-between text-(--ink-2)">
          <span>Base Membership Fee</span>
          <span>₹14,000.00</span>
        </div>
        <div className="flex justify-between text-(--ink-2)">
          <span>GST (CGST 9% + SGST 9%)</span>
          <span>₹2,520.00</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-(--line) font-bold text-sm">
          <span className="text-(--ink)">Total Amount Received</span>
          <span className="font-display font-bold text-(--iron)">₹16,520.00</span>
        </div>
      </div>

      {/* WhatsApp Delivery Pill */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        className="mt-2 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono"
        style={{ backgroundColor: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.22)', color: '#16a34a' }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            WhatsApp GST Tax Invoice PDF dispatched to +91 98765 43210
          </span>
        </div>
        <span className="text-[10px] font-bold shrink-0">0.4s</span>
      </motion.div>
    </div>
  </div>
);

/* ─── STEP 4: Smart Turnstile Attendance ─── */
const AttendanceStep: React.FC = () => (
  <div className="space-y-3.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-semibold text-(--iron)">
        <Zap className="size-3.5 fill-(--iron)" />
        <span>0.18s Biometric Face Turnstile Unlock</span>
      </div>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-(--surface-2) border border-(--line) text-(--ink-2) font-semibold">
        STEP 4 / 5
      </span>
    </div>

    <div
      className="p-4 sm:p-5 rounded-2xl space-y-3.5 relative overflow-hidden border border-orange-500/30 bg-orange-500/5 shadow-sm"
    >
      {/* Moving scanner laser line */}
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent pointer-events-none opacity-80"
        animate={{ y: [0, 140, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="flex items-center gap-3.5 relative z-10">
        <div
          className="size-12 rounded-2xl flex items-center justify-center font-bold text-sm font-mono shrink-0 shadow-xs"
          style={{ backgroundColor: 'var(--iron)', color: 'var(--iron-ink)' }}
        >
          PM
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base font-bold text-(--ink) font-display">Priya Mehta</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="text-xs font-mono text-(--ink-2)">Annual Strength Pro · Turnstile Gate #02</p>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
          GATE OPEN ✓
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-orange-500/20 text-xs font-mono text-(--ink-2) relative z-10">
        <div className="flex items-center gap-4">
          <span>Tap Time: 10:14:02 AM</span>
          <span>Scan Latency: 0.18s</span>
        </div>
        <span className="text-[11px] font-bold text-(--iron)">ZERO TAILGATING</span>
      </div>
    </div>
  </div>
);

/* ─── STEP 5: Live Analytics & Ledger ─── */
const DashboardStep: React.FC = () => (
  <div className="space-y-3.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs font-semibold text-(--iron)">
        <BarChart3 className="size-3.5" />
        <span>Owner Executive Ledger Updated Instantly</span>
      </div>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-(--surface-2) border border-(--line) text-(--ink-2) font-semibold">
        STEP 5 / 5
      </span>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {[
        { label: 'Active Athletes', value: 144, change: '+1 just joined', icon: Users, accent: false },
        { label: 'Turnstile Taps', value: 30, change: '+1 verified now', icon: Zap, accent: false },
        { label: 'Revenue MTD', value: 78040, prefix: '₹', change: '+₹16,520 today', icon: TrendingUp, accent: true },
        { label: 'Collection Rate', value: 98, suffix: '%', change: '↑ Zero dues', icon: CheckCircle2, accent: false },
      ].map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="p-3.5 rounded-2xl bg-(--surface) border border-(--line) shadow-2xs group hover:border-(--iron)/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-(--ink-3) font-bold">{m.label}</span>
              <Icon className="size-3.5 text-(--ink-3) group-hover:text-(--iron) transition-colors" />
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-xl sm:text-2xl font-display font-bold text-(--ink)">
                {m.prefix ?? ''}<AnimatedCounter value={m.value} />{m.suffix ?? ''}
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-(--iron) mt-0.5 block">{m.change}</span>
          </div>
        );
      })}
    </div>
  </div>
);

/* ─── Main Hero Product Demo Component ─── */
export const HeroProductDemo: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setRotateX(-((y - centerY) / centerY) * 3);
    setRotateY(((x - centerX) / centerX) * 3);
    setGlarePos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    setRotateX(0);
    setRotateY(0);
  };

  const STEP_RENDERERS = [MemberStep, PlanStep, PaymentStep, AttendanceStep, DashboardStep];
  const ActiveContent = STEP_RENDERERS[activeStep];

  return (
    <div
      className="relative w-full max-w-[880px] mx-auto select-none"
      style={{ perspective: 1200 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient background glow */}
      <div
        className="absolute -inset-6 rounded-3xl pointer-events-none opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(ellipse at center, rgba(251,146,60,0.22) 0%, transparent 70%)' }}
      />

      {/* Modern Mock Platform Frame with 3D Parallax */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX, rotateY }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative overflow-hidden rounded-3xl border border-(--line) bg-(--surface) text-(--ink) shadow-2xl"
      >
        {/* Dynamic Light Sheen on Mouse Movement */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10 transition-opacity z-30"
          style={{
            background: `radial-gradient(circle 350px at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.45), transparent 80%)`,
          }}
        />

        {/* Top hairline brand accent */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] z-20"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(251,146,60,0.8) 50%, transparent 100%)' }}
        />

        {/* Window Top Title Bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-(--line) bg-(--surface-2)/70 backdrop-blur-sm">
          {/* Mac-style traffic dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="size-3 rounded-full bg-red-500/80 hover:opacity-100 transition-opacity" />
            <div className="size-3 rounded-full bg-amber-500/80 hover:opacity-100 transition-opacity" />
            <div className="size-3 rounded-full bg-emerald-500/80 hover:opacity-100 transition-opacity" />
          </div>

          {/* Browser Address Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-medium border border-(--line) bg-(--surface) shadow-2xs">
            <Lock className="size-3 text-emerald-500" />
            <span className="text-(--ink-2)">app.gymtech.io/console</span>
            <span className="text-(--ink-3) text-[10px] hidden sm:inline">· TLS 1.3</span>
          </div>

          {/* Live Sync Status & Pause/Play toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-(--surface) border border-(--line) text-(--ink-2) hover:text-(--ink) flex items-center gap-1 cursor-pointer transition-colors"
              title={isPaused ? 'Resume auto-play' : 'Pause animation'}
            >
              {isPaused ? <Play className="size-2.5 text-emerald-500 fill-emerald-500" /> : <Pause className="size-2.5 text-orange-500 fill-orange-500" />}
              <span>{isPaused ? 'Paused' : 'Auto'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-(--iron)">
              <span className="size-1.5 rounded-full bg-(--iron) animate-pulse" />
              <Activity className="size-3 text-(--iron)" />
              <span className="font-bold">12ms Sync</span>
            </div>
          </div>
        </div>

        {/* Body Layout: Left Steps Nav + Right Content Area */}
        <div className="flex flex-col md:flex-row min-h-[340px]">
          {/* Left Navigation Rail */}
          <nav className="w-full md:w-[190px] shrink-0 border-b md:border-b-0 md:border-r border-(--line) p-3 bg-(--surface-2)/40 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  className={`group relative flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-(--surface) shadow-xs font-semibold border border-(--line)'
                      : 'hover:bg-(--surface-2) text-(--ink-3) hover:text-(--ink)'
                  }`}
                >
                  <div
                    className="size-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--iron)' : 'var(--surface-2)',
                      color: isActive ? 'var(--iron-ink)' : 'var(--ink-3)',
                    }}
                  >
                    <Icon className="size-3.5" />
                  </div>

                  <div className="min-w-0 flex-1 hidden md:block">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-(--ink) truncate">
                        {step.label}
                      </span>
                      <span className="text-[9px] font-mono text-(--ink-3)">{step.stepNum}</span>
                    </div>
                    <span className="text-[10px] text-(--ink-3) truncate block">
                      {step.subtitle}
                    </span>
                  </div>

                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="active-step-bar"
                      className="hidden md:block absolute -right-3 top-2 bottom-2 w-1 rounded-l-full bg-(--iron)"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Content Panel */}
          <div className="relative flex-1 p-5 sm:p-6 overflow-hidden flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full"
              >
                <ActiveContent />
              </motion.div>
            </AnimatePresence>

            {/* Bottom step switcher dots and navigation */}
            <div className="mt-6 pt-3 border-t border-(--line) flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, idx) => {
                  const isActive = activeStep === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStepClick(idx)}
                      className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
                      style={{
                        width: isActive ? 28 : 8,
                        backgroundColor: isActive ? 'var(--iron-soft)' : 'var(--line)',
                      }}
                      aria-label={`Go to slide ${idx + 1}`}
                    >
                      {isActive && (
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: 'var(--iron)',
                            width: `${progress}%`,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={advanceStep}
                className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-(--iron) hover:underline cursor-pointer"
              >
                <span>Next Lifecycle Step</span>
                <ChevronRight className="size-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="h-[2px] bg-(--line)">
          <motion.div
            className="h-full"
            style={{ backgroundColor: 'var(--iron)' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>
      </motion.div>
    </div>
  );
};
