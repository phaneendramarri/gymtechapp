/* =========================================================================
   MotionTokens — CSS motion token exports as JS constants for runtime use.
   Consumed by framer-motion transitions and any JS animation logic.
   ========================================================================= */

export const MOTION = {
  duration: {
    instant: 0.1,
    fast:     0.14,
    normal:   0.18,
    page:     0.22,
    slow:     0.28,
    drawer:   0.30,
  },
  ease: {
    outExpo:    [0.16, 1, 0.3, 1],
    inOutSoft:  [0.65, 0, 0.35, 1],
    spring:     [0.34, 1.56, 0.64, 1],
  },
  distance: {
    shift: 12,
    rise:  6,
  },
} as const;
