import { printWithIframe, applyTicketTemplate } from '@/lib/printTicket';

/* ─── Product row for the order creation form ─── */
export interface OrderLineItem {
  productId: string;
  productName: string;
  sku: string;
  precio: number;
  cantidad: number;
}

/* ─── Print ticket de surtido ─── */
export function printTicketSurtido(params: {
  folio: string;
  fecha: string;
  proveedor: string;
  terminosPago: string;
  moneda: string;
  destino: string;
  destinoAddress: string;
  notas: string;
  lineItems: OrderLineItem[];
  subtotal: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  templateProveedor?: string;
}) {
  const {
    folio, fecha, proveedor, terminosPago, moneda, destino, destinoAddress,
    notas, lineItems, subtotal, storeName, storeAddress, storePhone, templateProveedor,
  } = params;

  const terminosLabel: Record<string, string> = {
    inmediato: 'Pago inmediato', net15: 'Neto 15 días', net30: 'Neto 30 días',
    net60: 'Neto 60 días', contra_entrega: 'Contra entrega',
  };

  const fechaFmt = new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const folioShort = folio.slice(-8).toUpperCase();
  const totalQty = lineItems.reduce((s, l) => s + l.cantidad, 0);
  const now = new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

  const rows = lineItems.map((item) => `
    <tr>
      <td class="td-name">
        <span class="prod-name">${item.productName}</span>
        ${item.sku ? `<span class="prod-sku">${item.sku}</span>` : ''}
      </td>
      <td class="td-qty">${item.cantidad}</td>
      <td class="td-price">$${item.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      <td class="td-total">$${(item.precio * item.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Orden de Surtido · ${storeName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
      font-size:12px;color:#111;background:#fff;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }

    .ticket{width:72mm;margin:0 auto;padding:6mm 4mm;background:#fff;}

    /* ── HEADER ── */
    .store-name{font-size:14px;font-weight:800;text-align:center;letter-spacing:2px;text-transform:uppercase;line-height:1.2;}
    .store-addr{font-size:9px;text-align:center;color:#888;line-height:1.5;margin-top:2px;}

    /* ── DIVIDERS ── */
    .line{border:none;border-top:1px solid #111;margin:8px 0;}
    .line-thin{border:none;border-top:1px solid #ddd;margin:6px 0;}
    .line-double{border:none;border-top:3px double #111;margin:8px 0;}
    .dots{border:none;border-top:1px dotted #ccc;margin:5px 0;}

    /* ── DOC TITLE ── */
    .doc-title{text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:#111;margin:6px 0 2px;}
    .folio-line{text-align:center;font-size:11px;font-weight:600;margin-bottom:1px;letter-spacing:.5px;}
    .fecha-line{text-align:center;font-size:10px;color:#888;letter-spacing:.3px;}

    /* ── INFO BLOCK ── */
    .info-row{display:flex;justify-content:space-between;font-size:10px;padding:2px 0;}
    .info-row .label{color:#888;text-transform:uppercase;font-size:9px;letter-spacing:.5px;}
    .info-row .value{font-weight:700;text-align:right;max-width:55%;}

    /* ── TABLE ── */
    table{width:100%;border-collapse:collapse;margin:0;}
    .th-row td{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;padding:4px 0;border-bottom:1px solid #111;}
    .th-row .td-qty,.th-row .td-price,.th-row .td-total{text-align:right;}
    .td-name{font-size:11px;padding:5px 0 3px;width:50%}
    .td-qty{font-size:11px;text-align:right;padding:5px 2px;width:10%}
    .td-price{font-size:11px;text-align:right;padding:5px 2px;width:20%;color:#888}
    .td-total{font-size:11px;text-align:right;padding:5px 0;width:20%;font-weight:700}
    .prod-name{display:block;font-weight:600}
    .prod-sku{display:block;font-size:8px;color:#aaa;letter-spacing:.3px}
    tr+tr .td-name,tr+tr .td-qty,tr+tr .td-price,tr+tr .td-total{border-top:1px dotted #ddd}

    /* ── TOTALS ── */
    .totals-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#555;}
    .totals-row.main{
      font-size:15px;font-weight:800;letter-spacing:.5px;
      padding:6px 0;margin:2px 0;
      border-top:2px solid #111;border-bottom:2px solid #111;
    }
    .totals-row .t-label{color:#888;}
    .totals-row .t-value{font-weight:700;color:#111;}
    .totals-row.main .t-label,.totals-row.main .t-value{color:#111;}

    /* ── NOTES ── */
    .notes-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;}
    .notes-text{font-size:10px;color:#555;line-height:1.5;white-space:pre-wrap;}

    /* ── FOOTER ── */
    .footer-line{font-size:9px;text-align:center;color:#999;line-height:1.5;}
    .footer-bold{font-weight:700;color:#111;}
    .powered-by{font-size:7px;letter-spacing:4px;text-transform:uppercase;color:#ccc;text-align:center;margin-top:8px;}

    @media print{
      body{background:#fff;}
      .ticket{margin:0;padding:4mm 3mm;}
      @page{size:80mm auto;margin:0;}
    }
  </style>
</head>
<body>
<div class="ticket">

  <!-- STORE HEADER -->
  <div class="store-name">${storeName}</div>
  ${storeAddress ? `<div class="store-addr">${storeAddress}${storePhone ? ' · Tel: ' + storePhone : ''}</div>` : ''}

  <hr class="line"/>

  <!-- DOCUMENT TITLE -->
  <div class="doc-title">Orden de Surtido</div>
  <div class="folio-line">Folio: #${folioShort}</div>
  <div class="fecha-line">${fechaFmt}</div>

  <hr class="line-thin"/>

  <!-- INFO BLOCK -->
  <div class="info-row"><span class="label">Proveedor</span><span class="value">${proveedor}</span></div>
  <div class="info-row"><span class="label">Destino</span><span class="value">${destino}</span></div>
  <div class="info-row"><span class="label">Pago</span><span class="value">${terminosLabel[terminosPago] || terminosPago || '—'}</span></div>
  <div class="info-row"><span class="label">Moneda</span><span class="value">${moneda}</span></div>

  <hr class="line"/>

  <!-- PRODUCTS TABLE -->
  <table>
    <tr class="th-row">
      <td>Producto</td>
      <td class="td-qty">Cant</td>
      <td class="td-price">P.U.</td>
      <td class="td-total">Total</td>
    </tr>
    ${rows}
  </table>

  <hr class="line-double"/>

  <!-- TOTALS -->
  <div class="totals-row"><span class="t-label">Artículos</span><span class="t-value">${totalQty} pzas</span></div>
  <div class="totals-row"><span class="t-label">Subtotal</span><span class="t-value">$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${moneda}</span></div>
  <div class="totals-row"><span class="t-label">Envío</span><span class="t-value">—</span></div>
  <div class="totals-row main"><span class="t-label">TOTAL</span><span class="t-value">$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${moneda}</span></div>

  ${notas ? `
  <hr class="line-thin"/>
  <div class="notes-label">Notas</div>
  <div class="notes-text">${notas}</div>` : ''}

  <hr class="line"/>

  <!-- FOOTER -->
  <div class="footer-line">Impreso el ${now}</div>
  <div class="footer-line"><span class="footer-bold">Documento de uso interno</span></div>
  <div class="powered-by">OPENDEX POS</div>

</div>
</body>
</html>`;

  const templateVars: Record<string, string> = {
    folio: folioShort,
    fecha: fechaFmt,
    proveedor,
    terminosPago: terminosLabel[terminosPago] || terminosPago || '—',
    moneda,
    destino,
    destinoAddress: destinoAddress,
    notas: notas || '',
    subtotal: `$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    total: `$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    totalArticulos: String(totalQty),
    storeName: storeName,
    storeAddress: storeAddress,
    storePhone: storePhone,
    impreso: now,
    items: lineItems.map(item =>
      `<div class="item-name">${item.productName}${item.sku ? ` <span style="font-size:9px;color:#777">(${item.sku})</span>` : ''}</div>` +
      `<div class="item-detail"><span>${item.cantidad} × $${item.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>` +
      `<span>$${(item.precio * item.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>`
    ).join(''),
  };

  printWithIframe(applyTicketTemplate(templateProveedor, templateVars, html));
}
