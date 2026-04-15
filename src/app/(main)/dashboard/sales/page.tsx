'use client';

import { useMemo, type CSSProperties } from 'react';
import { Page, BlockStack } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { SalesHistory } from '@/components/sales/SalesHistory';

/* ── Styles ── */
const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
  gap: 16,
};
const gridSm: CSSProperties = { ...grid, gridTemplateColumns: 'repeat(2, 1fr)' };

const card = (accent: string, hero?: boolean): CSSProperties => ({
  position: 'relative',
  borderRadius: 12,
  background: hero
    ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #fff 100%)'
    : '#fff',
  border: '1px solid #e3e5e7',
  borderLeft: `${hero ? 5 : 4}px solid ${accent}`,
  padding: '20px 20px 20px 24px',
  transition: 'box-shadow .2s, transform .15s',
  overflow: 'hidden',
});

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  marginBottom: 8,
};

const value = (size = 28, color = '#111827'): CSSProperties => ({
  fontSize: size,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  color,
  marginBottom: 6,
});

const sub: CSSProperties = { fontSize: 12, color: '#9ca3af', lineHeight: 1.3 };

const trendPill = (up: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 10px',
  borderRadius: 100,
  fontSize: 12,
  fontWeight: 700,
  background: up ? '#dcfce7' : '#fee2e2',
  color: up ? '#15803d' : '#be123c',
  marginTop: 4,
});

const neutralPill: CSSProperties = {
  ...trendPill(true),
  background: '#f3f4f6',
  color: '#6b7280',
};

const breakdownRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
};

/* ── Accent palette ── */
const EMERALD = '#059669';
const BLUE = '#2563eb';
const VIOLET = '#7c3aed';
const AMBER = '#d97706';

export default function SalesPage() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const kpis = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

    const todaySales = saleRecords.filter((s) => s.date.startsWith(todayStr));
    const yesterdaySales = saleRecords.filter((s) => s.date.startsWith(yesterdayStr));

    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
    const todayCount = todaySales.length;
    const avgTicket = todayCount > 0 ? todayTotal / todayCount : 0;

    const byMethod: Record<string, number> = {};
    todaySales.forEach((s) => {
      byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] || 0) + s.total;
    });

    const delta = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;
    return { todayTotal, todayCount, avgTicket, byMethod, delta, yesterdayTotal };
  }, [saleRecords]);

  const methodLabels: Record<string, string> = {
    efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
    fiado: 'Fiado', puntos: 'Puntos', tarjeta_web: 'MP Web',
    tarjeta_manual: 'T. Manual', tarjeta_clip: 'Clip', clip_terminal: 'Clip Terminal',
  };

  return (
    <Page fullWidth title="Ventas" subtitle="Panorama del día y registro histórico">
      <BlockStack gap="600">
        {/* ── KPI Cards ── */}
        <div style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr', gap: 12 } : grid}>
          {/* HERO — Venta del día */}
          <div style={card(EMERALD, true)}>
            <div style={label}>Venta del día</div>
            <div style={value(34)}>{formatCurrency(kpis.todayTotal)}</div>
            {kpis.yesterdayTotal > 0 ? (
              <span style={trendPill(kpis.delta >= 0)}>
                {kpis.delta >= 0 ? '▲' : '▼'} {Math.abs(kpis.delta).toFixed(1)}% vs ayer
              </span>
            ) : (
              <span style={neutralPill}>Sin datos ayer</span>
            )}
          </div>

          {/* Transacciones */}
          <div style={card(BLUE)}>
            <div style={label}>Transacciones hoy</div>
            <div style={value()}>{kpis.todayCount}</div>
            <div style={sub}>operaciones registradas</div>
          </div>

          {/* Ticket promedio */}
          <div style={card(VIOLET)}>
            <div style={label}>Ticket promedio</div>
            <div style={value()}>{formatCurrency(kpis.avgTicket)}</div>
            <div style={sub}>por transacción</div>
          </div>

          {/* Desglose */}
          <div style={card(AMBER)}>
            <div style={label}>Desglose del día</div>
            {Object.keys(kpis.byMethod).length === 0 ? (
              <div style={sub}>Sin ventas aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {Object.entries(kpis.byMethod)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 4)
                  .map(([method, amount]) => (
                    <div key={method} style={breakdownRow}>
                      <span style={{ color: '#6b7280' }}>{methodLabels[method] || method}</span>
                      <span style={{ fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* ── History Table ── */}
        <SalesHistory />
      </BlockStack>
    </Page>
  );
}
