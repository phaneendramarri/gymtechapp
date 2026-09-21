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
  { id: 'members', label: 'Members', sublabel: 'profiles, contacts, freezes', icon: Users, accent: '#FB923C', metric: '143', unit: 'active' },
  { id: 'plans', label: 'Memberships', sublabel: 'monthly, annual, freeze', icon: Layers, accent: '#FB923C', metric: '6', unit: 'plans' },
  { id: 'billing', label: 'Payments', sublabel: 'UPI, cash, GST receipts', icon: CreditCard, accent: '#FB923C', metric: '₹4.5L', unit: 'this month' },
  { id: 'checkin', label: 'QR Check-in', sublabel: 'instant phone or scan', icon: QrCode, accent: '#FB923C', metric: '28', unit: 'today' },
  { id: 'reports', label: 'Reports', sublabel: 'revenue, dues, exports', icon: BarChart3, accent: '#FB923C', metric: '97%', unit: 'collected' },
];

/* ─── Vercel-style Animated Flow Arrow / Moving Thread ─── */
interface FlowArrowProps {
  direction?: 'down' | 'right' | 'left';
  length?: number;
  className?: string;
  delay?: number;
}

const AnimatedFlowArrow: React.FC<FlowArrowProps> = ({
  direction = 'down',
  length = 42,
  className = '',
  delay = 0,
}) => {
  const id = React.useId();
  const filterId = `beam-glow-${id.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (direction === 'down') {
    return (
      <div className={`relative flex flex-col items-center justify-center ${className}`}>
        <svg
          width="24"
          height={length}
          viewBox={`0 0 24 ${length}`}
          className="overflow-visible text-iron"
          aria-hidden="true"
        >
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Static background dashed guide */}
          <line
            x1="12"
            y1="0"
            x2="12"
            y2={length - 8}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity="0.25"
            strokeDasharray="4 3"
          />

          {/* Animated flowing dashed thread (Vercel moving threads effect) */}
          <line
            x1="12"
            y1="0"
            x2="12"
            y2={length - 8}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            strokeOpacity="0.85"
            className="gt-flow-dash-y"
          />

          {/* Travelling light pulse / packet */}
          <circle
            cx="12"
            cy="0"
            r="2.5"
            fill="var(--iron)"
            filter={`url(#${filterId})`}
          >
            <animate
              attributeName="cy"
              values={`0;${length - 8}`}
              dur="1.8s"
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.95;0.95;0"
              keyTimes="0;0.15;0.85;1"
              dur="1.8s"
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
          </circle>

          {/* Arrowhead */}
          <polygon
            points={`12,${length} 7.5,${length - 7.5} 16.5,${length - 7.5}`}
            fill="currentColor"
            className="gt-pulse-arrow"
          />
        </svg>
      </div>
    );
  }

  const isRight = direction === 'right';
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        width={length}
        height="24"
        viewBox={`0 0 ${length} 24`}
        className="overflow-visible text-iron"
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Static background dashed guide */}
        <line
          x1={isRight ? 0 : length}
          y1="12"
          x2={isRight ? length - 8 : 8}
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.25"
          strokeDasharray="4 3"
        />

        {/* Animated flowing dashed thread */}
        <line
          x1={isRight ? 0 : length}
          y1="12"
          x2={isRight ? length - 8 : 8}
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          strokeOpacity="0.85"
          className={isRight ? 'gt-flow-dash-x-right' : 'gt-flow-dash-x-left'}
        />

        {/* Travelling light pulse / packet */}
        <circle
          cx={isRight ? 0 : length}
          cy="12"
          r="2.5"
          fill="var(--iron)"
          filter={`url(#${filterId})`}
        >
          <animate
            attributeName="cx"
            values={isRight ? `0;${length - 8}` : `${length};8`}
            dur="1.8s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.95;0.95;0"
            keyTimes="0;0.15;0.85;1"
            dur="1.8s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        </circle>

        {/* Arrowhead */}
        <polygon
          points={
            isRight
              ? `${length},12 ${length - 7.5},7.5 ${length - 7.5},16.5`
              : `0,12 7.5,7.5 7.5,16.5`
          }
          fill="currentColor"
          className="gt-pulse-arrow"
        />
      </svg>
    </div>
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
      className="group relative flex flex-col items-center text-center gap-3 p-5 rounded-2xl border border-line bg-surface hover:border-iron/40 hover:shadow-lg hover:shadow-iron/8 transition-all duration-300 cursor-default"
    >
      {/* Status dot with pulsing live ripple */}
      <span className="absolute -top-1 -right-1 flex size-2.5" aria-hidden="true">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-65"
          style={{ backgroundColor: node.accent }}
        />
        <span
          className="relative inline-flex size-2.5 rounded-full"
          style={{ backgroundColor: node.accent, boxShadow: `0 0 0 3px ${node.accent}26` }}
        />
      </span>

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
      className="relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 shadow-xl shadow-iron/15"
      style={{
        background: 'linear-gradient(135deg, var(--ink) 0%, #1a1a1a 100%)',
        borderColor: 'var(--iron)',
      }}
    >
      {/* Animated ring */}
      <span
        className="absolute inset-0 rounded-2xl gt-glow-breathe"
        style={{ boxShadow: '0 0 32px 8px rgba(251,146,60,0.3)' }}
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

      {/* Live indicator with pulsing radar */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-positive shadow-[0_0_0_2px_var(--positive-soft)]" />
        </span>
        <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Live</span>
      </div>
    </motion.div>
  );
};

export const GymOSFlow: React.FC = () => {
  return (
    <section id="product" className="py-24 sm:py-32 border-t border-line bg-surface overflow-hidden">
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

          {/* Row 1: Members → Hub → Memberships */}
          <div className="relative grid grid-cols-3 gap-4 items-center mb-2">
            <ModuleNode node={NODES[0]} index={0} delay={0.05} />
            <CentralHub />
            <ModuleNode node={NODES[1]} index={1} delay={0.1} />
          </div>

          {/* Connector arrows — flowing down to Row 2 */}
          <div className="relative grid grid-cols-3 gap-4 items-center my-2">
            {/* Dashed flowing line going down from Members */}
            <div className="col-start-1 flex justify-center">
              <AnimatedFlowArrow direction="down" length={44} delay={0} />
            </div>
            {/* Center flowing down from Hub to middle pipeline */}
            <div className="col-start-2 flex justify-center">
              <AnimatedFlowArrow direction="down" length={44} delay={0.3} />
            </div>
            {/* Dashed flowing line going down from Memberships */}
            <div className="col-start-3 flex justify-center">
              <AnimatedFlowArrow direction="down" length={44} delay={0.6} />
            </div>
          </div>

          {/* Row 2: Billing ← Sync Pipeline → Attendance */}
          <div className="relative grid grid-cols-3 gap-4 items-center mb-2">
            <ModuleNode node={NODES[2]} index={2} delay={0.15} />
            {/* Central real-time sync node */}
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-line bg-surface-2/70 text-center gap-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-iron">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-iron opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-iron" />
                </span>
                <span>Auto-Sync Pipeline</span>
              </div>
              <p className="text-[10px] text-ink-3">Instant automated reconciliation</p>
            </div>
            <ModuleNode node={NODES[3]} index={3} delay={0.2} />
          </div>

          {/* Connector down to Reports */}
          <div className="relative grid grid-cols-3 gap-4 items-center my-2">
            <div />
            <div className="flex flex-col items-center justify-center">
              <AnimatedFlowArrow direction="down" length={44} delay={0.4} />
            </div>
            <div />
          </div>

          {/* Row 3: Reports — centered below hub */}
          <div className="relative grid grid-cols-3 gap-4 items-center mt-2">
            <div />
            <ModuleNode node={NODES[4]} index={4} delay={0.25} />
            <div />
          </div>

        </div>
      </div>
    </section>
  );
};
