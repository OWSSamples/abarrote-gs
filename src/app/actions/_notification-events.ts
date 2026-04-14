/**
 * Notification Event Catalog
 *
 * Centralized, typed notification templates for all business events.
 * Each event produces a Telegram-formatted HTML message with consistent
 * branding, emoji conventions, and structured data.
 *
 * Architecture:
 *   Event → Template Function → HTML string → sendNotification()
 *
 * This decouples business logic from message formatting, making it
 * trivial to add new channels (email, WhatsApp) in the future —
 * each channel would simply consume the same event data.
 */

import { escapeHTML } from './_notifications';

// ── Formatting Helpers ──────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}`;
const ts = () =>
  new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });
const dateStr = () =>
  new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });

// ── Event Templates ─────────────────────────────────────────────

/** Devolución completada */
export function devolucionEvent(data: {
  saleFolio: string;
  tipo: string;
  motivo: string;
  montoDevuelto: number;
  metodoDev: string;
  cajero: string;
  itemCount: number;
  notas?: string;
}): string {
  const tipoLabel: Record<string, string> = {
    total: 'Devolución Total',
    parcial: 'Devolución Parcial',
  };
  const metodoLabel: Record<string, string> = {
    efectivo: 'Efectivo',
    credito_cliente: 'Crédito a Cliente',
    tarjeta: 'Tarjeta (reverso)',
    otro: 'Otro',
  };

  return (
    `<b>↩️ ${tipoLabel[data.tipo] ?? data.tipo}</b>\n\n` +
    `Venta original: #${escapeHTML(data.saleFolio)}\n` +
    `Motivo: ${escapeHTML(data.motivo)}\n` +
    `Productos: ${data.itemCount} artículo${data.itemCount > 1 ? 's' : ''}\n` +
    `Método: ${metodoLabel[data.metodoDev] ?? data.metodoDev}\n` +
    `Monto devuelto: <b>${fmt(data.montoDevuelto)}</b>\n` +
    `Cajero: ${escapeHTML(data.cajero)}\n` +
    (data.notas ? `Notas: ${escapeHTML(data.notas)}\n` : '') +
    `\n⏰ ${ts()}`
  );
}

/** Gasto registrado */
export function gastoEvent(data: {
  concepto: string;
  categoria: string;
  monto: number;
  notas?: string;
}): string {
  const catEmoji: Record<string, string> = {
    renta: '🏠',
    servicios: '💡',
    nomina: '👥',
    insumos: '📦',
    mantenimiento: '🔧',
    impuestos: '🏛️',
    otro: '📋',
  };
  return (
    `<b>${catEmoji[data.categoria] ?? '💸'} Gasto Registrado</b>\n\n` +
    `Concepto: ${escapeHTML(data.concepto)}\n` +
    `Categoría: ${escapeHTML(data.categoria)}\n` +
    `Monto: <b>${fmt(data.monto)}</b>\n` +
    (data.notas ? `Notas: ${escapeHTML(data.notas)}\n` : '') +
    `\n⏰ ${ts()}`
  );
}

/** Proveedor de pagos conectado/desconectado */
export function providerConnectionEvent(data: {
  provider: string;
  action: 'connect' | 'disconnect';
  userEmail: string;
  environment?: string;
}): string {
  const emoji = data.action === 'connect' ? '🔗' : '🔌';
  const verb = data.action === 'connect' ? 'Conectado' : 'Desconectado';
  return (
    `<b>${emoji} Proveedor de Pagos ${verb}</b>\n\n` +
    `Proveedor: <b>${escapeHTML(data.provider)}</b>\n` +
    (data.environment ? `Ambiente: ${escapeHTML(data.environment)}\n` : '') +
    `Usuario: ${escapeHTML(data.userEmail)}\n` +
    `\n⚠️ Si no reconoces esta acción, revisa inmediatamente.\n` +
    `⏰ ${ts()}`
  );
}

/** Reporte semanal */
export function weeklyReportEvent(data: {
  storeName: string;
  weekRange: string;
  totalVentas: number;
  totalTransacciones: number;
  ventasVsSemanaAnterior: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  totalGastos: number;
  totalDevoluciones: number;
  devolucionCount: number;
  lowStockCount: number;
  lowStockItems: { name: string; stock: number }[];
}): string {
  const arrow = data.ventasVsSemanaAnterior > 0 ? '📈' : data.ventasVsSemanaAnterior < 0 ? '📉' : '➡️';
  const diffPct = data.ventasVsSemanaAnterior.toFixed(1);

  const topList = data.topProducts
    .map((p, i) => `  ${i + 1}. ${escapeHTML(p.name)} — ${p.qty} uds (${fmt(p.revenue)})`)
    .join('\n');

  const lowList = data.lowStockItems
    .slice(0, 5)
    .map((p) => `  ⚠️ ${escapeHTML(p.name)} — ${p.stock} uds`)
    .join('\n');

  return (
    `<b>📊 Reporte Semanal — ${escapeHTML(data.storeName)}</b>\n` +
    `<b>Periodo:</b> ${escapeHTML(data.weekRange)}\n\n` +
    `<b>💰 Ventas:</b> ${fmt(data.totalVentas)}\n` +
    `<b>📊 Vs semana anterior:</b> ${arrow} ${diffPct}%\n` +
    `<b>🧾 Transacciones:</b> ${data.totalTransacciones}\n\n` +
    `<b>💸 Gastos totales:</b> ${fmt(data.totalGastos)}\n` +
    `<b>↩️ Devoluciones:</b> ${data.devolucionCount} (${fmt(data.totalDevoluciones)})\n` +
    `<b>📦 Utilidad bruta:</b> ${fmt(data.totalVentas - data.totalGastos - data.totalDevoluciones)}\n\n` +
    `<b>🏆 Top 5 Productos:</b>\n${topList || '  Sin ventas'}\n\n` +
    `<b>📦 Stock Bajo (${data.lowStockCount}):</b>\n${lowList || '  ✅ Todo en orden'}\n\n` +
    `<i>Generado el ${dateStr()}</i>`
  );
}
