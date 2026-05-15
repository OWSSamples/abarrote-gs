'use client';

import { useState, useEffect, useCallback } from 'react';
import { breakpoint } from '../tokens';

type BreakpointKey = keyof typeof breakpoint;

/**
 * Returns the current active breakpoint and boolean helpers.
 *
 * @example
 * const { isMobile, isDesktop, current } = useBreakpoint();
 */
export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : breakpoint.desktop,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint.tablet - 1}px)`);

    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const current: BreakpointKey =
    width < breakpoint.mobile
      ? 'mobile'
      : width < breakpoint.tablet
        ? 'tablet'  // keep this label even though we named the key "tablet"
        : width < breakpoint.desktop
          ? 'tablet'
          : width < breakpoint.wide
            ? 'desktop'
            : 'wide';

  return {
    width,
    current,
    isMobile: width < breakpoint.tablet,
    isTablet: width >= breakpoint.tablet && width < breakpoint.desktop,
    isDesktop: width >= breakpoint.desktop,
    isWide: width >= breakpoint.wide,
  } as const;
}
