import 'server-only';

import { createCircuitBreaker } from '@/infrastructure/circuit-breaker';
import { rappiProvider } from './rappi-provider';
import { uberEatsProvider } from './ubereats-provider';
import type { IDeliveryProvider, DeliveryProvider } from './delivery-types';

// ── Circuit Breakers (uno por provider, igual que pagos) ──────
export const rappiBreaker = createCircuitBreaker('rappi', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

export const uberEatsBreaker = createCircuitBreaker('ubereats', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

// ── Registry ─────────────────────────────────────────────────
// Punto central de acceso a providers.
// Al extraer a microservicio: este registry se convierte en
// llamadas HTTP al servicio de delivery, sin cambiar el resto del codigo.

const PROVIDERS: Record<DeliveryProvider, IDeliveryProvider> = {
  rappi: rappiProvider,
  ubereats: uberEatsProvider,
};

export function getDeliveryProvider(provider: DeliveryProvider): IDeliveryProvider {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`Delivery provider desconocido: ${provider}`);
  return p;
}

export function getDeliveryBreaker(provider: DeliveryProvider) {
  if (provider === 'rappi') return rappiBreaker;
  if (provider === 'ubereats') return uberEatsBreaker;
  throw new Error(`No hay circuit breaker para: ${provider}`);
}
