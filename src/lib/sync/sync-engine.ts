/**
 * SyncEngine — Production-grade real-time synchronization orchestrator.
 *
 * Responsibilities:
 * 1. Cross-tab communication via BroadcastChannel (instant sync between tabs)
 * 2. Visibility-based refresh (data refreshes when tab becomes active)
 * 3. Smart background polling (configurable interval, pauses when hidden)
 * 4. Network reconnection auto-sync
 * 5. Staleness detection (timestamp-based)
 * 6. Exponential backoff on errors
 *
 * Design: Framework-agnostic singleton. React hook wraps this.
 */

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export interface SyncEngineConfig {
  /** Background polling interval in ms. Default: 30_000 (30s) */
  readonly pollingIntervalMs: number;
  /** Max age before data is considered stale (ms). Default: 45_000 (45s) */
  readonly staleThresholdMs: number;
  /** BroadcastChannel name — must match across all tabs. */
  readonly channelName: string;
  /** How long to wait after visibility before refreshing (ms). Default: 500 */
  readonly visibilityDebounceMs: number;
  /** Max consecutive errors before circuit-breaker trips. Default: 5 */
  readonly maxConsecutiveErrors: number;
  /** Cool-down after circuit-breaker trips (ms). Default: 60_000 */
  readonly circuitBreakerCooldownMs: number;
}

export type SyncDomain = 'sales' | 'products' | 'inventory' | 'customers' | 'finance' | 'config' | 'roles' | 'all';

interface BroadcastMessage {
  type: 'MUTATION' | 'FULL_REFRESH' | 'PING';
  domain: SyncDomain;
  timestamp: number;
  tabId: string;
}

type RefreshCallback = (domain: SyncDomain) => Promise<void>;
type StatusCallback = (status: SyncStatus) => void;

export interface SyncStatus {
  readonly isOnline: boolean;
  readonly lastSyncAt: number;
  readonly isStale: boolean;
  readonly isSyncing: boolean;
  readonly consecutiveErrors: number;
  readonly circuitOpen: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Default Configuration
// ────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SyncEngineConfig = {
  pollingIntervalMs: 30_000,
  staleThresholdMs: 45_000,
  channelName: 'pos-sync-channel',
  visibilityDebounceMs: 500,
  maxConsecutiveErrors: 5,
  circuitBreakerCooldownMs: 60_000,
};

// ────────────────────────────────────────────────────────────────────
// SyncEngine
// ────────────────────────────────────────────────────────────────────

export class SyncEngine {
  private readonly config: SyncEngineConfig;
  private readonly tabId: string;

  private channel: BroadcastChannel | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityTimeout: ReturnType<typeof setTimeout> | null = null;

  private onRefresh: RefreshCallback | null = null;
  private onStatusChange: StatusCallback | null = null;

  private lastSyncAt = 0;
  private isSyncing = false;
  private consecutiveErrors = 0;
  private circuitOpenUntil = 0;
  private started = false;

  constructor(config?: Partial<SyncEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tabId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `tab-${Date.now()}`;
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  start(onRefresh: RefreshCallback, onStatusChange?: StatusCallback): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.onRefresh = onRefresh;
    this.onStatusChange = onStatusChange ?? null;

    this.initBroadcastChannel();
    this.initVisibilityListener();
    this.initNetworkListeners();
    this.startPolling();

    this.emitStatus();

    // NOTE: Initial data load is NOT done here anymore.
    // The consumer (useSyncEngine) is responsible for calling forceRefresh()
    // AFTER confirming the user is authenticated. This prevents race conditions
    // where the engine starts fetching before auth is ready.
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    this.channel?.close();
    this.channel = null;

    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = null;

    if (this.visibilityTimeout) clearTimeout(this.visibilityTimeout);
    this.visibilityTimeout = null;

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    this.onRefresh = null;
    this.onStatusChange = null;
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Call after any local mutation to:
   * 1. Notify other tabs via BroadcastChannel
   * 2. Update local sync timestamp
   */
  notifyMutation(domain: SyncDomain): void {
    this.lastSyncAt = Date.now();
    this.broadcastMessage({
      type: 'MUTATION',
      domain,
      timestamp: this.lastSyncAt,
      tabId: this.tabId,
    });
    this.emitStatus();
  }

  /** Force an immediate refresh (used by manual "Actualizar" buttons) */
  async forceRefresh(domain: SyncDomain = 'all'): Promise<void> {
    await this.executeRefresh(domain);
  }

  /** Read current sync status */
  getStatus(): SyncStatus {
    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      lastSyncAt: this.lastSyncAt,
      isStale: this.isStale(),
      isSyncing: this.isSyncing,
      consecutiveErrors: this.consecutiveErrors,
      circuitOpen: Date.now() < this.circuitOpenUntil,
    };
  }

  isStale(): boolean {
    if (this.lastSyncAt === 0) return true;
    return Date.now() - this.lastSyncAt > this.config.staleThresholdMs;
  }

  // ── BroadcastChannel ───────────────────────────────────────────

  private initBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;

    try {
      this.channel = new BroadcastChannel(this.config.channelName);
      this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        const msg = event.data;
        // Ignore messages from this tab
        if (msg.tabId === this.tabId) return;

        if (msg.type === 'MUTATION' || msg.type === 'FULL_REFRESH') {
          // Another tab mutated data → refresh locally
          this.executeRefresh(msg.domain);
        }
      };
    } catch {
      // BroadcastChannel not supported — degrade gracefully
    }
  }

  private broadcastMessage(msg: BroadcastMessage): void {
    try {
      this.channel?.postMessage(msg);
    } catch {
      // Channel might be closed
    }
  }

  // ── Visibility API ─────────────────────────────────────────────

  private initVisibilityListener(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      // Tab became active — debounce to avoid rapid switches
      if (this.visibilityTimeout) clearTimeout(this.visibilityTimeout);
      this.visibilityTimeout = setTimeout(() => {
        if (this.isStale()) {
          this.executeRefresh('all');
        }
      }, this.config.visibilityDebounceMs);

      // Resume polling
      this.startPolling();
    } else {
      // Tab went hidden — pause polling to save resources
      this.stopPolling();
    }
  };

  // ── Network Listeners ──────────────────────────────────────────

  private initNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = (): void => {
    // Reset circuit breaker on reconnection
    this.consecutiveErrors = 0;
    this.circuitOpenUntil = 0;
    // Immediately refresh stale data
    this.executeRefresh('all');
    this.startPolling();
    this.emitStatus();
  };

  private handleOffline = (): void => {
    this.stopPolling();
    this.emitStatus();
  };

  // ── Polling ────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollingTimer) return; // Already running
    this.pollingTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.executeRefresh('all');
      }
    }, this.config.pollingIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // ── Core Refresh ───────────────────────────────────────────────

  private async executeRefresh(domain: SyncDomain): Promise<void> {
    if (this.isSyncing) return; // Prevent concurrent refreshes
    if (!navigator.onLine) return;
    if (Date.now() < this.circuitOpenUntil) return; // Circuit breaker open

    this.isSyncing = true;
    this.emitStatus();

    try {
      await this.onRefresh?.(domain);
      this.lastSyncAt = Date.now();
      this.consecutiveErrors = 0;
    } catch {
      this.consecutiveErrors++;

      // Trip circuit breaker if too many consecutive errors
      if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
        this.circuitOpenUntil = Date.now() + this.config.circuitBreakerCooldownMs;
      }
    } finally {
      this.isSyncing = false;
      this.emitStatus();
    }
  }

  // ── Status Emission ────────────────────────────────────────────

  private emitStatus(): void {
    this.onStatusChange?.(this.getStatus());
  }
}
