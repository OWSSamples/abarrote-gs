/**
 * printWithIframe — Prints an HTML string using a hidden iframe + blob URL.
 * Works around browser popup-blocker restrictions on window.open().
 */
export function printWithIframe(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 2000);
    }, 150);
  };
}

/**
 * applyTicketTemplate — Replaces {{variable}} placeholders in a custom HTML
 * template with the supplied values map, then prints using printWithIframe.
 *
 * If no template is provided it falls back to the defaultHtml.
 */
export function applyTicketTemplate(
  template: string | undefined,
  vars: Record<string, string>,
  defaultHtml: string
): string {
  if (!template) return defaultHtml;
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Replace all occurrences of {{key}} (with optional spaces inside braces)
    result = result.replaceAll(`{{${key}}}`, value);
    result = result.replaceAll(`{{ ${key} }}`, value);
  }
  return result;
}

// ─── Shared CSS for all 80mm POS tickets — Premium Minimal ───────────────────
export const posTicketCSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    font-size:12px;color:#111;background:#fff;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .ticket{width:72mm;margin:0 auto;padding:6mm 4mm;background:#fff;}

  /* ── LOGO ── */
  .logo-area{text-align:center;margin-bottom:6px;}
  .logo-area img{max-width:50mm;max-height:20mm;object-fit:contain;}
  .logo-placeholder{
    width:36px;height:36px;margin:0 auto 4px;
    border:2px solid #111;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:16px;font-weight:800;letter-spacing:-1px;
  }

  /* ── HEADER ── */
  .store-name{font-size:15px;font-weight:800;text-align:center;letter-spacing:2px;text-transform:uppercase;line-height:1.2;}
  .store-sub{font-size:9px;text-align:center;color:#666;line-height:1.6;margin-top:2px;}

  /* ── DIVIDERS ── */
  .line{border:none;border-top:1px solid #111;margin:8px 0;}
  .line-thin{border:none;border-top:1px solid #ddd;margin:6px 0;}
  .line-double{border:none;border-top:3px double #111;margin:8px 0;}
  .dots{border:none;border-top:1px dotted #ccc;margin:5px 0;}

  /* ── DOCUMENT TYPE ── */
  .doc-type{
    text-align:center;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:3px;color:#111;
    margin:6px 0 2px;
  }

  /* ── FOLIO / DATE ── */
  .folio{text-align:center;font-size:11px;font-weight:600;color:#111;margin-bottom:1px;letter-spacing:.5px;}
  .fecha{text-align:center;font-size:10px;color:#888;letter-spacing:.3px;}

  /* ── KEY-VALUE ROWS ── */
  .row{display:flex;justify-content:space-between;font-size:11px;padding:1.5px 0;}
  .row .label{color:#888;text-transform:uppercase;font-size:9px;letter-spacing:.5px;}
  .row .val{font-weight:600;text-align:right;max-width:55%;overflow-wrap:break-word;}

  /* ── ITEM LIST ── */
  .item-name{font-size:11px;font-weight:600;padding-top:4px;letter-spacing:.2px;}
  .item-detail{
    display:flex;justify-content:space-between;
    font-size:11px;color:#555;
    padding-bottom:4px;
    border-bottom:1px dotted #ddd;
  }

  /* ── TOTALS ── */
  .total-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;}
  .total-row.main{
    font-size:18px;font-weight:800;
    padding:6px 0;margin:2px 0;
    border-top:2px solid #111;
    border-bottom:2px solid #111;
    letter-spacing:.5px;
  }
  .total-row.discount{color:#c00;}
  .total-row.change{font-weight:700;}

  /* ── PAYMENT ── */
  .payment-line{
    text-align:center;font-size:9px;font-weight:700;
    text-transform:uppercase;letter-spacing:2px;
    color:#555;margin:6px 0;
  }

  /* ── FOOTER ── */
  .footer-line{font-size:9px;text-align:center;color:#999;line-height:1.5;}
  .footer-bold{font-weight:700;color:#111;}
  .powered-by{
    font-size:7px;letter-spacing:3px;text-transform:uppercase;
    color:#ccc;text-align:center;margin-top:10px;
  }

  /* ── REPRINT ── */
  .reprint-badge{
    text-align:center;font-size:8px;font-weight:800;
    letter-spacing:3px;text-transform:uppercase;
    color:#999;margin:6px 0;
  }

  /* ── OFFLINE ── */
  .offline-badge{
    text-align:center;font-size:8px;font-weight:700;
    text-transform:uppercase;letter-spacing:2px;
    border:1px solid #999;padding:3px 8px;
    margin:4px auto;display:inline-block;
  }

  @media print{
    body{background:#fff;}
    .ticket{padding:3mm 2mm;}
    @page{size:80mm auto;margin:0;}
  }
`;

// ─── Shared CSS for corte de caja (80mm thermal) ────────────────────────────
export const corteTicketCSS = `
  @media print{@page{size:80mm auto;margin:0}body{margin:0}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    font-size:11px;width:302px;margin:0 auto;padding:8px 12px;
    color:#111;line-height:1.4;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .center{text-align:center}
  .bold{font-weight:bold}

  /* ── LOGO ── */
  .logo-area{text-align:center;margin-bottom:4px}
  .logo-area img{max-width:80px;max-height:40px;object-fit:contain}

  .store-name{font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-align:center}
  .store-sub{font-size:9px;color:#888;text-align:center;margin:1px 0}

  .line{border-top:1px solid #111;margin:6px 0}
  .line-thin{border-top:1px solid #ddd;margin:5px 0}
  .line-double{border-top:3px double #111;margin:6px 0}
  .dots{border-top:1px dotted #ccc;margin:4px 0}

  .section-title{
    font-size:9px;font-weight:800;text-align:center;
    letter-spacing:3px;text-transform:uppercase;
    color:#111;margin:6px 0 3px;
  }
  .data-row{display:flex;justify-content:space-between;font-size:11px;margin:2px 0}
  .data-row .lbl{color:#888;text-transform:uppercase;font-size:9px;letter-spacing:.5px}
  .data-row .val{font-weight:700}
  .total-line{
    display:flex;justify-content:space-between;
    font-size:15px;font-weight:800;letter-spacing:.5px;
    padding:4px 0;
    border-top:2px solid #111;
    border-bottom:2px solid #111;
    margin:4px 0;
  }
  .status-msg{
    text-align:center;font-size:8px;font-weight:800;
    letter-spacing:3px;text-transform:uppercase;
    color:#555;margin:4px 0;
  }
  .footer-legal{font-size:7px;text-align:center;color:#aaa;margin:1px 0;letter-spacing:.5px}
  .signature-block{margin-top:18px;text-align:center}
  .signature-line{width:65%;margin:0 auto;border-bottom:1px solid #ccc;padding-top:24px}
  .signature-label{font-size:8px;color:#aaa;margin-top:3px;text-transform:uppercase;letter-spacing:1px}
`;

// ═══════════════════════════════════════════════════════════
// generateTicketHtml — Produces print-ready HTML from TicketDesignConfig
// Used by the print flow when no custom HTML template is set.
// ═══════════════════════════════════════════════════════════

import type { TicketDesignConfig } from '@/types';

interface TicketPrintData {
  storeName: string;
  legalName: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  rfc: string;
  regimenDescription: string;
  storeNumber: string;
  logoUrl?: string;
  ivaRate: string;
  folio: string;
  fecha: string;
  cajero: string;
  metodoPago: string;
  items: { name: string; sku?: string; barcode?: string; qty: number; unit: string; unitPrice: number; subtotal: number }[];
  subtotal: number;
  iva: number;
  discount: number;
  total: number;
  amountPaid: number;
  change: number;
  ticketFooter?: string;
  ticketServicePhone?: string;
  ticketVigencia?: string;
}

const FONT_PX: Record<string, number> = { small: 10, medium: 12, large: 14 };

const SEP_HTML: Record<string, string> = {
  dashes: '<hr class="sep sep-dashes">',
  dots: '<hr class="sep sep-dots">',
  line: '<hr class="sep sep-line">',
  double: '<hr class="sep sep-double">',
  stars: '<hr class="sep sep-stars">',
  none: '<div style="height:4px"></div>',
};

export function generateTicketHtml(design: TicketDesignConfig, data: TicketPrintData): string {
  const fs = FONT_PX[design.fontSize] || 12;
  const sep = SEP_HTML[design.separatorStyle] || SEP_HTML.line;
  const pw = design.paperWidth || '72mm';
  const logoSz: Record<string, string> = { small: '30px', medium: '50px', large: '70px' };
  const itemCount = data.items.reduce((s, i) => s + i.qty, 0);

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:${fs}px;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.ticket{width:${pw};margin:0 auto;padding:4mm 3mm}
.c{text-align:center}
.row{display:flex;justify-content:space-between;padding:1.5px 0}
.b{font-weight:700}
.bb{font-weight:800}
.sub{font-size:${Math.max(fs - 3, 8)}px;color:#666;line-height:1.5}
.total-main{display:flex;justify-content:space-between;font-weight:800;font-size:${fs + 5}px;padding:4px 0;margin:3px 0;border-top:2px solid #111;border-bottom:2px solid #111}
.item-name{font-weight:600;font-size:${fs}px;letter-spacing:.2px;padding-top:3px}
.item-detail{display:flex;justify-content:space-between;font-size:${fs - 1}px;color:#555;padding-bottom:3px;border-bottom:1px dotted #ddd}
.item-sub{font-size:${Math.max(fs - 4, 7)}px;color:#bbb;font-family:monospace}
.footer{font-size:${Math.max(fs - 3, 8)}px;color:#999;line-height:1.5;white-space:pre-line}
.powered{font-size:7px;letter-spacing:2.5px;color:#ccc;margin-top:8px;text-transform:uppercase}
.discount{color:#c00}
.sep{border:none;margin:4px 0}
.sep-dashes{border-top:1px dashed #aaa}
.sep-dots{border-top:1px dotted #ccc}
.sep-line{border-top:1px solid #111}
.sep-double{border-top:3px double #111}
.sep-stars{border-top:none;text-align:center;font-size:8px;letter-spacing:3px;color:#ccc}
.sep-stars::after{content:'✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦'}
@media print{body{background:#fff}.ticket{padding:2mm 1mm}@page{size:${pw === '80mm' ? '80mm' : pw} auto;margin:0}}
</style></head><body><div class="ticket">`;

  // ── Header ──
  if (design.showLogo && data.logoUrl) {
    html += `<div class="c"><img src="${escape(data.logoUrl)}" style="max-height:${logoSz[design.logoSize] || '50px'};max-width:80%;object-fit:contain"></div>`;
  }
  if (design.showStoreName) html += `<div class="c bb" style="font-size:${fs + 3}px;letter-spacing:1.5px;text-transform:uppercase">${escape(data.storeName)}</div>`;
  if (design.showLegalName) html += `<div class="c sub">${escape(data.legalName)}</div>`;
  if (design.showAddress) html += `<div class="c sub">${escape(data.address)}, C.P. ${escape(data.postalCode)}, ${escape(data.city)}</div>`;
  if (design.showPhone) html += `<div class="c sub">TEL: ${escape(data.phone)}</div>`;
  if (design.showRfc) html += `<div class="c sub">RFC: ${escape(data.rfc)}</div>`;
  if (design.showRegimen) html += `<div class="c sub" style="font-size:${Math.max(fs - 4, 7)}px;color:#888">${escape(data.regimenDescription)}</div>`;

  html += sep;

  if (design.headerNote) html += `<div class="c bb" style="font-size:${fs - 1}px;letter-spacing:2.5px;text-transform:uppercase;margin:4px 0">${escape(design.headerNote)}</div>`;
  if (design.showStoreNumber) html += `<div class="c sub">TDA#${escape(data.storeNumber)} &middot; OP#${escape(data.cajero)} &middot; TR# ${escape(data.folio)}</div>`;
  html += `<div class="c" style="font-size:${fs - 2}px;color:#999;margin-bottom:2px">${escape(data.fecha)}</div>`;

  html += sep;

  // ── Items ──
  for (const item of data.items) {
    html += `<div class="item-name">${escape(item.name)}`;
    if (design.showSku && item.sku) html += ` <span style="color:#aaa;font-size:${fs - 3}px;font-weight:400">[${escape(item.sku)}]</span>`;
    html += `</div>`;
    if (design.showBarcode && item.barcode) html += `<div class="item-sub">${escape(item.barcode)}</div>`;
    html += `<div class="item-detail">`;
    if (design.showUnitDetail) {
      html += `<span>${item.qty} ${escape(item.unit)} × $${item.unitPrice.toFixed(2)}</span>`;
    } else {
      html += `<span>×${item.qty}</span>`;
    }
    html += `<span class="b" style="color:#111">$${item.subtotal.toFixed(2)}</span></div>`;
  }

  html += sep;

  // ── Totals ──
  if (design.showSubtotal) html += `<div class="row"><span>SUBTOTAL</span><span>$${data.subtotal.toFixed(2)}</span></div>`;
  if (design.showIva) html += `<div class="row"><span>IVA (${escape(data.ivaRate)}%)</span><span>$${data.iva.toFixed(2)}</span></div>`;
  if (design.showDiscount && data.discount > 0) html += `<div class="row discount"><span>DESCUENTO</span><span>-$${data.discount.toFixed(2)}</span></div>`;
  html += `<div class="total-main"><span>TOTAL</span><span>$${data.total.toFixed(2)}</span></div>`;
  if (design.showPaymentMethod) html += `<div class="c" style="font-size:${fs - 2}px;font-weight:700;letter-spacing:2px;color:#555;margin:4px 0;text-transform:uppercase">${escape(data.metodoPago)}</div>`;
  if (design.showAmountPaid) html += `<div class="row"><span>RECIBIDO</span><span>$${data.amountPaid.toFixed(2)}</span></div>`;
  if (design.showChange) html += `<div class="row b"><span>CAMBIO</span><span>$${data.change.toFixed(2)}</span></div>`;
  if (design.showItemCount) html += `<div class="c" style="font-size:${fs - 2}px;color:#888;margin-top:3px">ARTÍCULOS VENDIDOS: ${itemCount}</div>`;

  html += sep;

  // ── Barcode placeholder (real barcode injected via JsBarcode at print time) ──
  if (design.showTicketBarcode) {
    html += `<div class="c" style="padding:6px 0"><svg id="ticket-barcode"></svg></div>`;
  }

  html += sep;

  // ── Footer ──
  const footerMsg = design.customFooterMessage || data.ticketFooter || '';
  if (footerMsg) html += `<div class="c footer">${escape(footerMsg)}</div>`;
  if (design.showServicePhone && data.ticketServicePhone) html += `<div class="c footer">Ayuda: ${escape(data.ticketServicePhone)}</div>`;
  if (design.showVigencia && data.ticketVigencia) html += `<div class="c footer">Vigencia: ${escape(data.ticketVigencia)}</div>`;
  if (design.showPoweredBy) html += `<div class="c powered">POWERED BY OPENDEX KIOSKO</div>`;

  html += `</div></body></html>`;
  return html;
}

