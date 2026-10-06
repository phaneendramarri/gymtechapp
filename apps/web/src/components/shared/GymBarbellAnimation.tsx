import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Heart, Activity, Dumbbell, Zap, Sparkles } from 'lucide-react';

interface GymBarbellAnimationProps {
  className?: string;
  variant?: 'compact' | 'full';
  interactive?: boolean;
}

const GYM_LIVE_EVENTS = [
  { icon: '🏋️‍♂️', tag: 'HEAVY SET', text: 'Vikram M. logged 140kg Deadlift PR', gym: 'Bangalore Central' },
  { icon: '⚡', tag: 'CHECK-IN', text: 'Sneha R. tapped in · Leg Day', gym: 'Indiranagar Floor' },
  { icon: '🔥', tag: 'ENERGY PEAK', text: 'Floor capacity at 88% · High Intensity', gym: 'Main Arena' },
  { icon: '🎯', tag: 'PT SESSION', text: 'Coach Karan completed Session #6 with Arjun', gym: 'Strength Zone' },
  { icon: '🥊', tag: 'SWEAT ZONE', text: 'HIIT Conditioning session starting in 10m', gym: 'Studio 2' },
];

export const GymBarbellAnimation: React.FC<GymBarbellAnimationProps> = ({
  className = '',
  variant = 'full',
  interactive = true,
}) => {
  const [repCount, setRepCount] = useState(14);
  const [isLifting, setIsLifting] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  const [burstParticles, setBurstParticles] = useState<number[]>([]);
  const [bpm, setBpm] = useState(136);

  // Rotate gym events ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setEventIndex((prev) => (prev + 1) % GYM_LIVE_EVENTS.length);
      setBpm((prev) => 130 + Math.floor(Math.sin(Date.now() / 3000) * 12) + Math.floor(Math.random() * 6));
    }, 4000);
    return () => clearInterval(ticker);
  }, []);

  const triggerRep = () => {
    if (isLifting) return;
    setIsLifting(true);
    setRepCount((prev) => prev + 1);
    setBurstParticles([Date.now(), Date.now() + 1, Date.now() + 2, Date.now() + 3]);

    setTimeout(() => {
      setIsLifting(false);
    }, 700);

    setTimeout(() => {
      setBurstParticles([]);
    }, 1200);
  };

  const currentEvent = GYM_LIVE_EVENTS[eventIndex];

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-(--line) bg-(--surface) text-(--ink) shadow-sm ${className}`}
    >
      {/* Background ambient lighting — warm iron gym glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-48 bg-orange-500/10 rounded-full blur-3xl" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative p-4 sm:p-5 flex flex-col justify-between h-full z-10 gap-3 sm:gap-4">
        {/* Header: Live Gym Energy & BPM */}
        <div className="flex items-center justify-between border-b border-(--line) pb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-iron opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-iron shadow-[0_0_8px_#f97316]" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-(--iron) flex items-center gap-1 font-mono">
              <Zap className="size-3 fill-(--iron)" /> Live Gym Floor
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Heart rate & Audio / Energy pulse visualizer */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-(--surface-2) border border-(--line) text-[10px] font-mono text-(--ink-2)">
              <Heart className="size-2.5 text-red-500 fill-red-500/80 animate-bounce" />
              <span className="font-bold text-(--ink)">{bpm}</span>
              <span className="text-(--ink-3) text-[9px]">BPM</span>
            </div>

            {/* Sound / workout equalizer bars */}
            <div className="hidden sm:flex items-end gap-0.5 h-3 px-1.5 py-0.5 bg-(--surface-2) border border-(--line) rounded">
              {[0.4, 0.9, 0.6, 1.0, 0.7, 0.3].map((height, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-gradient-to-t from-orange-500 to-amber-300 rounded-full"
                  animate={{ height: [`${height * 20}%`, `${height * 100}%`, `${height * 40}%`] }}
                  transition={{ duration: 0.8 + i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Center: The Olympic Barbell & Weight Plates Animation */}
        <div className="relative py-1 flex flex-col items-center justify-center">
          {/* Burst particles on rep */}
          <AnimatePresence>
            {burstParticles.map((id, index) => (
              <motion.div
                key={id}
                initial={{ opacity: 1, scale: 0, x: (index - 1.5) * 40, y: 0 }}
                animate={{
                  opacity: 0,
                  scale: 1.4,
                  y: -60 - index * 15,
                  x: (index - 1.5) * 70,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
                className="absolute pointer-events-none z-30"
              >
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-[10px] font-mono font-bold text-orange-300 shadow-[0_0_12px_rgba(251,146,60,0.4)]">
                  <Sparkles className="size-2.5 text-amber-300" />
                  +1 REP
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Barbell Container */}
          <motion.div
            className="w-full max-w-[340px] sm:max-w-[400px] flex flex-col items-center cursor-pointer select-none group"
            onClick={interactive ? triggerRep : undefined}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {/* The Animated Barbell SVG */}
            <motion.div
              animate={
                isLifting
                  ? { y: [-4, -38, -4], rotate: [-0.5, 0.5, 0] }
                  : { y: [0, -10, 0], rotate: [0, -0.2, 0.2, 0] }
              }
              transition={
                isLifting
                  ? { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
                  : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
              }
              className="relative w-full flex justify-center py-2"
            >
              <svg
                viewBox="0 0 380 90"
                className="w-full h-auto drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] filter"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Steel knurled bar gradient */}
                  <linearGradient id="barSteel" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d6d3d1" />
                    <stop offset="40%" stopColor="#f5f5f4" />
                    <stop offset="60%" stopColor="#78716c" />
                    <stop offset="100%" stopColor="#292524" />
                  </linearGradient>

                  {/* Cast iron bumper plates gradient */}
                  <linearGradient id="ironPlate" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1c1917" />
                    <stop offset="30%" stopColor="#292524" />
                    <stop offset="70%" stopColor="#44403c" />
                    <stop offset="100%" stopColor="#1c1917" />
                  </linearGradient>

                  {/* Olympic Competition 20kg Plate (Blue / Iron) */}
                  <linearGradient id="compPlate" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ea580c" />
                    <stop offset="50%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#c2410c" />
                  </linearGradient>

                  {/* Collar chrome sheen */}
                  <linearGradient id="collarChrome" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a8a29e" />
                    <stop offset="50%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#78716c" />
                  </linearGradient>
                </defs>

                {/* ── Main Olympic Bar Shaft (28mm / 2200mm) ── */}
                <rect x="52" y="42" width="276" height="6" rx="3" fill="url(#barSteel)" />

                {/* Center knurling textured grips */}
                <rect x="110" y="42" width="55" height="6" fill="#a8a29e" opacity="0.4" />
                <rect x="215" y="42" width="55" height="6" fill="#a8a29e" opacity="0.4" />
                {/* Center ring marker */}
                <line x1="190" y1="41" x2="190" y2="49" stroke="#fb923c" strokeWidth="1.5" />

                {/* ── LEFT SLEEVE & PLATES ── */}
                {/* Sleeve */}
                <rect x="12" y="41" width="40" height="8" rx="2" fill="url(#barSteel)" />
                {/* Inner Stop Collar */}
                <rect x="52" y="34" width="6" height="22" rx="2" fill="url(#collarChrome)" />

                {/* Big 25kg Olympic Plate */}
                <rect x="36" y="8" width="13" height="74" rx="3" fill="url(#compPlate)" stroke="#7c2d12" strokeWidth="1" />
                <rect x="39" y="14" width="7" height="62" rx="2" fill="#9a3412" opacity="0.6" />
                <text x="42.5" y="48" fontSize="7" fontWeight="bold" fill="#ffedd5" textAnchor="middle" transform="rotate(-90 42.5 48)">
                  25KG
                </text>

                {/* Second 20kg Cast Iron Plate */}
                <rect x="23" y="14" width="11" height="62" rx="3" fill="url(#ironPlate)" stroke="#57534e" strokeWidth="1" />
                <rect x="25" y="19" width="7" height="52" rx="2" fill="#292524" />
                <text x="28.5" y="48" fontSize="6" fontWeight="bold" fill="#a8a29e" textAnchor="middle" transform="rotate(-90 28.5 48)">
                  20KG
                </text>

                {/* Outer Collar Lock */}
                <rect x="14" y="36" width="7" height="18" rx="2" fill="url(#collarChrome)" />
                <circle cx="17.5" cy="45" r="2" fill="#ea580c" />

                {/* ── RIGHT SLEEVE & PLATES ── */}
                {/* Sleeve */}
                <rect x="328" y="41" width="40" height="8" rx="2" fill="url(#barSteel)" />
                {/* Inner Stop Collar */}
                <rect x="322" y="34" width="6" height="22" rx="2" fill="url(#collarChrome)" />

                {/* Big 25kg Olympic Plate */}
                <rect x="331" y="8" width="13" height="74" rx="3" fill="url(#compPlate)" stroke="#7c2d12" strokeWidth="1" />
                <rect x="334" y="14" width="7" height="62" rx="2" fill="#9a3412" opacity="0.6" />
                <text x="337.5" y="48" fontSize="7" fontWeight="bold" fill="#ffedd5" textAnchor="middle" transform="rotate(90 337.5 48)">
                  25KG
                </text>

                {/* Second 20kg Cast Iron Plate */}
                <rect x="346" y="14" width="11" height="62" rx="3" fill="url(#ironPlate)" stroke="#57534e" strokeWidth="1" />
                <rect x="348" y="19" width="7" height="52" rx="2" fill="#292524" />
                <text x="351.5" y="48" fontSize="6" fontWeight="bold" fill="#a8a29e" textAnchor="middle" transform="rotate(90 351.5 48)">
                  20KG
                </text>

                {/* Outer Collar Lock */}
                <rect x="359" y="36" width="7" height="18" rx="2" fill="url(#collarChrome)" />
                <circle cx="362.5" cy="45" r="2" fill="#ea580c" />
              </svg>
            </motion.div>

            {/* Floor shadow under barbell that expands/shrinks as bar lifts */}
            <motion.div
              animate={
                isLifting
                  ? { width: ['60%', '35%', '60%'], opacity: [0.6, 0.2, 0.6] }
                  : { width: ['60%', '52%', '60%'], opacity: [0.6, 0.45, 0.6] }
              }
              transition={
                isLifting
                  ? { duration: 0.65 }
                  : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
              }
              className="h-2 bg-ink/15 dark:bg-black/80 rounded-full blur-xs mx-auto -mt-1"
            />
          </motion.div>

          {/* Interactive Reps / Volume Bar */}
          <div className="mt-2 flex items-center justify-between w-full max-w-xs px-2">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-mono tracking-widest text-ink-3">Total Reps</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black font-mono tracking-tight text-ink">
                  {repCount}
                </span>
                <span className="text-[10px] font-semibold text-iron">REPS</span>
              </div>
            </div>

            {interactive && (
              <button
                type="button"
                onClick={triggerRep}
                className="group relative px-3 py-1.5 rounded-lg bg-iron hover:bg-orange-500 text-white text-[11px] font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border border-iron/30"
              >
                <Dumbbell className="size-3 group-hover:rotate-45 transition-transform" />
                <span>Tap to Lift</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer: Live Gym Activity Ticker */}
        <div className="rounded-xl bg-surface-2 border border-line p-2.5 flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-iron-soft border border-iron/20 flex items-center justify-center text-sm shrink-0">
            {currentEvent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-iron-soft text-iron">
                {currentEvent.tag}
              </span>
              <span className="text-[9px] text-ink-3 font-mono truncate">{currentEvent.gym}</span>
            </div>
            <p className="text-[11px] font-medium text-ink truncate">{currentEvent.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
