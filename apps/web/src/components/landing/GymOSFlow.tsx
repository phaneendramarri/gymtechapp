import React, { useEffect, useRef } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { Users, Layers, CreditCard, QrCode, BarChart3, LayoutDashboard } from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

/* ─── Node definitions ─── */
interface NodeDef {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  accent: string;
  metric: string;
  unit: string;
}

const NODES: NodeDef[] = [
  { id: 'members', label: 'Members', sublabel: 'profiles, contacts, freezes', icon: Users, accent: '#D9480F', metric: '143', unit: 'active' },
  { id: 'plans', label: 'Memberships', sublabel: 'monthly, annual, freeze', icon: Layers, accent: '#F97316', metric: '6', unit: 'plans' },
  { id: 'billing', label: 'Payments', sublabel: 'UPI, cash, GST receipts', icon: CreditCard, accent: '#D9480F', metric: '₹4.5L', unit: 'this month' },
  { id: 'checkin', label: 'QR Check-in', sublabel: 'instant phone or scan', icon: QrCode, accent: '#F97316', metric: '28', unit: 'today' },
  { id: 'reports', label: 'Reports', sublabel: 'revenue, dues, exports', icon: BarChart3, accent: '#D9480F', metric: '97%', unit: 'collected' },
];

/* ─── Animated SVG connecting line ─── */
const AnimatedLine: React.FC<{ x1: number; y1: number; x2: number; y2: number; delay: number }> = ({
  x1, y1, x2, y2, delay,
}) => {
  const controls = useAnimation();
  const ref = useRef<SVGLineElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    controls.start({
      pathLength: [0, 1],
      opacity: [0, 1],
      transition: { pathLength: { duration: 1.2, delay, ease: 'easeInOut' }, opacity: { duration: 0.1 } },
    });
  }, [inView, controls, delay]);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <line
        x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
        stroke="url(#line-gradient)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        strokeOpacity="0.5"
      />
      <defs>
        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D9480F" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/* ─── Single module node ─── */
const ModuleNode: React.FC<{ node: NodeDef; index: number; delay: number }> = ({ node, index, delay }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const Icon = node.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.88, y: 16 }}
      animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col items-center text-center gap-3 p-5 rounded-2xl border border-(--line) bg-(--surface) hover:border-(--iron)/40 hover:shadow-lg hover:shadow-(--iron)/8 transition-all duration-300 cursor-default"
    >
      {/* Pulse dot */}
      <span
        className="absolute -top-1.5 -right-1.5 size-3 rounded-full animate-ping opacity-60"
        style={{ backgroundColor: node.accent }}
      />

      {/* Icon circle */}
      <div
        className="size-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: `${node.accent}18`, color: node.accent }}
      >
        <Icon size={22} strokeWidth={1.5} />
      </div>

      {/* Label */}
      <div>
        <p className="text-[13px] font-bold text-ink">{node.label}</p>
        <p className="text-[10px] text-ink-3 mt-0.5">{node.sublabel}</p>
      </div>

      {/* Metric */}
      <div
        className="px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono"
        style={{ backgroundColor: `${node.accent}12`, color: node.accent }}
      >
        {node.metric} <span className="opacity-70 font-normal">{node.unit}</span>
      </div>

      {/* Step number */}
      <span className="absolute top-2 left-2 text-[9px] font-mono text-ink-3/40 font-semibold">
        {String(index + 1).padStart(2, '0')}
      </span>
    </motion.div>
  );
};

/* ─── Central hub ─── */
const CentralHub: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 shadow-xl shadow-(--iron)/15"
      style={{
        background: 'linear-gradient(135deg, var(--ink) 0%, #1a1a1a 100%)',
        borderColor: 'var(--iron)',
      }}
    >
      {/* Animated ring */}
      <span
        className="absolute inset-0 rounded-2xl animate-pulse opacity-20"
        style={{ boxShadow: '0 0 32px 8px rgba(217,72,15,0.3)' }}
      />

      <div
        className="size-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--iron)', color: 'var(--iron-ink)' }}
      >
        <LayoutDashboard size={26} strokeWidth={1.5} />
      </div>

      <div className="text-center">
        <p className="text-[13px] font-bold" style={{ color: 'var(--iron-ink)' }}>
          Owner Dashboard
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Everything connected
        </p>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Live</span>
      </div>
    </motion.div>
  );
};

export const GymOSFlow: React.FC = () => {
  return (
    <section id="product" className="py-24 sm:py-32 border-t border-(--line) bg-(--surface) overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">One software, end to end</p>
          <h2 className="text-h1 sm:text-display-serif-sm text-ink mt-3">
            The gym operating system.
          </h2>
          <p className="text-body text-ink-2 mt-4">
            Every module feeds into the same dashboard — no switching between apps, no manual tallying.
          </p>
        </motion.div>

        {/* Connected graph layout */}
        <div className="relative max-w-4xl mx-auto">

          {/* SVG connector lines (behind the cards) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block"
            style={{ overflow: 'visible', zIndex: 0 }}
          >
            <defs>
              <linearGradient id="lg-left" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D9480F" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#D9480F" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="lg-right" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0.6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Row 1: Members → Hub → Memberships */}
          <div className="relative grid grid-cols-3 gap-4 items-center mb-4">
            <ModuleNode node={NODES[0]} index={0} delay={0.05} />
            <CentralHub />
            <ModuleNode node={NODES[1]} index={1} delay={0.1} />
          </div>

          {/* Connector arrows */}
          <div className="relative grid grid-cols-3 gap-4 items-center mb-4">
            {/* Dashed lines going down */}
            <div className="col-start-1 flex justify-end">
              <svg width="20" height="40" className="text-(--iron)/40">
                <line x1="10" y1="0" x2="10" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                <polygon points="10,40 6,32 14,32" fill="currentColor" />
              </svg>
            </div>
            <div />
            <div className="col-start-3 flex justify-start">
              <svg width="20" height="40" className="text-orange-400/40">
                <line x1="10" y1="0" x2="10" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                <polygon points="10,40 6,32 14,32" fill="currentColor" />
              </svg>
            </div>
          </div>

          {/* Row 2: Billing ← Hub → Attendance */}
          <div className="relative grid grid-cols-3 gap-4 items-center mb-4">
            <ModuleNode node={NODES[2]} index={2} delay={0.15} />
            <div /> {/* Hub already rendered above — but we want hub in center row 1 */}
            <ModuleNode node={NODES[3]} index={3} delay={0.2} />
          </div>

          {/* Connector down from hub */}
          <div className="relative grid grid-cols-3 gap-4 items-center">
            <div />
            <div className="flex flex-col items-center">
              <svg width="20" height="40" className="text-(--iron)/40">
                <line x1="10" y1="0" x2="10" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                <polygon points="10,40 6,32 14,32" fill="currentColor" />
              </svg>
            </div>
            <div />
          </div>

          {/* Row 3: Reports — centered below hub */}
          <div className="relative grid grid-cols-3 gap-4 items-center mt-4">
            <div />
            <ModuleNode node={NODES[4]} index={4} delay={0.25} />
            <div />
          </div>

        </div>
      </div>
    </section>
  );
};
