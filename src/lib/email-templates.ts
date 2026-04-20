/**
 * Email Templates
 *
 * Professional HTML email templates for all transactional emails.
 * Each template returns an { subject, html, text } object ready
 * for sendEmail().
 *
 * Design principles:
 * - Mobile-first (95%+ of small store owners read on phone)
 * - Inline CSS (email clients strip <style> tags)
 * - Branded with store name + logo
 * - Spanish language
 * - Light/professional aesthetic
 */

// ══════════════════════════════════════════════════════════════
// SHARED LAYOUT
// ══════════════════════════════════════════════════════════════

function baseLayout(opts: {
  storeName: string;
  logoUrl?: string;
  title: string;
  body: string;
  footer?: string;
  accentColor?: string;
}): string {
  const accent = opts.accentColor || '#2563eb';
  const logo = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${opts.storeName}" style="max-height:48px;max-width:180px;margin-bottom:12px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:${accent};padding:24px 32px;text-align:center;">
              ${logo}
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.3px;">
                ${opts.storeName}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${opts.body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                ${opts.footer || `Este correo fue enviado automáticamente por ${opts.storeName}.<br/>No respondas a este mensaje.`}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: TICKET DE VENTA (DIGITAL RECEIPT)
// ══════════════════════════════════════════════════════════════

export interface TicketEmailData {
  storeName: string;
  logoUrl?: string;
  accentColor?: string;
  folio: string;
  fecha: string;
  cajero: string;
  items: { name: string; qty: number; price: number; subtotal: number }[];
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  ticketFooter?: string;
}

export function ticketEmailTemplate(data: TicketEmailData) {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">${item.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#6b7280;text-align:center;">${item.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:right;">$${item.subtotal.toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const paymentLabels: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    tarjeta_web: 'Tarjeta (Web)',
    spei: 'SPEI',
    paypal: 'PayPal',
    qr_cobro: 'QR de Cobro',
    tarjeta_clip: 'Clip',
  };

  const body = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">Ticket de Compra</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Folio: <strong>${data.folio}</strong> · ${data.fecha}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th style="padding:8px 0;border-bottom:2px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Producto</th>
          <th style="padding:8px 0;border-bottom:2px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">Cant.</th>
          <th style="padding:8px 0;border-bottom:2px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="font-size:14px;color:#6b7280;padding:4px 0;">Subtotal</td>
        <td style="font-size:14px;color:#374151;text-align:right;padding:4px 0;">$${data.subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#6b7280;padding:4px 0;">IVA</td>
        <td style="font-size:14px;color:#374151;text-align:right;padding:4px 0;">$${data.iva.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="font-size:16px;color:#111827;font-weight:700;padding:12px 0 0;border-top:2px solid #111827;">Total</td>
        <td style="font-size:16px;color:#111827;font-weight:700;text-align:right;padding:12px 0 0;border-top:2px solid #111827;">$${data.total.toFixed(2)}</td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
      Método de pago: <strong>${paymentLabels[data.paymentMethod] || data.paymentMethod}</strong><br/>
      Cajero: ${data.cajero}
    </p>
    ${data.ticketFooter ? `<p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">${data.ticketFooter}</p>` : ''}
  `;

  const text = `Ticket ${data.folio} — Total: $${data.total.toFixed(2)} — ${data.fecha}`;

  return {
    subject: `Ticket de compra #${data.folio} — ${data.storeName}`,
    html: baseLayout({ storeName: data.storeName, logoUrl: data.logoUrl, accentColor: data.accentColor, title: `Ticket ${data.folio}`, body }),
    text,
  };
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: REPORTE DIARIO / SEMANAL
// ══════════════════════════════════════════════════════════════

export interface ReportEmailData {
  storeName: string;
  logoUrl?: string;
  accentColor?: string;
  reportType: 'daily' | 'weekly';
  period: string;
  totalVentas: number;
  transacciones: number;
  totalGastos: number;
  totalDevoluciones: number;
  devolucionCount: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStockCount: number;
  lowStockItems: { name: string; stock: number }[];
  utilidadBruta: number;
  comparacionPct?: number;
}

export function reportEmailTemplate(data: ReportEmailData) {
  const typeLabel = data.reportType === 'daily' ? 'Diario' : 'Semanal';
  const arrow = (data.comparacionPct ?? 0) > 0 ? '↑' : (data.comparacionPct ?? 0) < 0 ? '↓' : '→';

  const topRows = data.topProducts
    .map(
      (p, i) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${p.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:center;">${p.qty}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">$${p.revenue.toFixed(0)}</td>
      </tr>`,
    )
    .join('');

  const lowStockRows = data.lowStockItems
    .slice(0, 5)
    .map(
      (p) => `
      <tr>
        <td style="padding:4px 8px;font-size:13px;color:#dc2626;">⚠️ ${p.name}</td>
        <td style="padding:4px 8px;font-size:13px;color:#dc2626;text-align:right;">${p.stock} uds</td>
      </tr>`,
    )
    .join('');

  const kpiCard = (label: string, value: string, color: string) =>
    `<td style="padding:12px;background:${color};border-radius:8px;text-align:center;width:33%;">
      <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827;">${value}</p>
    </td>`;

  const body = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">Reporte ${typeLabel}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">${data.period}</p>

    <!-- KPI Cards -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        ${kpiCard('Ventas', `$${data.totalVentas.toFixed(0)}`, '#eff6ff')}
        ${kpiCard('Gastos', `$${data.totalGastos.toFixed(0)}`, '#fef3c7')}
        ${kpiCard('Utilidad', `$${data.utilidadBruta.toFixed(0)}`, '#ecfdf5')}
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="font-size:14px;color:#6b7280;padding:4px 0;">Transacciones</td>
        <td style="font-size:14px;color:#374151;text-align:right;padding:4px 0;">${data.transacciones}</td>
      </tr>
      ${data.comparacionPct !== undefined ? `
      <tr>
        <td style="font-size:14px;color:#6b7280;padding:4px 0;">Vs periodo anterior</td>
        <td style="font-size:14px;color:${(data.comparacionPct ?? 0) >= 0 ? '#059669' : '#dc2626'};text-align:right;padding:4px 0;">${arrow} ${data.comparacionPct?.toFixed(1)}%</td>
      </tr>` : ''}
      <tr>
        <td style="font-size:14px;color:#6b7280;padding:4px 0;">Devoluciones</td>
        <td style="font-size:14px;color:#374151;text-align:right;padding:4px 0;">${data.devolucionCount} ($${data.totalDevoluciones.toFixed(0)})</td>
      </tr>
    </table>

    ${data.topProducts.length > 0 ? `
    <h3 style="margin:24px 0 8px;font-size:14px;color:#111827;font-weight:600;">Top 5 Productos</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th style="padding:6px 8px;font-size:11px;color:#9ca3af;text-align:left;">#</th>
          <th style="padding:6px 8px;font-size:11px;color:#9ca3af;text-align:left;">Producto</th>
          <th style="padding:6px 8px;font-size:11px;color:#9ca3af;text-align:center;">Uds</th>
          <th style="padding:6px 8px;font-size:11px;color:#9ca3af;text-align:right;">Ingreso</th>
        </tr>
      </thead>
      <tbody>${topRows}</tbody>
    </table>` : ''}

    ${data.lowStockCount > 0 ? `
    <h3 style="margin:24px 0 8px;font-size:14px;color:#dc2626;font-weight:600;">Stock Bajo (${data.lowStockCount})</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tbody>${lowStockRows}</tbody>
    </table>` : '<p style="margin:24px 0 0;font-size:14px;color:#059669;">✅ Stock en orden — sin alertas</p>'}
  `;

  const text = `Reporte ${typeLabel} — ${data.period} — Ventas: $${data.totalVentas.toFixed(0)} — Utilidad: $${data.utilidadBruta.toFixed(0)}`;

  return {
    subject: `📊 Reporte ${typeLabel} — ${data.storeName} — ${data.period}`,
    html: baseLayout({ storeName: data.storeName, logoUrl: data.logoUrl, accentColor: data.accentColor, title: `Reporte ${typeLabel}`, body }),
    text,
  };
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: ALERTA OPERATIVA
// ══════════════════════════════════════════════════════════════

export interface AlertEmailData {
  storeName: string;
  logoUrl?: string;
  accentColor?: string;
  alertType: 'stock_bajo' | 'devolucion' | 'gasto' | 'seguridad' | 'general';
  title: string;
  message: string;
  details?: { label: string; value: string }[];
  severity: 'info' | 'warning' | 'critical';
}

export function alertEmailTemplate(data: AlertEmailData) {
  const severityConfig = {
    info: { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ️', label: 'Información' },
    warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️', label: 'Advertencia' },
    critical: { bg: '#fef2f2', border: '#ef4444', icon: '🚨', label: 'Crítica' },
  }[data.severity];

  const detailRows = (data.details || [])
    .map(
      (d) => `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;">${d.label}</td>
        <td style="padding:4px 0;font-size:13px;color:#374151;text-align:right;font-weight:500;">${d.value}</td>
      </tr>`,
    )
    .join('');

  const body = `
    <div style="background:${severityConfig.bg};border-left:4px solid ${severityConfig.border};border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">
        ${severityConfig.icon} ${data.title}
      </p>
      <p style="margin:8px 0 0;font-size:14px;color:#374151;line-height:1.5;">
        ${data.message}
      </p>
    </div>

    ${detailRows ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      <tbody>${detailRows}</tbody>
    </table>` : ''}

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
      Alerta tipo: ${severityConfig.label} · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
    </p>
  `;

  const text = `${severityConfig.icon} ${data.title} — ${data.message}`;

  return {
    subject: `${severityConfig.icon} ${data.title} — ${data.storeName}`,
    html: baseLayout({ storeName: data.storeName, logoUrl: data.logoUrl, accentColor: data.accentColor, title: data.title, body }),
    text,
  };
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: TEST EMAIL
// ══════════════════════════════════════════════════════════════

export function testEmailTemplate(storeName: string, logoUrl?: string) {
  const body = `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Correo configurado correctamente</h2>
      <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">
        Este es un correo de prueba enviado desde <strong>${storeName}</strong>.<br/>
        Si recibes este mensaje, la integración con AWS SES está funcionando.
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
        ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
      </p>
    </div>
  `;

  return {
    subject: `✅ Correo de prueba — ${storeName}`,
    html: baseLayout({ storeName, logoUrl, title: 'Correo de prueba', body }),
    text: `Correo de prueba exitoso desde ${storeName}`,
  };
}
