'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

// ── Types ──

interface DisplayItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface SaleState {
  items: DisplayItem[];
  total: number;
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  discountAmount: number;
  paymentMethod: string;
  status: 'idle' | 'active' | 'paying' | 'finished';
  folio?: string;
  change?: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta (Terminal MP)',
  tarjeta_web: 'MercadoPago Web',
  tarjeta_manual: 'Tarjeta',
  transferencia: 'Transferencia',
  spei: 'SPEI',
  spei_conekta: 'SPEI (Conekta)',
  spei_stripe: 'SPEI (Stripe)',
  oxxo_conekta: 'OXXO (Conekta)',
  oxxo_stripe: 'OXXO (Stripe)',
  tarjeta_clip: 'Clip Checkout',
  clip_terminal: 'Clip Terminal',
  paypal: 'PayPal',
  qr_cobro: 'QR de Cobro',
  fiado: 'Crédito',
  puntos: 'Puntos de Lealtad',
};

const EMPTY_SALE: SaleState = {
  items: [],
  total: 0,
  subtotal: 0,
  iva: 0,
  cardSurcharge: 0,
  discountAmount: 0,
  paymentMethod: 'efectivo',
  status: 'idle',
};

// ── Component ──

export default function CustomerDisplayPage() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const [sale, setSale] = useState<SaleState>(EMPTY_SALE);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [lastItemName, setLastItemName] = useState<string | null>(null);

  // Clock
  useEffect(() => {
    function tick() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      );
      setCurrentDate(
        now.toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      );
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // BroadcastChannel listener
  useEffect(() => {
    const channel = new BroadcastChannel('customer_display');
    channel.onmessage = (event) => {
      if (event.data.type === 'UPDATE_SALE') {
        const prev = sale;
        const next = event.data.payload as SaleState;
        setSale(next);

        // Track last scanned item for animation
        if (next.items.length > prev.items.length) {
          const newest = next.items[next.items.length - 1];
          if (newest) {
            setLastItemName(newest.productName);
            setTimeout(() => setLastItemName(null), 2000);
          }
        }
      }
    };
    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-clear finished sale
  useEffect(() => {
    if (sale.status === 'finished') {
      const timer = setTimeout(() => setSale(EMPTY_SALE), 6000);
      return () => clearTimeout(timer);
    }
  }, [sale.status]);

  const storeName = storeConfig.storeName || 'Tu Tienda';
  const logoUrl = storeConfig.logoUrl;
  const paymentLabel = PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod;
  const welcomeMsg = storeConfig.customerDisplayWelcome || `Bienvenido a ${storeName}`;
  const farewellMsg = storeConfig.customerDisplayFarewell || `${storeName} le agradece su preferencia`;
  const promoText = storeConfig.customerDisplayPromoText || '';
  const itemCount = useMemo(
    () => sale.items.reduce((sum, i) => sum + i.quantity, 0),
    [sale.items],
  );

  // ── Monogram for stores without logo ──
  const monogram = useMemo(() => {
    const words = storeName.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return storeName.slice(0, 2).toUpperCase();
  }, [storeName]);

  // ── IDLE SCREEN ──
  if (sale.status === 'idle') {
    return (
      <div className="cd-root cd-idle">
        <div className="cd-idle-bg" />

        <div className="cd-idle-content">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="cd-idle-logo" />
          ) : (
            <div className="cd-monogram-lg">{monogram}</div>
          )}

          <h1 className="cd-idle-title">
            {welcomeMsg}
          </h1>

          <p className="cd-idle-subtitle">Estamos a su servicio</p>

          {promoText && (
            <p className="cd-idle-promo">{promoText}</p>
          )}

          <div className="cd-idle-clock">
            <span className="cd-clock-time">{currentTime}</span>
            <span className="cd-clock-date">{currentDate}</span>
          </div>
        </div>

        {storeConfig.phone && (
          <div className="cd-idle-footer">
            Tel. {storeConfig.phone}
            {storeConfig.address ? ` · ${storeConfig.address}` : ''}
          </div>
        )}

        <Styles />
      </div>
    );
  }

  // ── FINISHED SCREEN ──
  if (sale.status === 'finished') {
    return (
      <div className="cd-root cd-finished">
        <div className="cd-finished-content">
          <div className="cd-check-ring">
            <svg viewBox="0 0 52 52" className="cd-checkmark">
              <circle cx="26" cy="26" r="24" fill="none" stroke="#22c55e" strokeWidth="3" />
              <path fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l7 7 16-16" />
            </svg>
          </div>

          <h1 className="cd-finished-title">¡Gracias por su compra!</h1>

          <div className="cd-finished-details">
            <div className="cd-finished-row">
              <span>Total pagado</span>
              <span className="cd-finished-amount">{formatCurrency(sale.total)}</span>
            </div>
            <div className="cd-finished-divider" />
            <div className="cd-finished-row">
              <span>Método</span>
              <span>{paymentLabel}</span>
            </div>
            {sale.folio && (
              <div className="cd-finished-row">
                <span>Folio</span>
                <span className="cd-mono">{sale.folio}</span>
              </div>
            )}
            {sale.change != null && sale.change > 0 && (
              <>
                <div className="cd-finished-divider" />
                <div className="cd-finished-row">
                  <span>Su cambio</span>
                  <span className="cd-finished-change">{formatCurrency(sale.change)}</span>
                </div>
              </>
            )}
          </div>

          <p className="cd-finished-bye">
            {farewellMsg}
          </p>
        </div>

        <Styles />
      </div>
    );
  }

  // ── ACTIVE / PAYING SCREEN ──
  return (
    <div className="cd-root cd-active">
      {/* Header Bar */}
      <header className="cd-header">
        <div className="cd-header-left">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="cd-header-logo" />
          ) : (
            <div className="cd-monogram-sm">{monogram}</div>
          )}
          <span className="cd-header-name">{storeName}</span>
        </div>
        <div className="cd-header-right">
          <span className="cd-header-time">{currentTime}</span>
          <span className="cd-items-badge">{itemCount} artículo{itemCount !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="cd-body">
        {/* Items list */}
        <div className="cd-items-panel">
          <div className="cd-items-title">Su compra</div>

          <div className="cd-items-scroll">
            {sale.items.map((item, idx) => (
              <div
                key={`${item.productName}-${idx}`}
                className={`cd-item ${lastItemName === item.productName ? 'cd-item-new' : ''}`}
              >
                <div className="cd-item-left">
                  <span className="cd-item-qty">{item.quantity}×</span>
                  <span className="cd-item-name">{item.productName}</span>
                </div>
                <div className="cd-item-right">
                  {item.quantity > 1 && (
                    <span className="cd-item-unit">
                      c/u {formatCurrency(item.unitPrice)}
                    </span>
                  )}
                  <span className="cd-item-total">{formatCurrency(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          {sale.items.length === 0 && (
            <div className="cd-items-empty">
              Escaneando productos…
            </div>
          )}
        </div>

        {/* Totals panel */}
        <div className="cd-totals-panel">
          <div className="cd-totals-card">
            <div className="cd-totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>

            {sale.discountAmount > 0 && (
              <div className="cd-totals-row cd-discount">
                <span>Descuento</span>
                <span>−{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}

            <div className="cd-totals-row cd-iva">
              <span>IVA (16%)</span>
              <span>{formatCurrency(sale.iva)}</span>
            </div>

            {sale.cardSurcharge > 0 && (
              <div className="cd-totals-row cd-surcharge">
                <span>Comisión tarjeta</span>
                <span>+{formatCurrency(sale.cardSurcharge)}</span>
              </div>
            )}

            <div className="cd-totals-divider" />

            <div className="cd-totals-total">
              <span>TOTAL</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>

          {/* Payment status */}
          <div className={`cd-payment-status ${sale.status === 'paying' ? 'cd-paying' : ''}`}>
            {sale.status === 'paying' ? (
              <>
                <div className="cd-pulse-ring" />
                <span className="cd-payment-label">Procesando pago…</span>
                <span className="cd-payment-method">{paymentLabel}</span>
              </>
            ) : (
              <>
                <span className="cd-payment-label">Método de pago</span>
                <span className="cd-payment-method">{paymentLabel}</span>
              </>
            )}
          </div>

          <div className="cd-footer-msg">
            Gracias por su preferencia
          </div>
        </div>
      </div>

      <Styles />
    </div>
  );
}

// ── Isolated styles (no Polaris dependency, fullscreen display) ──

function Styles() {
  return (
    <style>{`
      /* ═══ Reset & Base ═══ */
      .cd-root { margin:0; padding:0; width:100vw; height:100vh; overflow:hidden; font-family:'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; -webkit-font-smoothing:antialiased; color:#1a1a2e; }

      /* ═══ IDLE ═══ */
      .cd-idle { display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; background:#fafbfc; }
      .cd-idle-bg { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 30%,rgba(0,128,96,.06) 0%,transparent 70%); pointer-events:none; }
      .cd-idle-content { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; gap:28px; animation:cdFadeUp .8s ease-out; }
      .cd-idle-logo { max-width:220px; max-height:140px; object-fit:contain; }
      .cd-monogram-lg { width:120px; height:120px; border-radius:28px; background:linear-gradient(135deg,#008060,#00a67e); color:#fff; font-size:48px; font-weight:700; display:flex; align-items:center; justify-content:center; letter-spacing:2px; box-shadow:0 12px 40px rgba(0,128,96,.25); }
      .cd-idle-title { font-size:42px; font-weight:700; margin:0; color:#1a1a2e; text-align:center; line-height:1.2; }
      .cd-highlight { color:#008060; }
      .cd-idle-subtitle { font-size:20px; color:#6b7280; margin:0; }
      .cd-idle-promo { font-size:17px; color:#008060; margin:0; padding:12px 24px; background:rgba(0,128,96,.06); border-radius:12px; text-align:center; max-width:600px; line-height:1.5; }
      .cd-idle-clock { display:flex; flex-direction:column; align-items:center; margin-top:20px; }
      .cd-clock-time { font-size:56px; font-weight:200; letter-spacing:4px; color:#374151; }
      .cd-clock-date { font-size:15px; color:#9ca3af; text-transform:capitalize; margin-top:4px; }
      .cd-idle-footer { position:absolute; bottom:24px; font-size:13px; color:#9ca3af; }

      /* ═══ ACTIVE / PAYING ═══ */
      .cd-active { display:flex; flex-direction:column; background:#f8f9fa; }
      .cd-header { display:flex; justify-content:space-between; align-items:center; padding:12px 28px; background:#fff; border-bottom:1px solid #e5e7eb; flex-shrink:0; }
      .cd-header-left { display:flex; align-items:center; gap:12px; }
      .cd-header-logo { height:32px; object-fit:contain; }
      .cd-monogram-sm { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#008060,#00a67e); color:#fff; font-size:15px; font-weight:700; display:flex; align-items:center; justify-content:center; }
      .cd-header-name { font-size:17px; font-weight:600; color:#374151; }
      .cd-header-right { display:flex; align-items:center; gap:16px; }
      .cd-header-time { font-size:15px; color:#6b7280; font-variant-numeric:tabular-nums; }
      .cd-items-badge { background:#008060; color:#fff; font-size:13px; font-weight:600; padding:4px 12px; border-radius:20px; }

      .cd-body { display:flex; flex:1; min-height:0; }

      /* Items panel */
      .cd-items-panel { flex:1.6; display:flex; flex-direction:column; background:#fff; border-right:1px solid #e5e7eb; }
      .cd-items-title { padding:20px 28px 12px; font-size:15px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:1.5px; }
      .cd-items-scroll { flex:1; overflow-y:auto; padding:0 28px 20px; }
      .cd-items-empty { flex:1; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:18px; padding:60px 0; }

      .cd-item { display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid #f3f4f6; animation:cdSlideIn .25s ease-out; }
      .cd-item-new { background:rgba(0,128,96,.04); margin:0 -28px; padding:14px 28px; border-radius:0; }
      .cd-item-left { display:flex; align-items:baseline; gap:8px; min-width:0; }
      .cd-item-qty { font-size:15px; font-weight:700; color:#008060; flex-shrink:0; min-width:28px; }
      .cd-item-name { font-size:17px; font-weight:500; color:#1f2937; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .cd-item-right { display:flex; align-items:baseline; gap:12px; flex-shrink:0; }
      .cd-item-unit { font-size:13px; color:#9ca3af; }
      .cd-item-total { font-size:17px; font-weight:600; color:#1f2937; font-variant-numeric:tabular-nums; }

      /* Totals panel */
      .cd-totals-panel { flex:1; display:flex; flex-direction:column; padding:28px; gap:20px; }
      .cd-totals-card { background:#fff; border-radius:16px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.06); display:flex; flex-direction:column; gap:14px; }
      .cd-totals-row { display:flex; justify-content:space-between; font-size:16px; color:#4b5563; }
      .cd-totals-row.cd-discount span:last-child { color:#16a34a; }
      .cd-totals-row.cd-surcharge span:last-child { color:#d97706; }
      .cd-totals-row.cd-iva { color:#9ca3af; font-size:14px; }
      .cd-totals-divider { height:1px; background:#e5e7eb; margin:4px 0; }
      .cd-totals-total { display:flex; justify-content:space-between; font-size:32px; font-weight:800; color:#008060; line-height:1; padding-top:4px; }

      /* Payment status */
      .cd-payment-status { background:#fff; border-radius:16px; padding:24px; display:flex; flex-direction:column; align-items:center; gap:8px; position:relative; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
      .cd-payment-status.cd-paying { background:linear-gradient(135deg,#fffbeb,#fef3c7); }
      .cd-payment-label { font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#6b7280; font-weight:600; }
      .cd-payment-method { font-size:20px; font-weight:700; color:#1f2937; }
      .cd-pulse-ring { position:absolute; top:12px; right:12px; width:12px; height:12px; border-radius:50%; background:#f59e0b; animation:cdPulse 1.5s ease-in-out infinite; }

      .cd-footer-msg { text-align:center; font-size:13px; color:#9ca3af; margin-top:auto; padding-top:12px; }

      /* ═══ FINISHED ═══ */
      .cd-finished { display:flex; align-items:center; justify-content:center; background:linear-gradient(160deg,#f0fdf4 0%,#ecfdf5 40%,#fff 100%); }
      .cd-finished-content { display:flex; flex-direction:column; align-items:center; gap:28px; animation:cdFadeUp .6s ease-out; max-width:460px; width:90%; }
      .cd-check-ring { width:96px; height:96px; }
      .cd-checkmark { width:100%; height:100%; }
      .cd-checkmark circle { stroke-dasharray:151; stroke-dashoffset:151; animation:cdCircle .6s ease-out .1s forwards; }
      .cd-checkmark path { stroke-dasharray:40; stroke-dashoffset:40; animation:cdCheck .4s ease-out .5s forwards; }
      .cd-finished-title { font-size:36px; font-weight:700; color:#15803d; margin:0; text-align:center; }
      .cd-finished-details { width:100%; background:#fff; border-radius:16px; padding:24px; box-shadow:0 4px 20px rgba(0,0,0,.06); display:flex; flex-direction:column; gap:14px; }
      .cd-finished-row { display:flex; justify-content:space-between; font-size:17px; color:#4b5563; }
      .cd-finished-amount { font-size:24px; font-weight:800; color:#008060; }
      .cd-finished-change { font-size:22px; font-weight:700; color:#d97706; }
      .cd-finished-divider { height:1px; background:#f3f4f6; }
      .cd-finished-bye { font-size:15px; color:#6b7280; text-align:center; margin:0; }
      .cd-mono { font-family:'SF Mono','Fira Code',monospace; letter-spacing:.5px; }

      /* ═══ Animations ═══ */
      @keyframes cdFadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
      @keyframes cdSlideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
      @keyframes cdPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(1.6); } }
      @keyframes cdCircle { to { stroke-dashoffset:0; } }
      @keyframes cdCheck { to { stroke-dashoffset:0; } }

      /* ═══ Scrollbar ═══ */
      .cd-items-scroll::-webkit-scrollbar { width:6px; }
      .cd-items-scroll::-webkit-scrollbar-track { background:transparent; }
      .cd-items-scroll::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:3px; }
      .cd-items-scroll::-webkit-scrollbar-thumb:hover { background:#9ca3af; }

      /* ═══ Polaris overrides (fullscreen mode) ═══ */
      .Polaris-Frame,.Polaris-Frame__Navigation,.Polaris-Frame__TopBar,.Polaris-TopBar { display:none !important; }
      .Polaris-Frame__Content { padding:0 !important; margin:0 !important; max-width:100vw !important; }
    `}</style>
  );
}
