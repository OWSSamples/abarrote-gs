'use client';

/**
 * useSyncEngine — React hook that connects the SyncEngine + OfflineQueue
 * to the Zustand dashboard store.
 *
 * What it does:
 * 1. Initializes SyncEngine on mount (visibility, BroadcastChannel, polling)
 * 2. Initializes OfflineQueue (IDB-backed)
 * 3. On online event → triggers queue sync + data refresh
 * 4. Exposes sync status for UI (banners, indicators)
 * 5. Cleans up everything on unmount
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SyncEngine, OfflineQueue } from '@/lib/sync';
import type { SyncDomain, SyncStatus } from '@/lib/sync';
import { useDashboardStore } from '@/store/dashboardStore';

const INITIAL_STATUS: SyncStatus = {
  isOnline: true,
  lastSyncAt: 0,
  isStale: true,
  isSyncing: false,
  pendingOfflineOps: 0,
  consecutiveErrors: 0,
  circuitOpen: false,
};

export function useSyncEngine(enabled: boolean = true) {
  const engineRef = useRef<SyncEngine | null>(null);
  const queueRef = useRef<OfflineQueue | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(INITIAL_STATUS);
  const initialLoadDone = useRef(false);

  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  // Use refs for callbacks so the useEffect doesn't re-run when they change
  const fetchRef = useRef(fetchDashboardData);
  fetchRef.current = fetchDashboardData;

  // ── Initialize engine + queue on mount ──
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

    const queue = new OfflineQueue();
    let pendingInterval: ReturnType<typeof setInterval> | null = null;
    let aborted = false;

    engineRef.current = engine;
    queueRef.current = queue;

    // Initialize IDB queue, then start engine
    queue.init().then(() => {
      // If component unmounted before init completed, don't start engine
      if (aborted) return;

      engine.start(
        async (domain) => { await fetchRef.current(); },
        (status) => { setSyncStatus(status); },
      );

      // Initial data load — only once per mount, after engine starts
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        engine.forceRefresh('all');
      }

      // Sync any pending offline operations immediately
      if (navigator.onLine) {
        queue.sync().then(({ remaining }) => {
          setSyncStatus((prev) => ({ ...prev, pendingOfflineOps: remaining }));
        });
      }

      // Periodically update pending ops count
      pendingInterval = setInterval(async () => {
        const count = await queue.getPendingCount();
        setSyncStatus((prev) => {
          if (prev.pendingOfflineOps === count) return prev;
          return { ...prev, pendingOfflineOps: count };
        });
      }, 5_000);
    });

    // Online listener to trigger queue sync
    const handleOnline = () => {
      queue.sync().then(({ remaining }) => {
        setSyncStatus((prev) => ({ ...prev, pendingOfflineOps: remaining }));
      });
    };
    window.addEventListener('online', handleOnline);

    return () => {
      aborted = true;
      window.removeEventListener('online', handleOnline);
      if (pendingInterval) clearInterval(pendingInterval);
      engine.stop();
      queue.destroy();
      engineRef.current = null;
      queueRef.current = null;
      initialLoadDone.current = false;
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- callbacks use refs to avoid re-init loops

  // ── Exposed APIs ──

  /** Notify other tabs that a mutation happened in a domain */
  const notifyMutation = useCallback((domain: SyncDomain) => {
    engineRef.current?.notifyMutation(domain);
  }, []);

  /** Enqueue an operation for offline sync (when offline) */
  const enqueueOffline = useCallback(async (action: string, payload: unknown): Promise<string | null> => {
    if (!queueRef.current) return null;
    return queueRef.current.enqueue(action, payload);
  }, []);

  /** Force immediate data refresh */
  const forceRefresh = useCallback(async (domain: SyncDomain = 'all') => {
    await engineRef.current?.forceRefresh(domain);
  }, []);

  return {
    syncStatus,
    notifyMutation,
    enqueueOffline,
    forceRefresh,
  };
}
