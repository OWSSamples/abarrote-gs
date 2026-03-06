'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@shopify/polaris';
import { offlineQueue } from '@/lib/offline';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setPendingCount(offlineQueue.getPendingCount());
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
      <Banner tone={isOnline ? 'info' : 'warning'}>
        {isOnline
          ? `Sincronizando ${pendingCount} operaciones pendientes...`
          : 'Sin conexión. Las operaciones se guardarán localmente.'}
      </Banner>
    </div>
  );
}
