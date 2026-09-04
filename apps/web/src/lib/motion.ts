/* =========================================================================
   GymTech OS — Motion Primitives.
   Reusable framer-motion variants and helpers.
   All components consume these — one coherent motion language.
   ========================================================================= */

import type { Variants, Transition } from 'framer-motion';

/* ---------------------------------------------------------------------------
   Easing curves — map CSS tokens to framer-motion.
   --------------------------------------------------------------------------- */
export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  inOutSoft: [0.65, 0, 0.35, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
};

/* ---------------------------------------------------------------------------
   Duration — map CSS tokens to ms.
   --------------------------------------------------------------------------- */
export const DURATION = {
  instant: 0.1,
  fast:     0.14,
  normal:   0.18,
  page:     0.22,
  slow:     0.28,
  drawer:   0.30,
};

/* ---------------------------------------------------------------------------
   Page transition variants — spatial forward / back / fade.
   --------------------------------------------------------------------------- */

/** Forward enter: content slides in from the right */
export const pageEnterForward: Variants = {
  initial:   { opacity: 0, x: 12 },
  animate:   { opacity: 1, x: 0 },
  exit:      { opacity: 0, x: -8 },
};

/** Back enter: content slides in from the left (returning) */
export const pageEnterBack: Variants = {
  initial:   { opacity: 0, x: -12 },
  animate:   { opacity: 1, x: 0 },
  exit:      { opacity: 0, x: 8 },
};

/** Simple fade — used for modals, overlays, dialogs */
export const fadeVariants: Variants = {
  initial:   { opacity: 0 },
  animate:   { opacity: 1 },
  exit:      { opacity: 0 },
};

/** Fade + rise — general content reveal */
export const fadeRiseVariants: Variants = {
  initial:   { opacity: 0, y: 6 },
  animate:   { opacity: 1, y: 0 },
  exit:      { opacity: 0, y: -4 },
};

/** Dialog — scale + rise from center */
export const dialogVariants: Variants = {
  initial:   { opacity: 0, scale: 0.97, y: 6 },
  animate:   { opacity: 1, scale: 1, y: 0 },
  exit:      { opacity: 0, scale: 0.97, y: -4 },
};

/** Drawer — slides from right */
export const drawerVariants: Variants = {
  initial:   { x: '100%' },
  animate:   { x: 0 },
  exit:      { x: '100%' },
};

/** Drawer overlay */
export const drawerOverlayVariants: Variants = {
  initial:   { opacity: 0 },
  animate:   { opacity: 1 },
  exit:      { opacity: 0 },
};

/** List item — stagger enter */
export const listItemVariants: Variants = {
  initial:   { opacity: 0, y: 8 },
  animate:   { opacity: 1, y: 0 },
  exit:      { opacity: 0, y: -4 },
};

/** Stagger container for list children */
export const listStaggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

/** Toast — subtle rise from bottom-right */
export const toastVariants: Variants = {
  initial:   { opacity: 0, y: 8, scale: 0.98 },
  animate:   { opacity: 1, y: 0, scale: 1 },
  exit:      { opacity: 0, y: 4, scale: 0.98 },
};

/** Highlight flash — for list item after mutation */
export const highlightVariants: Variants = {
  initial:   { backgroundColor: 'var(--iron-soft)' },
  animate:   { backgroundColor: 'transparent' },
};

/** Shared layout — connector line for shared element transitions */
export const layoutConnectorVariants: Variants = {
  initial:   { scaleX: 0, opacity: 0 },
  animate:   { scaleX: 1, opacity: 1 },
  exit:      { scaleX: 0, opacity: 0 },
};

/* ---------------------------------------------------------------------------
   Transitions — default transitions per motion type.
   --------------------------------------------------------------------------- */

export const pageTransition: Transition = {
  duration: DURATION.page,
  ease: EASE.outExpo,
};

export const fastTransition: Transition = {
  duration: DURATION.fast,
  ease: EASE.outExpo,
};

export const slowTransition: Transition = {
  duration: DURATION.slow,
  ease: EASE.inOutSoft,
};

export const dialogTransition: Transition = {
  duration: DURATION.normal,
  ease: EASE.outExpo,
};

export const drawerTransition: Transition = {
  duration: DURATION.drawer,
  ease: EASE.outExpo,
};

export const toastTransition: Transition = {
  duration: DURATION.fast,
  ease: EASE.outExpo,
};

/* ---------------------------------------------------------------------------
   Direction helper — determine forward/back from navigation history.
   --------------------------------------------------------------------------- */

/** Tracks navigation direction for spatial page transitions.
 *  Returns 'forward' | 'back' | 'none'.
 *
 *  Usage:
 *    const direction = useDirection();
 *    const variants = direction === 'back' ? pageEnterBack : pageEnterForward;
 */
export function getDirection(from: string, to: string): 'forward' | 'back' | 'none' {
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);

  // Same root depth — treat as sibling navigation (forward by default)
  if (fromParts[0] === toParts[0]) return 'forward';

  // Going deeper — forward
  if (toParts.length > fromParts.length) return 'forward';

  // Going shallower — back
  if (toParts.length < fromParts.length) return 'back';

  return 'forward';
}
