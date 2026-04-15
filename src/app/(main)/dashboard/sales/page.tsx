'use client';

import { useMemo } from 'react';
import { Page, BlockStack } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { SalesHistory } from '@/components/sales/SalesHistory';

export default function SalesPage() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);

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
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    fiado: 'Fiado',
    puntos: 'Puntos',
    tarjeta_web: 'MP Web',
    tarjeta_manual: 'T. Manual',
    tarjeta_clip: 'Clip',
    clip_terminal: 'Clip Terminal',
  };

  return (
    <Page fullWidth title="Ventas" subtitle="Panorama del día y registro histórico">
      <BlockStack gap="600">
        {/* ── KPI Cards ── */}
        <div className="kpi-grid kpi-grid--hero-first">
          {/* HERO — Venta del día */}
          <div className="kpi-card kpi-card--hero kpi-card--emerald">
            <div className="kpi-label">Venta del día</div>
            <div className="kpi-value kpi-value--hero">
              {formatCurrency(kpis.todayTotal)}
            </div>
            {kpis.yesterdayTotal > 0 ? (
              <span className={`kpi-trend ${kpis.delta >= 0 ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
                {kpis.delta >= 0 ? '▲' : '▼'} {Math.abs(kpis.delta).toFixed(1)}% vs ayer
              </span>
            ) : (
              <span className="kpi-trend kpi-trend--neutral">Sin datos ayer</span>
            )}
          </div>

          {/* Transacciones */}
          <div className="kpi-card kpi-card--blue">
            <div className="kpi-label">Transacciones hoy</div>
            <div className="kpi-value">{kpis.todayCount}</div>
            <div className="kpi-sub">operaciones registradas</div>
          </div>

          {/* Ticket promedio */}
          <div className="kpi-card kpi-card--violet">
            <div className="kpi-label">Ticket promedio</div>
            <div className="kpi-value">{formatCurrency(kpis.avgTicket)}</div>
            <div className="kpi-sub">por transacción</div>
          </div>

          {/* Desglose por método */}
          <div className="kpi-card kpi-card--amber">
            <div className="kpi-label">Desglose del día</div>
            {Object.keys(kpis.byMethod).length === 0 ? (
              <div className="kpi-sub">Sin ventas aún</div>
            ) : (
              <div className="kpi-breakdown">
                {Object.entries(kpis.byMethod)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 4)
                  .map(([method, amount]) => (
                    <div key={method} className="kpi-breakdown-row">
                      <span>{methodLabels[method] || method}</span>
                      <span>{formatCurrency(amount)}</span>
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
