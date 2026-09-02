import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Users,
  Layers,
  CreditCard,
  QrCode,
  BarChart3,
  CheckCircle2,
  ArrowUpRight,
  MessageSquare,
  Activity,
  Shield,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';

/* ─── Step Definitions ─── */
const STEPS = [
  { id: 'members', label: 'Members', icon: Users, accent: 'text-primary' },
  { id: 'plans', label: 'Plans', icon: Layers, accent: 'text-primary' },
  { id: 'payments', label: 'Payments', icon: CreditCard, accent: 'text-primary' },
  { id: 'attendance', label: 'Attendance', icon: QrCode, accent: 'text-primary' },
  { id: 'dashboard', label: 'Reports', icon: BarChart3, accent: 'text-primary' },
] as const;

const STEP_DURATION = 4200;

/* ─── Transition Variants ─── */
const contentVariants: Variants = {
  enter: { opacity: 0, y: 16, filter: 'blur(4px)' },
  center: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -12, filter: 'blur(4px)', transition: { duration: 0.25 } },
};

/* ─── Step Renderers ─── */

const MemberStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-mono text-primary font-semibold">
      <CheckCircle2 className="size-3.5" />
      <span>New member registered</span>
      <span className="text-muted-foreground">• just now</span>
    </div>
    <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border">
      <div className="size-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-sm font-mono shrink-0">
        PM
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-bold text-foreground">Priya Mehta</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
            ACTIVE
          </span>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground">MEM-1044 &bull; +91 98765 43210</p>
        <p className="text-[10px] font-mono text-muted-foreground">Joined: Aug 29, 2026 &bull; Emergency: Rajesh Mehta</p>
      </div>
    </div>
  </div>
);

const PlanStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-mono text-primary font-semibold">
      <CheckCircle2 className="size-3.5" />
      <span>Plan assigned to Priya Mehta</span>
    </div>
    <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">Annual Strength Pro</span>
        <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary bg-primary/5">
          365 Days
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <div className="p-2.5 rounded-lg bg-background border border-border">
          <span className="text-muted-foreground text-[10px]">Starts</span>
          <p className="font-bold text-foreground text-[11px]">Aug 29, 2026</p>
        </div>
        <div className="p-2.5 rounded-lg bg-background border border-border">
          <span className="text-muted-foreground text-[10px]">Expires</span>
          <p className="font-bold text-foreground text-[11px]">Aug 28, 2027</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs font-mono">
        <span className="text-muted-foreground">Base: ₹14,000</span>
        <span className="text-primary font-bold flex items-center gap-1">
          <CheckCircle2 className="size-3" /> Membership Activated
        </span>
      </div>
    </div>
  </div>
);

const PaymentStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-mono text-primary font-semibold">
      <CheckCircle2 className="size-3.5" />
      <span>Payment received via UPI</span>
    </div>
    <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="font-bold text-foreground">Receipt #RCP-2026-0891</span>
        <span className="text-primary font-bold">PAID ✓</span>
      </div>
      <div className="space-y-1.5 text-[11px] font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Plan Fee</span>
          <span className="text-foreground">₹14,000</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GST (18%)</span>
          <span className="text-foreground">₹2,520</span>
        </div>
        <div className="flex justify-between pt-1.5 border-t border-border/60 font-bold text-xs">
          <span className="text-foreground">Total Received</span>
          <span className="text-primary font-display">₹16,520</span>
        </div>
      </div>
      <div className="mt-1 p-2.5 rounded-lg bg-[#25D366]/8 border border-[#25D366]/15 flex items-center gap-2 text-[10px] font-mono">
        <MessageSquare className="size-3.5 text-[#25D366]" />
        <span className="text-foreground">WhatsApp bill sent to member</span>
      </div>
    </div>
  </div>
);

const AttendanceStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-mono text-primary font-semibold">
      <QrCode className="size-3.5" />
      <span>QR attendance scanned at Front Desk</span>
    </div>
    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs font-mono">
          PM
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-foreground">Priya Mehta</span>
            <CheckCircle2 className="size-3.5 text-primary" />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">Annual Strength Pro &bull; Valid till Aug 28, 2027</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-primary/20">
        <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
          <span>Check-in: 10:14 AM</span>
          <span>Verified in 0.18s</span>
        </div>
        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-primary text-primary-foreground">
          VALID ENTRY ✓
        </span>
      </div>
    </div>
  </div>
);

const DashboardStep: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] font-mono text-primary font-semibold">
      <BarChart3 className="size-3.5" />
      <span>Owner dashboard updated</span>
    </div>
    <div className="grid grid-cols-2 gap-2.5">
      {[
        { label: 'Active Members', value: 143, suffix: '', change: '+1 today' },
        { label: 'Check-ins', value: 29, suffix: '', change: '+1 just now' },
        { label: 'Revenue MTD', value: 61520, suffix: '', prefix: '₹', change: '+₹16.5k' },
        { label: 'Collection Rate', value: 97, suffix: '%', change: '↑ from 96%' },
      ].map((m) => (
        <div key={m.label} className="p-3 rounded-xl bg-secondary/50 border border-border">
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{m.label}</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base font-display font-bold text-foreground">
              {m.prefix}<AnimatedCounter value={m.value} />{m.suffix}
            </span>
          </div>
          <span className="text-[9px] font-mono text-primary font-semibold">{m.change}</span>
        </div>
      ))}
    </div>
  </div>
);

const STEP_RENDERERS = [MemberStep, PlanStep, PaymentStep, AttendanceStep, DashboardStep];

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

  const ActiveContent = STEP_RENDERERS[activeStep];

  return (
    <div
      className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Window Chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/60 border-b border-border">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-background/80 border border-border text-[10px] font-mono text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          ironhouse.gymtech.app
        </div>
        <div className="text-[10px] font-mono text-primary hidden sm:flex items-center gap-1 font-semibold">
          <Activity className="size-3 animate-pulse" />
          Synced
        </div>
      </div>

      {/* App Shell: Sidebar + Content */}
      <div className="flex min-h-[340px] sm:min-h-[360px]">
        {/* Sidebar */}
        <div className="w-14 sm:w-[72px] shrink-0 border-r border-border bg-secondary/30 py-3 flex flex-col items-center gap-1">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === activeStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(idx)}
                className={`w-10 sm:w-14 py-2 rounded-lg flex flex-col items-center gap-1 transition-all text-center ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Icon className="size-4" />
                <span className="text-[8px] sm:text-[9px] font-mono font-semibold leading-none">{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-5 bg-background overflow-hidden relative">
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
        </div>
      </div>

      {/* Step Progress Strip */}
      <div className="flex items-center border-t border-border bg-secondary/30 px-3 py-2 gap-1.5">
        {STEPS.map((step, idx) => (
          <button
            key={step.id}
            type="button"
            onClick={() => handleStepClick(idx)}
            className="flex-1 relative"
          >
            <div className={`h-1 rounded-full overflow-hidden ${
              idx < activeStep ? 'bg-primary' : idx === activeStep ? 'bg-border' : 'bg-border/50'
            }`}>
              {idx === activeStep && (
                <motion.div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                />
              )}
            </div>
            <span className={`block text-center mt-1.5 text-[8px] font-mono font-semibold ${
              idx <= activeStep ? 'text-primary' : 'text-muted-foreground/60'
            }`}>
              {step.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
