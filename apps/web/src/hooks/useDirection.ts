/* =========================================================================
   useDirection — tracks navigation direction for spatial page transitions.
   Returns 'forward' | 'back' based on route depth changes.
   ========================================================================= */

import { useLocation, useNavigationType } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getDirection } from '@/lib/motion';

export type Direction = 'forward' | 'back' | 'none';

/**
 * Tracks the direction of navigation.
 * - 'forward' = entering from right (deeper route, sibling)
 * - 'back'    = entering from left (shallower route, returning)
 * - 'none'    = initial load
 */
export function useDirection(): Direction {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevLocationRef = useRef<string>(location.pathname);
  const [direction, setDirection] = useState<Direction>('none');

  useEffect(() => {
    const from = prevLocationRef.current;
    const to = location.pathname;

    if (from === to) return;

    // POP (browser back/forward) — use stack-based inference
    if (navigationType === 'POP') {
      // For POP navigation, depth increase = forward, decrease = back
      const fromDepth = from.split('/').filter(Boolean).length;
      const toDepth = to.split('/').filter(Boolean).length;
      if (toDepth > fromDepth) setDirection('forward');
      else if (toDepth < fromDepth) setDirection('back');
      else setDirection('forward');
    } else {
      setDirection(getDirection(from, to));
    }

    prevLocationRef.current = to;
  }, [location.pathname, navigationType]);

  return direction;
}
