'use client';

import { Badge, type BadgeProps } from '@shopify/polaris';
import { badgeTone, type BadgeToneMap } from '@/design-system/tokens';

// ── Types ──

type Domain = keyof BadgeToneMap;
type StatusOf<D extends Domain> = keyof BadgeToneMap[D];

interface StatusBadgeProps<D extends Domain> {
  /** Domain context (sale, stock, payment) */
  domain: D;
  /** Status key within the domain */
  status: StatusOf<D>;
  /** Override display label. If omitted, uses the status key capitalized. */
  label?: string;
  /** Optional size */
  size?: BadgeProps['size'];
}

// Status display labels (Spanish)
const statusLabels: Record<string, Record<string, string>> = {
  sale: {
    completed: 'Completada',
    pending: 'Pendiente',
    cancelled: 'Cancelada',
    refunded: 'Reembolsada',
  },
  stock: {
    ok: 'En stock',
    low: 'Stock bajo',
    critical: 'Crítico',
    expired: 'Vencido',
  },
  payment: {
    paid: 'Pagado',
    pending: 'Pendiente',
    failed: 'Fallido',
    refunded: 'Reembolsado',
  },
};

/**
 * StatusBadge — Domain-aware badge with automatic tone + label.
 *
 * @example
 * <StatusBadge domain="sale" status="completed" />
 * <StatusBadge domain="stock" status="low" />
 * <StatusBadge domain="payment" status="paid" label="Cobrado" />
 */
export function StatusBadge<D extends Domain>({
  domain,
  status,
  label,
  size,
}: StatusBadgeProps<D>) {
  const tone = (badgeTone[domain] as Record<string, string>)[status as string] as BadgeProps['tone'];
  const displayLabel =
    label ?? statusLabels[domain]?.[status as string] ?? String(status);

  return (
    <Badge tone={tone} size={size}>
      {displayLabel}
    </Badge>
  );
}
