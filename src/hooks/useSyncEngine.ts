'use client';

/**
 * useSyncEngine — React hook that connects the online SyncEngine
 * to the Zustand dashboard store.
 *
 * What it does:
 * 1. Initializes SyncEngine on mount (visibility, BroadcastChannel, polling)
 * 2. Refreshes data after connectivity is restored
 * 3. Exposes sync status for UI
 * 4. Cleans up everything on unmount
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SyncEngine } from '@/lib/sync';
import type { SyncDomain, SyncStatus } from '@/lib/sync';
import { useDashboardStore } from '@/store/dashboardStore';

const INITIAL_STATUS: SyncStatus = {
  isOnline: true,
  lastSyncAt: 0,
  isStale: true,
  isSyncing: false,
  consecutiveErrors: 0,
  circuitOpen: false,
};

export function useSyncEngine(enabled: boolean = true) {
  const engineRef = useRef<SyncEngine | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(INITIAL_STATUS);
  const initialLoadDone = useRef(false);

  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  // Use refs for callbacks so the useEffect doesn't re-run when they change
  const fetchRef = useRef(fetchDashboardData);
  fetchRef.current = fetchDashboardData;

  // ── Initialize online engine on mount ──
  useEffect(() => {
    // Don't initialize until enabled (user is authenticated)
    if (!enabled) return;

    const engine = new SyncEngine({
      pollingIntervalMs: 30_000,
      staleThresholdMs: 45_000,
      channelName: 'pos-sync-v1',
      visibilityDebounceMs: 500,
      maxConsecutiveErrors: 5,
      circuitBreakerCooldownMs: 60_000,
    });

    engineRef.current = engine;

    engine.start(
      async () => {
        await fetchRef.current();
      },
      (status) => {
        setSyncStatus(status);
      },
    );

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void engine.forceRefresh('all');
    }

    const handleOnline = () => {
      void engine.forceRefresh('all');
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      engine.stop();
      engineRef.current = null;
      initialLoadDone.current = false;
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- callbacks use refs to avoid re-init loops

  // ── Exposed APIs ──

  /** Notify other tabs that a mutation happened in a domain */
  const notifyMutation = useCallback((domain: SyncDomain) => {
    engineRef.current?.notifyMutation(domain);
  }, []);

  /** Force immediate data refresh */
  const forceRefresh = useCallback(async (domain: SyncDomain = 'all') => {
    await engineRef.current?.forceRefresh(domain);
  }, []);

  return {
    syncStatus,
    notifyMutation,
    forceRefresh,
  };
}
