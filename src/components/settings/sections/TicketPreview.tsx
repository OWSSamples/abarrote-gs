'use client';

import { useRef, useEffect } from 'react';
import type { TicketDesignConfig, StoreConfig } from '@/types';

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const SAMPLE_ITEMS = [
  { name: 'LECHE LALA ENTERA 1L', sku: 'LAC-001', barcode: '7501055300013', qty: 2, unit: 'pza', unitPrice: 25.00, subtotal: 50.00 },
  { name: 'COCA-COLA 600ML', sku: 'BEB-015', barcode: '7501055301234', qty: 1, unit: 'pza', unitPrice: 18.50, subtotal: 18.50 },
  { name: 'PAN BIMBO GRANDE', sku: 'PAN-003', barcode: '7501055305678', qty: 1, unit: 'pza', unitPrice: 42.00, subtotal: 42.00 },
  { name: 'ARROZ SAN PEDRO 1KG', sku: 'GRA-010', barcode: '7501055309999', qty: 2, unit: 'kilo', unitPrice: 28.00, subtotal: 56.00 },
];

const CORTE_ROWS = [
  { label: 'Total ventas', value: '15' },
  { label: 'Efectivo', value: '$2,450.00' },
  { label: 'Tarjeta', value: '$1,850.00' },
  { label: 'Transferencia', value: '$320.00' },
  { label: 'Devoluciones', value: '$150.00' },
  { label: 'Merma registrada', value: '$45.00' },
  { label: 'Fondo inicial', value: '$500.00' },
];

const FONT_MAP: Record<string, number> = { small: 10, medium: 12, large: 14 };
const LOGO_MAP: Record<string, number> = { small: 44, medium: 64, large: 88 };
const PAPER_PX: Record<string, number> = { '58mm': 220, '72mm': 272, '80mm': 302 };

const SEP_CHAR: Record<string, string> = {
  dashes: '─', dots: '·', line: '━', double: '═', stars: '✦', none: '',
};

// ═══════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════

const st = {
  center: { textAlign: 'center' as const },
  row: { display: 'flex', justifyContent: 'space-between', padding: '1.5px 0' } as const,
  storeName: (fs: number) => ({
    textAlign: 'center' as const, fontWeight: 800,
    fontSize: `${fs + 3}px`, letterSpacing: '1.5px',
    textTransform: 'uppercase' as const, lineHeight: 1.2,
  }),
  sub: (fs: number) => ({
    textAlign: 'center' as const, fontSize: `${Math.max(fs - 3, 8)}px`,
    color: '#666', lineHeight: 1.5,
  }),
  headerNote: (fs: number) => ({
    textAlign: 'center' as const, fontWeight: 700,
    fontSize: `${fs - 1}px`, letterSpacing: '2.5px',
    textTransform: 'uppercase' as const, margin: '5px 0 2px', color: '#333',
  }),
  total: {
    display: 'flex', justifyContent: 'space-between', fontWeight: 800,
    fontSize: '17px', padding: '5px 0', margin: '3px 0',
    borderTop: '2px solid #111', borderBottom: '2px solid #111', letterSpacing: '.5px',
  } as const,
};

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

interface TicketPreviewProps {
  design: TicketDesignConfig;
  config: StoreConfig;
  type: 'venta' | 'corte';
}

export function TicketPreview({ design, config, type }: TicketPreviewProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  const fs = FONT_MAP[design.fontSize] || 12;
  const pw = PAPER_PX[design.paperWidth] || 272;
  const logoH = LOGO_MAP[design.logoSize] || 64;
  const sepChar = SEP_CHAR[design.separatorStyle] || '';
  const sepLen = Math.floor(pw / (fs * 0.6));

  const subtotal = SAMPLE_ITEMS.reduce((a, i) => a + i.subtotal, 0);
  const ivaRate = parseFloat(config.ivaRate || '16') / 100;
  const iva = +(subtotal * ivaRate).toFixed(2);
  const total = +(subtotal + iva).toFixed(2);
  const paid = 200;
  const change = +(paid - total).toFixed(2);
  const itemCount = SAMPLE_ITEMS.reduce((a, i) => a + i.qty, 0);

  useEffect(() => {
    if (!design.showTicketBarcode || design.barcodeFormat === 'QR' || !barcodeRef.current) return;
    import('jsbarcode').then((JsBarcode) => {
      if (!barcodeRef.current) return;
      try {
        JsBarcode.default(barcodeRef.current, 'V-000123456789', {
          format: design.barcodeFormat === 'CODE39' ? 'CODE39' : 'CODE128',
          width: 1.2, height: 32, displayValue: true, fontSize: 9,
          font: "'Helvetica Neue',Helvetica,sans-serif", margin: 0, textMargin: 2,
        });
      } catch { /* non-critical */ }
    });
  }, [design.showTicketBarcode, design.barcodeFormat]);

  const Sep = () =>
    sepChar ? (
      <div style={{ textAlign: 'center', color: '#ccc', fontSize: `${Math.max(fs - 2, 8)}px`, overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: '1.2', margin: '4px 0', letterSpacing: design.separatorStyle === 'stars' ? '2px' : '0' }}>
        {sepChar.repeat(sepLen)}
      </div>
    ) : <div style={{ height: 6 }} />;

  const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div style={{
      width: pw, margin: '0 auto', background: '#fff',
      padding: '12px 10px 16px',
      fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
      fontSize: `${fs}px`, color: '#111', lineHeight: 1.4,
      border: '1px solid #e3e5e7', borderRadius: '8px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
    }}>
      {/* ═══ HEADER ═══ */}
      {design.showLogo && config.logoUrl && (
        <div style={{ ...st.center, marginBottom: 4 }}>
          <img src={config.logoUrl} alt="" style={{ maxWidth: logoH * 1.6, maxHeight: logoH, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        </div>
      )}
      {design.showStoreName && <div style={st.storeName(fs)}>{config.storeName || 'MI TIENDA'}</div>}
      {design.showLegalName && <div style={st.sub(fs)}>{config.legalName || 'RAZÓN SOCIAL'}</div>}
      {design.showAddress && <div style={st.sub(fs)}>{config.address || 'DIRECCIÓN'}, C.P. {config.postalCode || '00000'}, {config.city || 'CIUDAD'}</div>}
      {design.showPhone && <div style={st.sub(fs)}>TEL: {config.phone || '(000) 000-0000'}</div>}
      {design.showRfc && <div style={st.sub(fs)}>RFC: {config.rfc || 'XAXX010101000'}</div>}
      {design.showRegimen && <div style={{ ...st.sub(fs), fontSize: `${Math.max(fs - 4, 7)}px`, color: '#888' }}>{config.regimenDescription || 'REGIMEN FISCAL'}</div>}

      <Sep />

      {design.headerNote && <div style={st.headerNote(fs)}>{design.headerNote}</div>}
      {design.showStoreNumber && (
        <div style={{ ...st.sub(fs), marginTop: 1 }}>TDA#{config.storeNumber || '001'} &middot; OP#CAJERO 1 &middot; TR# V-000123</div>
      )}
      <div style={{ ...st.center, fontSize: `${fs - 2}px`, color: '#999', marginBottom: 2 }}>07/04/2026 &nbsp;&nbsp; 14:35:22</div>

      <Sep />

      {/* ═══ ITEMS (venta) ═══ */}
      {type === 'venta' && SAMPLE_ITEMS.map((item, i) => (
        <div key={i} style={{ paddingBottom: 4, marginBottom: 2, borderBottom: '1px dotted #eee' }}>
          <div style={{ fontWeight: 600, fontSize: `${fs}px`, letterSpacing: '.2px' }}>
            {item.name}
            {design.showSku && <span style={{ color: '#aaa', fontSize: `${fs - 3}px`, marginLeft: 4, fontWeight: 400 }}>[{item.sku}]</span>}
          </div>
          {design.showBarcode && <div style={{ fontSize: `${fs - 4}px`, color: '#bbb', fontFamily: 'monospace' }}>{item.barcode}</div>}
          <div style={{ ...st.row, fontSize: `${fs - 1}px`, color: '#555' }}>
            {design.showUnitDetail ? <span>{item.qty} {item.unit} × ${item.unitPrice.toFixed(2)}</span> : <span>×{item.qty}</span>}
            <span style={{ fontWeight: 600, color: '#111' }}>{fmtMoney(item.subtotal)}</span>
          </div>
        </div>
      ))}

      {/* ═══ ITEMS (corte) ═══ */}
      {type === 'corte' && CORTE_ROWS.map((r, i) => (
        <div key={i} style={{ ...st.row, fontSize: `${fs}px`, borderBottom: i < CORTE_ROWS.length - 1 ? '1px dotted #eee' : 'none', paddingBottom: 3, marginBottom: 2 }}>
          <span style={{ color: '#555' }}>{r.label}</span>
          <span style={{ fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}

      <Sep />

      {/* ═══ TOTALS ═══ */}
      {design.showSubtotal && <div style={{ ...st.row, fontSize: `${fs}px` }}><span>SUBTOTAL</span><span>{fmtMoney(subtotal)}</span></div>}
      {design.showIva && <div style={{ ...st.row, fontSize: `${fs}px` }}><span>IVA ({config.ivaRate || '16'}%)</span><span>{fmtMoney(iva)}</span></div>}
      {design.showDiscount && <div style={{ ...st.row, fontSize: `${fs}px`, color: '#c00' }}><span>DESCUENTO</span><span>-$0.00</span></div>}
      <div style={st.total}><span>TOTAL</span><span>{fmtMoney(total)}</span></div>
      {design.showPaymentMethod && <div style={{ ...st.center, fontSize: `${fs - 2}px`, fontWeight: 700, letterSpacing: '2px', color: '#555', margin: '5px 0', textTransform: 'uppercase' }}>EFECTIVO</div>}
      {design.showAmountPaid && <div style={{ ...st.row, fontSize: `${fs}px` }}><span>RECIBIDO</span><span>{fmtMoney(paid)}</span></div>}
      {design.showChange && <div style={{ ...st.row, fontSize: `${fs}px`, fontWeight: 700 }}><span>CAMBIO</span><span>{fmtMoney(change)}</span></div>}
      {design.showItemCount && type === 'venta' && <div style={{ ...st.center, fontSize: `${fs - 2}px`, color: '#888', marginTop: 4 }}>ARTÍCULOS VENDIDOS: {itemCount}</div>}

      <Sep />

      {/* ═══ BARCODE / QR ═══ */}
      {design.showTicketBarcode && design.barcodeFormat !== 'QR' && (
        <div style={{ ...st.center, padding: '6px 0' }}>
          <svg ref={barcodeRef} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
        </div>
      )}
      {design.showTicketBarcode && design.barcodeFormat === 'QR' && (
        <div style={{ ...st.center, padding: '6px 0' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto', border: '2px solid #ddd', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#bbb', fontWeight: 600, letterSpacing: 1 }}>QR CODE</div>
        </div>
      )}

      <Sep />

      {/* ═══ FOOTER ═══ */}
      {(design.customFooterMessage || config.ticketFooter) && (
        <div style={{ ...st.center, fontSize: `${fs - 3}px`, color: '#999', lineHeight: 1.5, whiteSpace: 'pre-line', marginBottom: 4 }}>
          {design.customFooterMessage || config.ticketFooter}
        </div>
      )}
      {design.showServicePhone && <div style={{ ...st.center, fontSize: `${fs - 3}px`, color: '#999' }}>Ayuda: {config.ticketServicePhone || '800-000-0000'}</div>}
      {design.showVigencia && <div style={{ ...st.center, fontSize: `${fs - 3}px`, color: '#999' }}>Vigencia: {config.ticketVigencia || '30 días'}</div>}
      {design.showPoweredBy && <div style={{ ...st.center, fontSize: '7px', letterSpacing: '2.5px', color: '#d0d0d0', marginTop: 8, textTransform: 'uppercase', fontWeight: 600 }}>POWERED BY OPENDEX KIOSKO</div>}
      {design.copies > 1 && <div style={{ ...st.center, fontSize: '7px', color: '#ccc', marginTop: 3, fontWeight: 700 }}>COPIA (×{design.copies})</div>}
    </div>
  );
}
