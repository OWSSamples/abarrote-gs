'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublicDisplayConfig } from '@/app/actions/store-config-actions';
import { CustomerDisplayView } from '@/components/customer-display/CustomerDisplayView';
import {
  EMPTY_CUSTOMER_DISPLAY_SALE,
  parseCustomerDisplayMessage,
  parseCustomerDisplaySale,
} from '@/components/customer-display/customer-display.types';
import { getCustomerDisplayChannelName } from '@/lib/customer-display-channel';
import { DEFAULT_PUBLIC_DISPLAY_CONFIG } from '@/lib/store-config-public';
import type { PublicDisplayConfig } from '@/lib/store-config-public';

type DisplayLoadState = 'loading' | 'ready' | 'error';

interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  release: () => Promise<void>;
}

interface WakeLockNavigator extends Navigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

export default function CustomerDisplayPage() {
  const [storeConfig, setStoreConfig] = useState<PublicDisplayConfig>(DEFAULT_PUBLIC_DISPLAY_CONFIG);
  const [displayStoreId, setDisplayStoreId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<DisplayLoadState>('loading');
  const [sale, setSale] = useState(EMPTY_CUSTOMER_DISPLAY_SALE);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const mountedRef = useRef(true);

  const loadConfig = useCallback(async (expectedStoreId?: string, showLoading = true) => {
    if (showLoading) setLoadState('loading');

    try {
      const context = await fetchPublicDisplayConfig();
      if (!mountedRef.current || (expectedStoreId && context.storeId !== expectedStoreId)) return;

      setDisplayStoreId(context.storeId);
      setStoreConfig(context.config);
      setLoadState('ready');
    } catch {
      if (mountedRef.current && showLoading) setLoadState('error');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadConfig();

    return () => {
      mountedRef.current = false;
    };
  }, [loadConfig]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(
        now.toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      );
    };

    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!displayStoreId || typeof BroadcastChannel === 'undefined') return;

    const displayId = crypto.randomUUID();
    const channel = new BroadcastChannel(getCustomerDisplayChannelName(displayStoreId));

    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = parseCustomerDisplayMessage(event.data);
      if (!message) return;

      if (message.type === 'UPDATE_SALE' || message.type === 'TEST_SALE') {
        const parsedSale = parseCustomerDisplaySale(message.payload);
        if (parsedSale) setSale(parsedSale);
        return;
      }

      if (message.type === 'UPDATE_CONFIG') {
        void loadConfig(displayStoreId, false);
        return;
      }

      if (message.type === 'PING') {
        channel.postMessage({ type: 'PONG', payload: { displayId, at: Date.now() } });
      }
    };

    channel.postMessage({ type: 'PONG', payload: { displayId, at: Date.now() } });
    return () => channel.close();
  }, [displayStoreId, loadConfig]);

  const autoReturnMs = Math.min(
    60_000,
    Math.max(2_000, (Number(storeConfig.customerDisplayAutoReturnSec) || 6) * 1000),
  );
  useEffect(() => {
    if (sale.status !== 'finished') return;

    const timer = window.setTimeout(() => setSale(EMPTY_CUSTOMER_DISPLAY_SALE), autoReturnMs);
    return () => window.clearTimeout(timer);
  }, [sale.status, autoReturnMs]);

  const previousSaleStatusRef = useRef(sale.status);
  useEffect(() => {
    if (
      storeConfig.customerDisplaySoundEnabled &&
      previousSaleStatusRef.current === 'idle' &&
      sale.status === 'active'
    ) {
      try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.frequency.value = 740;
        gain.gain.value = 0.18;
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.14);
        oscillator.stop(audioContext.currentTime + 0.14);
        window.setTimeout(() => void audioContext.close(), 250);
      } catch {
        // Audio feedback is optional and may be blocked by the browser.
      }
    }

    previousSaleStatusRef.current = sale.status;
  }, [sale.status, storeConfig.customerDisplaySoundEnabled]);

  useEffect(() => {
    const wakeLockNavigator = navigator as WakeLockNavigator;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      if (!wakeLockNavigator.wakeLock || document.visibilityState !== 'visible') return;
      try {
        const acquired = await wakeLockNavigator.wakeLock.request('screen');
        if (cancelled) {
          await acquired.release();
          return;
        }
        sentinel = acquired;
        acquired.addEventListener(
          'release',
          () => {
            if (sentinel === acquired) sentinel = null;
          },
          { once: true },
        );
      } catch {
        // The display remains functional when wake lock is unavailable.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void requestWakeLock();
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinel) void sentinel.release();
    };
  }, []);

  return (
    <CustomerDisplayView
      config={storeConfig}
      sale={sale}
      currentTime={currentTime}
      currentDate={currentDate}
      loadState={loadState}
      onRetry={() => void loadConfig()}
    />
  );
}
