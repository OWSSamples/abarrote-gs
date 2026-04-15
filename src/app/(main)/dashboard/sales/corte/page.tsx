'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { Page, BlockStack } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { CorteCajaModal } from '@/components/caja/CorteCajaModal';
import { CortesHistory } from '@/components/caja/CortesHistory';

/* ── Styles ── */
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 };

const card = (accent: string): CSSProperties => ({
  position: 'relative',
  borderRadius: 12,
  background: '#fff',
  border: '1px solid #e3e5e7',
  borderLeft: `4px solid ${accent}`,
  padding: '20px 20px 20px 24px',
  overflow: 'hidden',
});

const lbl: CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#6b7280', marginBottom: 8,
};

const val = (color = '#111827'): CSSProperties => ({
  fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
  lineHeight: 1.1, color, marginBottom: 6,
});

const sub: CSSProperties = { fontSize: 12, color: '#9ca3af', lineHeight: 1.3 };

const badge = (bg: string, fg: string): CSSProperties => ({
  display: 'inline-flex', padding: '2px 10px', borderRadius: 100,
  fontSize: 11, fontWeight: 700, background: bg, color: fg, marginTop: 2,
});

const EMERALD = '#059669';
const BLUE = '#2563eb';
const TEAL = '#0d9488';
const ROSE = '#e11d48';

export default function CortePage() {
  const [corteModalOpen, setCorteModalOpen] = useState(false);
  const cortesHistory = useDashboardStore((s) => s.cortesHistory);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const kpis = useMemo(() => {
    if (cortesHistory.length === 0) {
      return { lastCorte: null, totalCortes: 0, avgDiferencia: 0, cortesOk: 0, cortesAlert: 0, precision: 0 };
    }
    const sorted = [...cortesHistory].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );
    const lastCorte = sorted[0];
    const totalCortes = cortesHistory.length;
    const avgDiferencia = cortesHistory.reduce((sum, c) => sum + Math.abs(c.diferencia), 0) / totalCortes;
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
        primaryAction={{ content: 'Nuevo Corte de Caja', onAction: () => setCorteModalOpen(true) }}
        backAction={{ content: 'Ventas', url: '/dashboard/sales' }}
      >
        <BlockStack gap="600">
          {/* ── KPI Cards ── */}
          <div style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr', gap: 12 } : grid}>
            {/* Último corte */}
            <div style={card(EMERALD)}>
              <div style={lbl}>Último corte</div>
              {kpis.lastCorte ? (
                <>
                  <div style={val()}>{formatCurrency(kpis.lastCorte.totalVentas)}</div>
                  <div style={sub}>
                    {new Date(kpis.lastCorte.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    {' · '}{kpis.lastCorte.cajero}
                  </div>
                </>
              ) : (
                <div style={sub}>Sin cortes registrados</div>
              )}
            </div>

            {/* Total cortes */}
            <div style={card(BLUE)}>
              <div style={lbl}>Cortes realizados</div>
              <div style={val()}>{kpis.totalCortes}</div>
              <div style={sub}>en el historial</div>
            </div>

            {/* Precisión */}
            <div style={card(TEAL)}>
              <div style={lbl}>Precisión de caja</div>
              <div style={val()}>{kpis.totalCortes > 0 ? `${kpis.precision}%` : '—'}</div>
              {kpis.totalCortes > 0 && (
                <span
                  style={badge(
                    kpis.precision >= 90 ? '#dcfce7' : kpis.precision >= 70 ? '#fef3c7' : '#fee2e2',
                    kpis.precision >= 90 ? '#15803d' : kpis.precision >= 70 ? '#92400e' : '#be123c',
                  )}
                >
                  {kpis.cortesOk} ok · {kpis.cortesAlert} alerta
                </span>
              )}
              <div style={sub}>tolerancia ±$10</div>
            </div>

            {/* Diferencia promedio */}
            <div style={card(kpis.avgDiferencia <= 10 ? EMERALD : ROSE)}>
              <div style={lbl}>Diferencia promedio</div>
              <div style={val(kpis.avgDiferencia <= 10 ? '#047857' : '#be123c')}>
                {kpis.totalCortes > 0 ? formatCurrency(kpis.avgDiferencia) : '—'}
              </div>
              <div style={sub}>valor absoluto por corte</div>
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
