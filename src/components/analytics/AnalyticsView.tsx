'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Divider,
  Box,
  Icon,
  InlineGrid,
  Button,
  ButtonGroup,
  Popover,
  DatePicker,
  ProgressBar,
  Tooltip,
} from '@shopify/polaris';
import {
  ChartVerticalIcon,
  CalendarCheckIcon,
  RefreshIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CashDollarIcon,
  OrderIcon,
  CartIcon,
  PersonIcon,
} from '@shopify/polaris-icons';
import {
  BarChart,
  DonutChart,
  SparkLineChart,
} from '@shopify/polaris-viz';
import { useI18n } from '@shopify/react-i18n';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const METRIC_COLORS = {
  revenue: '#1a73e8',
  profit: '#0d9488',
  expenses: '#dc2626',
  average: '#7c3aed',
  merma: '#ea580c',
} as const;

// ═══════════════════════════════════════════════════════════════
// Helper: KPI Card with Sparkline
// ═══════════════════════════════════════════════════════════════

function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  sparkData,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon: typeof CashDollarIcon;
  sparkData?: { value: number }[];
  color: string;
}) {
  const isPositive = (trend ?? 0) >= 0;
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${color}14`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon source={icon} tone="base" />
          </div>
          {trend !== undefined && (
            <Tooltip content={trendLabel ?? 'vs período anterior'}>
              <InlineStack gap="050" blockAlign="center">
                <Icon source={isPositive ? ArrowUpIcon : ArrowDownIcon} tone={isPositive ? 'success' : 'critical'} />
                <Text as="span" variant="bodySm" tone={isPositive ? 'success' : 'critical'} fontWeight="medium">
                  {Math.abs(trend).toFixed(1)}%
                </Text>
              </InlineStack>
            </Tooltip>
          )}
        </InlineStack>

        <BlockStack gap="050">
          <Text as="p" variant="bodySm" tone="subdued">
            {title}
          </Text>
          <Text as="h3" variant="headingXl" fontWeight="bold">
            {value}
          </Text>
          {subtitle && (
            <Text as="p" variant="bodyXs" tone="subdued">
              {subtitle}
            </Text>
          )}
        </BlockStack>

        {sparkData && sparkData.length > 2 && (
          <div style={{ height: 36 }}>
            <SparkLineChart
              data={[{ data: sparkData.map((d, i) => ({ key: String(i), value: d.value })) }]}
              accessibilityLabel={`Tendencia de ${title}`}
            />
          </div>
        )}
      </BlockStack>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function AnalyticsView() {
  const [i18n] = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- SSR hydration guard
  }, []);

  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const products = useDashboardStore((s) => s.products);
  const gastos = useDashboardStore((s) => s.gastos);
  const mermaRecords = useDashboardStore((s) => s.mermaRecords);
  const clientes = useDashboardStore((s) => s.clientes);
  const fiadoTransactions = useDashboardStore((s) => s.fiadoTransactions);
  const devoluciones = useDashboardStore((s) => s.devoluciones);
  const cortesHistory = useDashboardStore((s) => s.cortesHistory);
  const cashMovements = useDashboardStore((s) => s.cashMovements);
  const loyaltyTransactions = useDashboardStore((s) => s.loyaltyTransactions);
  const kpiData = useDashboardStore((s) => s.kpiData);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const [periodo, setPeriodo] = useState('30');
  const [selectedDayLine, setSelectedDayLine] = useState(new Intl.DateTimeFormat('en-CA').format(new Date()));
  const [popoverActive, setPopoverActive] = useState(false);
  const [{ month, year }, setDateNav] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });

  const getLocalDateStr = useCallback((d: Date | string) => {
    return new Intl.DateTimeFormat('en-CA').format(new Date(d));
  }, []);

  // ── Period filter ──
  const periodoStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (parseInt(periodo) - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodo]);

  const prevPeriodoStart = useMemo(() => {
    const dias = parseInt(periodo);
    const d = new Date();
    d.setDate(d.getDate() - (dias * 2 - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodo]);

  const salesEnPeriodo = useMemo(
    () => saleRecords.filter((s) => new Date(s.date) >= periodoStart),
    [saleRecords, periodoStart],
  );

  const salesPeriodoAnterior = useMemo(
    () => saleRecords.filter((s) => new Date(s.date) >= prevPeriodoStart && new Date(s.date) < periodoStart),
    [saleRecords, prevPeriodoStart, periodoStart],
  );

  const gastosEnPeriodo = useMemo(
    () => gastos.filter((g) => new Date(g.fecha) >= periodoStart),
    [gastos, periodoStart],
  );

  const mermasEnPeriodo = useMemo(
    () => mermaRecords.filter((m) => new Date(m.date) >= periodoStart),
    [mermaRecords, periodoStart],
  );

  // ── Daily Explorer ──
  const statsDiaSeleccionado = useMemo(() => {
    const dailySales = saleRecords.filter((s) => getLocalDateStr(s.date) === selectedDayLine);

    let ingresos = 0;
    let costoTotal = 0;
    const productosMap: Record<string, { name: string; qty: number; profit: number }> = {};
    const horaMap: Record<number, number> = {};

    dailySales.forEach((sale) => {
      ingresos += parseFloat(sale.total.toString());
      const hora = new Date(sale.date).getHours();
      horaMap[hora] = (horaMap[hora] || 0) + parseFloat(sale.total.toString());

      sale.items?.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cost = prod ? prod.costPrice : 0;
        costoTotal += cost * item.quantity;

        if (!productosMap[item.productId]) {
          productosMap[item.productId] = { name: item.productName, qty: 0, profit: 0 };
        }
        productosMap[item.productId].qty += item.quantity;
        productosMap[item.productId].profit += (item.unitPrice - cost) * item.quantity;
      });
    });

    const gananciaNeta = ingresos - costoTotal;
    const margen = ingresos > 0 ? (gananciaNeta / ingresos) * 100 : 0;
    const topGanancia = Object.entries(productosMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    return { ingresos, gananciaNeta, margen, count: dailySales.length, topGanancia };
  }, [saleRecords, products, selectedDayLine, getLocalDateStr]);

  // ── Sales by day (chart) ──
  const datosPorDia = useMemo(() => {
    const dias = parseInt(periodo);
    const fechas = Array.from({ length: dias }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (dias - 1 - i));
      return getLocalDateStr(date);
    });

    const agrupado = salesEnPeriodo.reduce(
      (acc, sale) => {
        const fecha = getLocalDateStr(sale.date);
        if (!acc[fecha]) acc[fecha] = { total: 0, count: 0, costo: 0 };
        acc[fecha].total += parseFloat(String(sale.total || 0));
        acc[fecha].count += 1;
        sale.items?.forEach((item) => {
          const prod = products.find((p) => p.id === item.productId);
          acc[fecha].costo += (prod?.costPrice || 0) * item.quantity;
        });
        return acc;
      },
      {} as Record<string, { total: number; count: number; costo: number }>,
    );

    return fechas.map((fecha) => ({
      fecha,
      total: agrupado[fecha]?.total || 0,
      costo: agrupado[fecha]?.costo || 0,
      ganancia: (agrupado[fecha]?.total || 0) - (agrupado[fecha]?.costo || 0),
      ticketPromedio: agrupado[fecha]?.count > 0 ? agrupado[fecha].total / agrupado[fecha].count : 0,
      count: agrupado[fecha]?.count || 0,
    }));
  }, [salesEnPeriodo, periodo, products, getLocalDateStr]);

  // ── Sales by payment method (Donut) ──
  const ventasPorMetodo = useMemo(() => {
    if (!salesEnPeriodo.length) return [];

    const metodos = salesEnPeriodo.reduce(
      (acc, sale) => {
        const metodo = sale.paymentMethod || 'otros';
        const val = parseFloat(String(sale.total || 0));
        if (!isNaN(val)) {
          acc[metodo] = (acc[metodo] || 0) + val;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      fiado: 'Fiado',
      mixto: 'Mixto',
      otros: 'Otros',
    };

    return Object.entries(metodos)
      .map(([metodo, total]) => ({
        name: labels[metodo] || metodo,
        data: [{ key: labels[metodo] || metodo, value: total }],
      }))
      .sort((a, b) => (b.data[0]?.value ?? 0) - (a.data[0]?.value ?? 0));
  }, [salesEnPeriodo]);

  // ── Top 10 products ──
  const topProductos = useMemo(() => {
    const productosVendidos = salesEnPeriodo.flatMap(
      (sale) =>
        sale.items?.map((item) => ({
          id: item.productId,
          name: item.productName,
          quantity: item.quantity,
          total: parseFloat(item.subtotal.toString()),
        })) || [],
    );

    const agrupados = productosVendidos.reduce(
      (acc, item) => {
        if (!acc[item.id]) {
          acc[item.id] = { name: item.name, quantity: 0, total: 0 };
        }
        acc[item.id].quantity += item.quantity;
        acc[item.id].total += item.total;
        return acc;
      },
      {} as Record<string, { name: string; quantity: number; total: number }>,
    );

    return Object.entries(agrupados)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [salesEnPeriodo]);

  const topProductoMax = topProductos[0]?.total || 1;

  // ── Sales by hour ──
  const ventasPorHoraPeriodo = useMemo(() => {
    const horaMap: Record<number, { total: number; count: number }> = {};
    salesEnPeriodo.forEach((sale) => {
      const hora = new Date(sale.date).getHours();
      if (!horaMap[hora]) horaMap[hora] = { total: 0, count: 0 };
      horaMap[hora].total += parseFloat(String(sale.total || 0));
      horaMap[hora].count += 1;
    });

    return Array.from({ length: 15 }, (_, i) => ({
      key: `${(i + 8).toString().padStart(2, '0')}:00`,
      value: horaMap[i + 8]?.total || 0,
      count: horaMap[i + 8]?.count || 0,
    }));
  }, [salesEnPeriodo]);

  const peakHour = useMemo(() => {
    return ventasPorHoraPeriodo.reduce(
      (prev, curr) => (curr.value > prev.value ? curr : prev),
      ventasPorHoraPeriodo[0],
    );
  }, [ventasPorHoraPeriodo]);

  // ── Aggregate Metrics ──
  const totalVentas = salesEnPeriodo.reduce((sum, sale) => sum + parseFloat(sale.total.toString()), 0);
  const totalVentasAnterior = salesPeriodoAnterior.reduce(
    (sum, sale) => sum + parseFloat(sale.total.toString()),
    0,
  );
  const totalGastos = gastosEnPeriodo.reduce((sum, gasto) => sum + parseFloat(gasto.monto.toString()), 0);
  const totalMermas = mermasEnPeriodo.reduce((sum, merma) => sum + parseFloat(merma.value.toString()), 0);
  const utilidadBruta = totalVentas - totalGastos - totalMermas;

  const ticketPromedio = salesEnPeriodo.length > 0 ? totalVentas / salesEnPeriodo.length : 0;
  const ticketAnterior =
    salesPeriodoAnterior.length > 0 ? totalVentasAnterior / salesPeriodoAnterior.length : 0;

  const productosVendidosTotal = salesEnPeriodo.reduce(
    (sum, sale) => sum + (sale.items?.reduce((s, i) => s + i.quantity, 0) || 0),
    0,
  );

  // Trends vs previous period
  const trendVentas =
    totalVentasAnterior > 0 ? ((totalVentas - totalVentasAnterior) / totalVentasAnterior) * 100 : undefined;
  const trendTicket =
    ticketAnterior > 0 ? ((ticketPromedio - ticketAnterior) / ticketAnterior) * 100 : undefined;
  const trendTransacciones =
    salesPeriodoAnterior.length > 0
      ? ((salesEnPeriodo.length - salesPeriodoAnterior.length) / salesPeriodoAnterior.length) * 100
      : undefined;

  // Sparkline data
  const sparkVentas = useMemo(() => datosPorDia.map((d) => ({ value: d.total })), [datosPorDia]);
  const sparkTicket = useMemo(() => datosPorDia.map((d) => ({ value: d.ticketPromedio })), [datosPorDia]);
  const sparkTransacciones = useMemo(() => datosPorDia.map((d) => ({ value: d.count })), [datosPorDia]);

  // Financial bar: revenue split
  // ── Devoluciones (returns) ──
  const devolucionesEnPeriodo = useMemo(
    () => devoluciones.filter((d) => new Date(d.fecha) >= periodoStart),
    [devoluciones, periodoStart],
  );
  const totalDevoluciones = devolucionesEnPeriodo.reduce((sum, d) => sum + d.montoDevuelto, 0);
  const devolucionesPorMotivo = useMemo(() => {
    const motivos: Record<string, { count: number; total: number }> = {};
    const labels: Record<string, string> = {
      producto_danado: 'Producto dañado',
      producto_incorrecto: 'Producto incorrecto',
      insatisfaccion: 'Insatisfacción',
      otro: 'Otro',
    };
    devolucionesEnPeriodo.forEach((d) => {
      const m = d.motivo || 'otro';
      if (!motivos[m]) motivos[m] = { count: 0, total: 0 };
      motivos[m].count += 1;
      motivos[m].total += d.montoDevuelto;
    });
    return Object.entries(motivos).map(([key, data]) => ({
      motivo: labels[key] || key,
      ...data,
    }));
  }, [devolucionesEnPeriodo]);

  // ── Descuentos (from sales) ──
  const totalDescuentos = useMemo(
    () => salesEnPeriodo.reduce((sum, s) => sum + (s.discount || 0), 0),
    [salesEnPeriodo],
  );
  const ventasConDescuento = useMemo(
    () => salesEnPeriodo.filter((s) => (s.discount || 0) > 0).length,
    [salesEnPeriodo],
  );

  // ── Gastos por categoría ──
  const gastosPorCategoria = useMemo(() => {
    const cats: Record<string, number> = {};
    const labels: Record<string, string> = {
      renta: 'Renta',
      servicios: 'Servicios',
      proveedores: 'Proveedores',
      salarios: 'Salarios',
      mantenimiento: 'Mantenimiento',
      impuestos: 'Impuestos',
      otro: 'Otro',
    };
    gastosEnPeriodo.forEach((g) => {
      const cat = g.categoria || 'otro';
      cats[cat] = (cats[cat] || 0) + parseFloat(g.monto.toString());
    });
    return Object.entries(cats)
      .map(([key, total]) => ({
        name: labels[key] || key,
        data: [{ key: labels[key] || key, value: total }],
      }))
      .sort((a, b) => (b.data[0]?.value ?? 0) - (a.data[0]?.value ?? 0));
  }, [gastosEnPeriodo]);

  // ── Mermas por razón ──
  const mermasPorRazon = useMemo(() => {
    const razones: Record<string, { count: number; value: number }> = {};
    const labels: Record<string, string> = {
      expiration: 'Caducidad',
      damage: 'Daño',
      spoilage: 'Deterioro',
      other: 'Otro',
    };
    mermasEnPeriodo.forEach((m) => {
      const r = m.reason || 'other';
      if (!razones[r]) razones[r] = { count: 0, value: 0 };
      razones[r].count += 1;
      razones[r].value += parseFloat(m.value.toString());
    });
    return Object.entries(razones).map(([key, data]) => ({
      razon: labels[key] || key,
      ...data,
    }));
  }, [mermasEnPeriodo]);

  // ── Clientes y Fiado ──
  const totalFiadoPendiente = useMemo(
    () => clientes.reduce((sum, c) => sum + Math.abs(c.balance || 0), 0),
    [clientes],
  );
  const clientesConFiado = useMemo(
    () => clientes.filter((c) => (c.balance || 0) < 0).length,
    [clientes],
  );
  const fiadoEnPeriodo = useMemo(
    () => fiadoTransactions.filter((f) => new Date(f.date) >= periodoStart),
    [fiadoTransactions, periodoStart],
  );
  const abonosEnPeriodo = useMemo(
    () => fiadoEnPeriodo.filter((f) => f.type === 'abono').reduce((sum, f) => sum + f.amount, 0),
    [fiadoEnPeriodo],
  );
  const fiadosNuevosEnPeriodo = useMemo(
    () => fiadoEnPeriodo.filter((f) => f.type === 'fiado').reduce((sum, f) => sum + f.amount, 0),
    [fiadoEnPeriodo],
  );

  // ── Cortes de caja ──
  const cortesEnPeriodo = useMemo(
    () => cortesHistory.filter((c) => new Date(c.fecha) >= periodoStart),
    [cortesHistory, periodoStart],
  );
  const totalDiferenciaCaja = useMemo(
    () => cortesEnPeriodo.reduce((sum, c) => sum + (c.diferencia || 0), 0),
    [cortesEnPeriodo],
  );

  // ── Inventario resumen ──
  const stockBajo = kpiData?.lowStockProducts ?? products.filter((p) => p.currentStock < p.minStock).length;
  const productosPorVencer = kpiData?.expiringProducts ?? 0;
  const valorInventario = useMemo(
    () => products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0),
    [products],
  );
  const alertasCriticas = useMemo(
    () => inventoryAlerts.filter((a) => a.severity === 'critical').length,
    [inventoryAlerts],
  );

  // ── Lealtad ──
  const loyaltyEnPeriodo = useMemo(
    () => loyaltyTransactions.filter((l) => new Date(l.fecha) >= periodoStart),
    [loyaltyTransactions, periodoStart],
  );
  const puntosEmitidos = useMemo(
    () => loyaltyEnPeriodo.filter((l) => l.tipo === 'acumulacion').reduce((sum, l) => sum + l.puntos, 0),
    [loyaltyEnPeriodo],
  );
  const puntosCanjeados = useMemo(
    () => loyaltyEnPeriodo.filter((l) => l.tipo === 'canje').reduce((sum, l) => sum + Math.abs(l.puntos), 0),
    [loyaltyEnPeriodo],
  );

  // ── Movimientos de efectivo ──
  const movimientosEnPeriodo = useMemo(
    () => cashMovements.filter((m) => new Date(m.fecha) >= periodoStart),
    [cashMovements, periodoStart],
  );
  const entradasEfectivo = useMemo(
    () => movimientosEnPeriodo.filter((m) => m.tipo === 'entrada').reduce((sum, m) => sum + m.monto, 0),
    [movimientosEnPeriodo],
  );
  const salidasEfectivo = useMemo(
    () => movimientosEnPeriodo.filter((m) => m.tipo === 'salida').reduce((sum, m) => sum + m.monto, 0),
    [movimientosEnPeriodo],
  );

  // ── Ventas canceladas ──
  const ventasCanceladas = useMemo(
    () => salesEnPeriodo.filter((s) => s.status === 'cancelada'),
    [salesEnPeriodo],
  );
  const totalCancelado = ventasCanceladas.reduce((sum, s) => sum + parseFloat(s.total.toString()), 0);

  // ── Ventas netas (post descuentos, devoluciones, cancelaciones) ──
  const ventasNetas = totalVentas - totalDescuentos - totalDevoluciones - totalCancelado;

  const periodoLabel =
    periodo === '7' ? 'últimos 7 días' : periodo === '30' ? 'últimos 30 días' : 'últimos 90 días';

  if (!mounted) {
    return (
      <div
        style={{
          background: 'var(--p-color-bg-surface-secondary)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text as="p" tone="subdued">
          Cargando analíticas...
        </Text>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--p-color-bg-surface-secondary)', minHeight: '100%', paddingBottom: '2rem' }}>
      <Page
        title="Análisis Integral"
        subtitle={`Período: ${periodoLabel} · Actualizado: ${i18n.formatDate(new Date(), { hour: 'numeric', minute: '2-digit' })}`}
        fullWidth
        secondaryActions={[
          {
            id: 'analytics-advanced',
            content: 'Analítica Avanzada',
            icon: ChartVerticalIcon,
            url: '/dashboard/analytics/advanced',
          },
          {
            id: 'analytics-refresh',
            content: 'Actualizar',
            icon: RefreshIcon,
            accessibilityLabel: 'Actualizar datos',
            onAction: fetchDashboardData,
          },
        ]}
      >
        <BlockStack gap="500">
          {/* ═══ TOOLBAR: Period + Calendar ═══ */}
          <Card padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <ButtonGroup variant="segmented">
                <Button pressed={periodo === '7'} onClick={() => setPeriodo('7')}>
                  7 días
                </Button>
                <Button pressed={periodo === '30'} onClick={() => setPeriodo('30')}>
                  30 días
                </Button>
                <Button pressed={periodo === '90'} onClick={() => setPeriodo('90')}>
                  90 días
                </Button>
              </ButtonGroup>

              <Popover
                active={popoverActive}
                autofocusTarget="none"
                preferredAlignment="right"
                preferInputActivator={false}
                preferredPosition="below"
                preventCloseOnChildOverlayClick
                onClose={() => setPopoverActive(false)}
                activator={
                  <Button
                    onClick={() => setPopoverActive((v) => !v)}
                    icon={CalendarCheckIcon}
                    disclosure={popoverActive ? 'up' : 'down'}
                  >
                    {i18n.formatDate(new Date(selectedDayLine + 'T12:00:00'), {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Button>
                }
              >
                <Card>
                  <DatePicker
                    month={month}
                    year={year}
                    selected={new Date(selectedDayLine + 'T12:00:00')}
                    onMonthChange={(m, y) => setDateNav({ month: m, year: y })}
                    onChange={(range) => {
                      const dateStr = new Intl.DateTimeFormat('en-CA').format(range.start);
                      setSelectedDayLine(dateStr);
                      setPopoverActive(false);
                    }}
                  />
                </Card>
              </Popover>
            </InlineStack>
          </Card>

          {/* ═══ PRIMARY KPI CARDS (4) ═══ */}
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <KPICard
              title="Ventas Brutas"
              value={i18n.formatCurrency(totalVentas, { currency: 'MXN' })}
              subtitle={periodoLabel}
              trend={trendVentas}
              trendLabel="vs período anterior"
              icon={CashDollarIcon}
              sparkData={sparkVentas}
              color={METRIC_COLORS.revenue}
            />
            <KPICard
              title="Utilidad Bruta"
              value={i18n.formatCurrency(utilidadBruta, { currency: 'MXN' })}
              subtitle={
                totalVentas > 0
                  ? `Margen: ${((utilidadBruta / totalVentas) * 100).toFixed(1)}%`
                  : 'Sin ventas'
              }
              icon={CartIcon}
              sparkData={datosPorDia.map((d) => ({ value: d.ganancia }))}
              color={METRIC_COLORS.profit}
            />
            <KPICard
              title="Ticket Promedio"
              value={i18n.formatCurrency(ticketPromedio, { currency: 'MXN' })}
              subtitle={`${salesEnPeriodo.length} transacciones`}
              trend={trendTicket}
              trendLabel="vs período anterior"
              icon={OrderIcon}
              sparkData={sparkTicket}
              color={METRIC_COLORS.average}
            />
            <KPICard
              title="Productos Vendidos"
              value={productosVendidosTotal.toLocaleString('es-MX')}
              subtitle={`${salesEnPeriodo.length} tickets`}
              trend={trendTransacciones}
              trendLabel="transacciones vs período anterior"
              icon={PersonIcon}
              sparkData={sparkTransacciones}
              color="#2563eb"
            />
          </InlineGrid>

          {/* ═══ SECONDARY MINI-KPIs (5 compact) ═══ */}
          <InlineGrid columns={{ xs: 2, sm: 3, lg: 5 }} gap="300">
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">Ventas Netas</Text>
                <Text as="p" variant="headingSm" fontWeight="bold">
                  {i18n.formatCurrency(ventasNetas, { currency: 'MXN' })}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">Gastos Operativos</Text>
                <Text as="p" variant="headingSm" fontWeight="bold" tone="critical">
                  {i18n.formatCurrency(totalGastos, { currency: 'MXN' })}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">Mermas</Text>
                <Text as="p" variant="headingSm" fontWeight="bold" tone="critical">
                  {i18n.formatCurrency(totalMermas, { currency: 'MXN' })}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">Devoluciones</Text>
                <Text as="p" variant="headingSm" fontWeight="bold">
                  {`${devolucionesEnPeriodo.length} · ${i18n.formatCurrency(totalDevoluciones, { currency: 'MXN' })}`}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">Descuentos</Text>
                <Text as="p" variant="headingSm" fontWeight="bold">
                  {`${ventasConDescuento} · ${i18n.formatCurrency(totalDescuentos, { currency: 'MXN' })}`}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ═══ SECTION: Tendencia de Ventas ═══ */}
          <Box paddingBlockStart="200">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" fontWeight="bold">Tendencia de Ventas</Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Evolución diaria de ingresos y distribución por método de pago
              </Text>
            </BlockStack>
          </Box>

          <InlineGrid columns={{ xs: 1, lg: '2fr 1fr' }} gap="400">
            {/* Daily sales bar chart */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Ventas por Día</Text>
                  <Badge tone="info">{`${salesEnPeriodo.length} transacciones`}</Badge>
                </InlineStack>
                <div style={{ height: 280 }}>
                  <BarChart
                    data={[
                      {
                        name: 'Ingresos',
                        data: datosPorDia.map((d) => ({
                          key: d.fecha.slice(5),
                          value: d.total,
                        })),
                      },
                    ]}
                    theme="Light"
                    xAxisOptions={{
                      labelFormatter: (value) => {
                        const parts = String(value ?? '').split('-');
                        return parts.length === 2 ? `${parts[1]}/${parts[0]}` : String(value ?? '');
                      },
                    }}
                    yAxisOptions={{
                      labelFormatter: (value) => `$${Math.round(Number(value ?? 0)).toLocaleString('es-MX')}`,
                    }}
                  />
                </div>
              </BlockStack>
            </Card>

            {/* Payment Methods */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Métodos de Pago</Text>
                  <Badge tone="info">{`${salesEnPeriodo.length} ventas`}</Badge>
                </InlineStack>
                {ventasPorMetodo.length === 0 ? (
                  <Box padding="800">
                    <Text as="p" tone="subdued" alignment="center">Sin datos en este período</Text>
                  </Box>
                ) : (
                  <BlockStack gap="300">
                    {ventasPorMetodo.map((metodo) => {
                      const val = metodo.data[0]?.value ?? 0;
                      const pct = totalVentas > 0 ? (val / totalVentas) * 100 : 0;
                      const colors: Record<string, string> = {
                        Efectivo: '#16a34a',
                        Tarjeta: '#2563eb',
                        Transferencia: '#7c3aed',
                        Fiado: '#ea580c',
                        Mixto: '#0891b2',
                        Otros: '#6b7280',
                      };
                      const color = colors[metodo.name] || '#6b7280';
                      return (
                        <div key={metodo.name}>
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <div
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 3,
                                  background: color,
                                  flexShrink: 0,
                                }}
                              />
                              <Text as="span" variant="bodySm" fontWeight="medium">
                                {metodo.name}
                              </Text>
                            </InlineStack>
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="span" variant="bodySm" fontWeight="semibold">
                                {i18n.formatCurrency(val, { currency: 'MXN' })}
                              </Text>
                              <div
                                style={{
                                  background: `${color}20`,
                                  color,
                                  padding: '2px 8px',
                                  borderRadius: 20,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {pct.toFixed(1)}%
                              </div>
                            </InlineStack>
                          </InlineStack>
                          <div style={{ marginTop: 6, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: color,
                                borderRadius: 3,
                                transition: 'width 0.5s ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ═══ SECTION: Hora Pico + Explorador ═══ */}
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Hora Pico */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Distribución por Hora</Text>
                  {peakHour && peakHour.value > 0 && <Badge tone="info">{`Pico: ${peakHour.key}`}</Badge>}
                </InlineStack>
                <div style={{ height: 220 }}>
                  <BarChart
                    data={[
                      {
                        name: 'Ventas por hora',
                        data: ventasPorHoraPeriodo.map((h) => ({
                          key: h.key,
                          value: h.value,
                        })),
                      },
                    ]}
                    theme="Light"
                    xAxisOptions={{
                      labelFormatter: (value) => String(value ?? '').slice(0, 2) + 'h',
                    }}
                    yAxisOptions={{
                      labelFormatter: (value) => `$${Math.round(Number(value ?? 0))}`,
                    }}
                  />
                </div>
              </BlockStack>
            </Card>

            {/* Daily Explorer */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Explorador del Día</Text>
                  <Badge
                    tone={statsDiaSeleccionado.gananciaNeta > 0 ? 'success' : 'attention'}
                  >
                    {statsDiaSeleccionado.gananciaNeta > 0 ? 'Rentable' : 'Revisar'}
                  </Badge>
                </InlineStack>

                <Text as="p" variant="bodySm" tone="subdued">
                  {i18n.formatDate(new Date(selectedDayLine + 'T12:00:00'), {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </Text>

                <InlineGrid columns={2} gap="300">
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Ingreso</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {i18n.formatCurrency(statsDiaSeleccionado.ingresos, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Utilidad</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone="success">
                        {i18n.formatCurrency(statsDiaSeleccionado.gananciaNeta, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Transacciones</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {statsDiaSeleccionado.count}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Margen</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {statsDiaSeleccionado.margen.toFixed(1)}%
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>

                {statsDiaSeleccionado.topGanancia.length > 0 && (
                  <>
                    <Divider />
                    <Text as="p" variant="bodySm" fontWeight="semibold">Top productos</Text>
                    <BlockStack gap="200">
                      {statsDiaSeleccionado.topGanancia.slice(0, 3).map((p) => (
                        <InlineStack key={p.id} align="space-between" blockAlign="center">
                          <Text as="span" variant="bodySm" truncate>{p.name}</Text>
                          <Text as="span" variant="bodySm" fontWeight="bold" tone="success">
                            +{formatCurrency(p.profit)}
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ═══ SECTION: Productos ═══ */}
          <Box paddingBlockStart="200">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" fontWeight="bold">Productos</Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Ranking de los productos con mayor ingreso en el período
              </Text>
            </BlockStack>
          </Box>

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingMd">Top 10 Productos</Text>
                <Badge>{`${topProductos.length} productos`}</Badge>
              </InlineStack>

              {topProductos.length === 0 ? (
                <Box padding="800">
                  <BlockStack gap="200" inlineAlign="center">
                    <div style={{ opacity: 0.3, fontSize: 48 }}>📦</div>
                    <Text as="p" tone="subdued" alignment="center">No hay ventas en este período</Text>
                  </BlockStack>
                </Box>
              ) : (
                <BlockStack gap="200">
                  {topProductos.map((producto, index) => {
                    const pct = topProductoMax > 0 ? (producto.total / topProductoMax) * 100 : 0;
                    const medals = ['🥇', '🥈', '🥉'];
                    const barColors = [
                      'linear-gradient(90deg, #facc15 0%, #f59e0b 100%)',
                      'linear-gradient(90deg, #cbd5e1 0%, #94a3b8 100%)',
                      'linear-gradient(90deg, #fdba74 0%, #ea580c 100%)',
                    ];
                    const defaultBar = 'linear-gradient(90deg, #e0e7ff 0%, #818cf8 100%)';

                    return (
                      <div
                        key={producto.id}
                        style={{
                          position: 'relative',
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: index < 3 ? 'var(--p-color-bg-surface-secondary)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${Math.max(pct, 4)}%`,
                            borderRadius: 10,
                            background: index < 3 ? barColors[index] : defaultBar,
                            opacity: index < 3 ? 0.18 : 0.1,
                            transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                          }}
                        />
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 30,
                              textAlign: 'center',
                              fontSize: index < 3 ? 18 : 13,
                              fontWeight: 700,
                              color: index < 3 ? undefined : '#9ca3af',
                              flexShrink: 0,
                            }}
                          >
                            {index < 3 ? medals[index] : index + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              as="span"
                              variant="bodyMd"
                              fontWeight={index < 3 ? 'semibold' : 'regular'}
                              truncate
                            >
                              {producto.name}
                            </Text>
                          </div>
                          <div
                            style={{
                              background: 'var(--p-color-bg-surface-secondary)',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontSize: 12,
                              color: '#6b7280',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {producto.quantity.toLocaleString('es-MX')} uds
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0, color: index < 3 ? '#1e293b' : '#374151' }}>
                            {i18n.formatCurrency(producto.total, { currency: 'MXN' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          {/* ═══ SECTION: Estado Financiero ═══ */}
          <Box paddingBlockStart="200">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" fontWeight="bold">Estado Financiero</Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Resumen de ingresos, egresos y márgenes del período
              </Text>
            </BlockStack>
          </Box>

          <InlineGrid columns={{ xs: 1, lg: '2fr 1fr' }} gap="400">
            {/* Estado de Resultados */}
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingLg" fontWeight="bold">Estado de Resultados</Text>
                  <Badge tone={utilidadBruta > 0 ? 'success' : 'critical'}>
                    {utilidadBruta > 0 ? 'Rentable' : 'Pérdida neta'}
                  </Badge>
                </InlineStack>

                {/* Ingresos */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" fontWeight="bold" tone="subdued">INGRESOS</Text>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">Ventas brutas</Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {i18n.formatCurrency(totalVentas, { currency: 'MXN' })}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">
                      {`(-) Descuentos (${ventasConDescuento} ventas)`}
                    </Text>
                    <Text as="span" variant="bodyMd" tone="critical">
                      {`-${i18n.formatCurrency(totalDescuentos, { currency: 'MXN' })}`}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">
                      {`(-) Devoluciones (${devolucionesEnPeriodo.length})`}
                    </Text>
                    <Text as="span" variant="bodyMd" tone="critical">
                      {`-${i18n.formatCurrency(totalDevoluciones, { currency: 'MXN' })}`}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">
                      {`(-) Cancelaciones (${ventasCanceladas.length})`}
                    </Text>
                    <Text as="span" variant="bodyMd" tone="critical">
                      {`-${i18n.formatCurrency(totalCancelado, { currency: 'MXN' })}`}
                    </Text>
                  </InlineStack>
                  <Divider />
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" fontWeight="bold">Ingreso neto</Text>
                      <Text as="span" variant="bodyMd" fontWeight="bold">
                        {i18n.formatCurrency(ventasNetas, { currency: 'MXN' })}
                      </Text>
                    </InlineStack>
                  </Box>
                </BlockStack>

                {/* Egresos */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" fontWeight="bold" tone="subdued">EGRESOS</Text>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Gastos operativos</Text>
                    <Text as="span" variant="bodyMd" tone="critical">
                      {`-${i18n.formatCurrency(totalGastos, { currency: 'MXN' })}`}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Mermas y pérdidas</Text>
                    <Text as="span" variant="bodyMd" tone="critical">
                      {`-${i18n.formatCurrency(totalMermas, { currency: 'MXN' })}`}
                    </Text>
                  </InlineStack>
                  <Divider />
                  <Box
                    background={utilidadBruta > 0 ? 'bg-fill-success-secondary' : 'bg-fill-critical-secondary'}
                    padding="300"
                    borderRadius="200"
                  >
                    <InlineStack align="space-between">
                      <Text as="span" variant="headingSm" fontWeight="bold">Utilidad del período</Text>
                      <Text as="span" variant="headingSm" fontWeight="bold" tone={utilidadBruta > 0 ? 'success' : 'critical'}>
                        {i18n.formatCurrency(utilidadBruta, { currency: 'MXN' })}
                      </Text>
                    </InlineStack>
                  </Box>
                </BlockStack>

                {/* Márgenes */}
                <Divider />
                <InlineGrid columns={3} gap="300">
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Margen bruto</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {totalVentas > 0 ? ((utilidadBruta / totalVentas) * 100).toFixed(1) : '0'}%
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Ratio de gastos</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {totalVentas > 0 ? ((totalGastos / totalVentas) * 100).toFixed(1) : '0'}%
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Ratio de pérdidas</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {totalVentas > 0 ? (((totalMermas + totalDevoluciones) / totalVentas) * 100).toFixed(1) : '0'}%
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Sidebar: Gastos por Categoría */}
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingMd">Gastos por Categoría</Text>
                    <Badge tone="critical">{i18n.formatCurrency(totalGastos, { currency: 'MXN' })}</Badge>
                  </InlineStack>
                  <div style={{ height: 220 }}>
                    {gastosPorCategoria.length === 0 ? (
                      <Box padding="600">
                        <Text as="p" tone="subdued" alignment="center">Sin gastos registrados</Text>
                      </Box>
                    ) : (
                      <DonutChart data={gastosPorCategoria} theme="Light" legendPosition="bottom" />
                    )}
                  </div>
                </BlockStack>
              </Card>

              {/* Cancelaciones summary card */}
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingMd">Cancelaciones</Text>
                    <Badge tone="warning">{`${ventasCanceladas.length}`}</Badge>
                  </InlineStack>
                  <InlineGrid columns={2} gap="200">
                    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="050">
                        <Text as="p" variant="bodyXs" tone="subdued">Monto cancelado</Text>
                        <Text as="p" variant="headingSm" fontWeight="bold" tone="critical">
                          {i18n.formatCurrency(totalCancelado, { currency: 'MXN' })}
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="050">
                        <Text as="p" variant="bodyXs" tone="subdued">% de ventas</Text>
                        <Text as="p" variant="headingSm" fontWeight="bold">
                          {salesEnPeriodo.length > 0
                            ? ((ventasCanceladas.length / salesEnPeriodo.length) * 100).toFixed(1)
                            : '0'}%
                        </Text>
                      </BlockStack>
                    </Box>
                  </InlineGrid>
                </BlockStack>
              </Card>
            </BlockStack>
          </InlineGrid>

          {/* ═══ SECTION: Pérdidas ═══ */}
          <Box paddingBlockStart="200">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" fontWeight="bold">Control de Pérdidas</Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Mermas, devoluciones y su impacto en el período
              </Text>
            </BlockStack>
          </Box>

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Mermas por razón */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Mermas por Causa</Text>
                  <Badge tone="warning">{i18n.formatCurrency(totalMermas, { currency: 'MXN' })}</Badge>
                </InlineStack>
                {mermasPorRazon.length === 0 ? (
                  <Box padding="600">
                    <Text as="p" tone="subdued" alignment="center">Sin mermas registradas</Text>
                  </Box>
                ) : (
                  <BlockStack gap="200">
                    {mermasPorRazon.map((m) => (
                      <div key={m.razon}>
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text as="span" variant="bodySm" fontWeight="medium">{m.razon}</Text>
                            <Text as="span" variant="bodyXs" tone="subdued">{`${m.count} registros`}</Text>
                          </BlockStack>
                          <Text as="span" variant="bodySm" fontWeight="semibold" tone="critical">
                            {i18n.formatCurrency(m.value, { currency: 'MXN' })}
                          </Text>
                        </InlineStack>
                        <Box paddingBlockStart="100">
                          <ProgressBar
                            progress={totalMermas > 0 ? (m.value / totalMermas) * 100 : 0}
                            size="small"
                            tone="critical"
                          />
                        </Box>
                      </div>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Devoluciones por motivo */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Devoluciones por Motivo</Text>
                  <Badge tone="attention">{`${devolucionesEnPeriodo.length} devol.`}</Badge>
                </InlineStack>
                {devolucionesPorMotivo.length === 0 ? (
                  <Box padding="600">
                    <Text as="p" tone="subdued" alignment="center">Sin devoluciones</Text>
                  </Box>
                ) : (
                  <BlockStack gap="200">
                    {devolucionesPorMotivo.map((d) => (
                      <InlineStack key={d.motivo} align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <Text as="span" variant="bodySm" fontWeight="medium">{d.motivo}</Text>
                          <Text as="span" variant="bodyXs" tone="subdued">{`${d.count} casos`}</Text>
                        </BlockStack>
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {i18n.formatCurrency(d.total, { currency: 'MXN' })}
                        </Text>
                      </InlineStack>
                    ))}
                    <Divider />
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" fontWeight="bold">Total devuelto</Text>
                      <Text as="span" variant="bodySm" fontWeight="bold" tone="critical">
                        {i18n.formatCurrency(totalDevoluciones, { currency: 'MXN' })}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ═══ SECTION: Operaciones ═══ */}
          <Box paddingBlockStart="200">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" fontWeight="bold">Operaciones</Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Crédito a clientes, lealtad, inventario y flujo de efectivo
              </Text>
            </BlockStack>
          </Box>

          {/* Fiado + Lealtad + Inventario */}
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            {/* Fiado / Crédito */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Crédito (Fiado)</Text>
                  <Badge tone="warning">{`${clientesConFiado} deudores`}</Badge>
                </InlineStack>
                <InlineGrid columns={2} gap="300">
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Saldo pendiente</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone="critical">
                        {i18n.formatCurrency(totalFiadoPendiente, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-fill-success-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Abonos cobrados</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone="success">
                        {i18n.formatCurrency(abonosEnPeriodo, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Fiados nuevos</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {i18n.formatCurrency(fiadosNuevosEnPeriodo, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Clientes c/deuda</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {clientesConFiado}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Programa de Lealtad */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Programa de Lealtad</Text>
                  <Badge tone="info">{`${loyaltyEnPeriodo.length} mov.`}</Badge>
                </InlineStack>
                <InlineGrid columns={2} gap="300">
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Pts. emitidos</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {puntosEmitidos.toLocaleString('es-MX')}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Pts. canjeados</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {puntosCanjeados.toLocaleString('es-MX')}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
                {puntosEmitidos > 0 && (
                  <Box paddingBlockStart="100">
                    <BlockStack gap="050">
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodyXs" tone="subdued">Tasa de canje</Text>
                        <Text as="p" variant="bodyXs" fontWeight="medium">
                          {((puntosCanjeados / puntosEmitidos) * 100).toFixed(1)}%
                        </Text>
                      </InlineStack>
                      <ProgressBar
                        progress={puntosEmitidos > 0 ? (puntosCanjeados / puntosEmitidos) * 100 : 0}
                        size="small"
                        tone="highlight"
                      />
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Card>

            {/* Inventario snapshot */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Inventario</Text>
                  {alertasCriticas > 0 && <Badge tone="critical">{`${alertasCriticas} alertas`}</Badge>}
                </InlineStack>
                <InlineGrid columns={2} gap="300">
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Valor total</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {i18n.formatCurrency(valorInventario, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box
                    padding="300"
                    background={stockBajo > 0 ? 'bg-fill-critical-secondary' : 'bg-fill-success-secondary'}
                    borderRadius="200"
                  >
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Stock bajo</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone={stockBajo > 0 ? 'critical' : 'success'}>
                        {`${stockBajo} productos`}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Por vencer</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {productosPorVencer}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Alertas</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone={alertasCriticas > 0 ? 'critical' : 'success'}>
                        {alertasCriticas}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ═══ FLUJO DE EFECTIVO + CORTES ═══ */}
          <InlineGrid columns={{ xs: 1, lg: '2fr 1fr' }} gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">Flujo de Efectivo</Text>
                <InlineGrid columns={{ xs: 2, sm: 4 }} gap="300">
                  <Box padding="300" background="bg-fill-success-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Entradas</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone="success">
                        {`+${i18n.formatCurrency(entradasEfectivo, { currency: 'MXN' })}`}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-fill-critical-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Salidas</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone="critical">
                        {`-${i18n.formatCurrency(salidasEfectivo, { currency: 'MXN' })}`}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Movimientos</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold">
                        {movimientosEnPeriodo.length}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box
                    padding="300"
                    background={entradasEfectivo - salidasEfectivo >= 0 ? 'bg-fill-success-secondary' : 'bg-fill-critical-secondary'}
                    borderRadius="200"
                  >
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Flujo neto</Text>
                      <Text
                        as="p"
                        variant="headingSm"
                        fontWeight="bold"
                        tone={entradasEfectivo - salidasEfectivo >= 0 ? 'success' : 'critical'}
                      >
                        {i18n.formatCurrency(entradasEfectivo - salidasEfectivo, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Cortes de Caja</Text>
                  <Badge>{`${cortesEnPeriodo.length} cortes`}</Badge>
                </InlineStack>
                <InlineGrid columns={2} gap="300">
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Diferencia total</Text>
                      <Text
                        as="p"
                        variant="headingSm"
                        fontWeight="bold"
                        tone={totalDiferenciaCaja === 0 ? 'success' : 'critical'}
                      >
                        {i18n.formatCurrency(totalDiferenciaCaja, { currency: 'MXN' })}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyXs" tone="subdued">Precisión</Text>
                      <Text as="p" variant="headingSm" fontWeight="bold" tone="success">
                        {cortesEnPeriodo.length > 0
                          ? `${((cortesEnPeriodo.filter((c) => c.diferencia === 0).length / cortesEnPeriodo.length) * 100).toFixed(0)}%`
                          : '—'}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>
          </InlineGrid>
        </BlockStack>
      </Page>
    </div>
  );
}
