'use client';

import { useMemo, useState } from 'react';
import { Page, BlockStack } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { CorteCajaModal } from '@/components/caja/CorteCajaModal';
import { CortesHistory } from '@/components/caja/CortesHistory';

export default function CortePage() {
  const [corteModalOpen, setCorteModalOpen] = useState(false);
  const cortesHistory = useDashboardStore((s) => s.cortesHistory);

  const kpis = useMemo(() => {
    if (cortesHistory.length === 0) {
      return { lastCorte: null, totalCortes: 0, avgDiferencia: 0, cortesOk: 0, cortesAlert: 0, precision: 0 };
    }

    const sorted = [...cortesHistory].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );
    const lastCorte = sorted[0];
    const totalCortes = cortesHistory.length;
    const avgDiferencia =
      cortesHistory.reduce((sum, c) => sum + Math.abs(c.diferencia), 0) / totalCortes;
    const cortesOk = cortesHistory.filter((c) => Math.abs(c.diferencia) <= 10).length;
    const cortesAlert = totalCortes - cortesOk;
    const precision = Math.round((cortesOk / totalCortes) * 100);

    return { lastCorte, totalCortes, avgDiferencia, cortesOk, cortesAlert, precision };
  }, [cortesHistory]);

  return (
    <>
      <Page
        fullWidth
        title="Corte de Caja"
        subtitle="Arqueo y control de efectivo"
        primaryAction={{
          content: 'Nuevo Corte de Caja',
          onAction: () => setCorteModalOpen(true),
        }}
        backAction={{ content: 'Ventas', url: '/dashboard/sales' }}
      >
        <BlockStack gap="600">
          {/* ── KPI Cards ── */}
          <div className="kpi-grid">
            {/* Último corte */}
            <div className="kpi-card kpi-card--emerald">
              <div className="kpi-label">Último corte</div>
              {kpis.lastCorte ? (
                <>
                  <div className="kpi-value">
                    {formatCurrency(kpis.lastCorte.totalVentas)}
                  </div>
                  <div className="kpi-sub">
                    {new Date(kpis.lastCorte.fecha).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    · {kpis.lastCorte.cajero}
                  </div>
                </>
              ) : (
                <div className="kpi-sub">Sin cortes registrados</div>
              )}
            </div>

            {/* Total de cortes */}
            <div className="kpi-card kpi-card--blue">
              <div className="kpi-label">Cortes realizados</div>
              <div className="kpi-value">{kpis.totalCortes}</div>
              <div className="kpi-sub">en el historial</div>
            </div>

            {/* Precisión de caja */}
            <div className="kpi-card kpi-card--teal">
              <div className="kpi-label">Precisión de caja</div>
              <div className="kpi-value">
                {kpis.totalCortes > 0 ? `${kpis.precision}%` : '—'}
              </div>
              {kpis.totalCortes > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span
                    className={`kpi-badge ${
                      kpis.precision >= 90
                        ? 'kpi-badge--success'
                        : kpis.precision >= 70
                          ? 'kpi-badge--warning'
                          : 'kpi-badge--critical'
                    }`}
                  >
                    {kpis.cortesOk} ok · {kpis.cortesAlert} alerta
                  </span>
                </div>
              )}
              <div className="kpi-sub">tolerancia ±$10</div>
            </div>

            {/* Diferencia promedio */}
            <div className={`kpi-card ${kpis.avgDiferencia <= 10 ? 'kpi-card--emerald' : 'kpi-card--rose'}`}>
              <div className="kpi-label">Diferencia promedio</div>
              <div className={`kpi-value ${kpis.avgDiferencia <= 10 ? 'kpi-value--emerald' : 'kpi-value--rose'}`}>
                {kpis.totalCortes > 0 ? formatCurrency(kpis.avgDiferencia) : '—'}
              </div>
              <div className="kpi-sub">valor absoluto por corte</div>
            </div>
          </div>

          {/* ── History Table ── */}
          <CortesHistory />
        </BlockStack>
      </Page>

      <CorteCajaModal open={corteModalOpen} onClose={() => setCorteModalOpen(false)} />
    </>
  );
}
