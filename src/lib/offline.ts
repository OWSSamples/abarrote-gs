'use client';

type PendingAction = {
  id: string;
  action: string;
  payload: any;
  timestamp: number;
};

class OfflineQueue {
  private queue: PendingAction[] = [];
  private storageKey = 'offline_queue';

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadQueue();
      window.addEventListener('online', () => this.sync());
    }
  }

  private loadQueue() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }

  private saveQueue() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
  }

  add(action: string, payload: any) {
    this.queue.push({
      id: crypto.randomUUID(),
      action,
      payload,
      timestamp: Date.now(),
    });
    this.saveQueue();
  }

  async sync() {
    if (!navigator.onLine || this.queue.length === 0) return;

    const pending = [...this.queue];
    this.queue = [];
    this.saveQueue();

    for (const item of pending) {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      } catch (error) {
        this.queue.push(item);
      }
    }
    this.saveQueue();
  }

  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  getPendingCount() {
    return this.queue.length;
  }
}

export const offlineQueue = new OfflineQueue();
