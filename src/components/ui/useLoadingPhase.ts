import { useEffect, useState } from 'react';

import { useMotion } from '../../lib/motion';

export type LoadingPhase = 'idle' | 'loading' | 'timeout';

/**
 * Loading phases for a first load: 'idle' for the first `loadingDelay` (300ms, draw nothing), then
 * 'loading' (show <PageLoading />), then 'timeout' after `loadingTimeout` (10s): the caller swaps in the
 * E4 error (<EmptyState variant="error" />) while the request keeps running. Pass `loading=false` when the
 * data arrives (phase returns to 'idle', so a late success replaces E4 with content). A retry flips
 * `loading` false -> true and the 300ms delay starts over.
 */
export function useLoadingPhase(loading: boolean): LoadingPhase {
  const { duration } = useMotion();
  const [phase, setPhase] = useState<LoadingPhase>('idle');
  useEffect(() => {
    if (!loading) {
      setPhase('idle');
      return undefined;
    }
    const a = setTimeout(() => setPhase('loading'), duration.loadingDelay);
    const b = setTimeout(() => setPhase('timeout'), duration.loadingTimeout);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [loading, duration.loadingDelay, duration.loadingTimeout]);
  return phase;
}

/** @deprecated use `useLoadingPhase` ('loading' replaces 'skeleton'). Kept one version for the old call sites. */
export function useSkeletonPhase(loading: boolean): 'idle' | 'skeleton' | 'timeout' {
  const phase = useLoadingPhase(loading);
  return phase === 'loading' ? 'skeleton' : phase;
}
