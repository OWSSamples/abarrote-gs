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
