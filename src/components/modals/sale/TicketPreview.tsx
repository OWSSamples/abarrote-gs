'use client';

import { useRef, useEffect } from 'react';
import { Modal, Text, Box, BlockStack, InlineStack, Icon, Badge } from '@shopify/polaris';
import { PrintIcon, CheckCircleIcon, ExportIcon } from '@shopify/polaris-icons';
import JsBarcode from 'jsbarcode';
import type { SaleRecord, Cliente, StoreConfig } from '@/types';
import { formatCurrency } from '@/lib/utils';

export interface TicketPreviewProps {
  open: boolean;
  completedSale: SaleRecord;
  storeConfig: StoreConfig;
  clienteId: string;
  clientes: Cliente[];
  onPrint: () => void;
  onNewSale: () => void;
  onClose: () => void;
}

export function TicketPreview({
  open,
  completedSale,
  storeConfig,
  clienteId,
  clientes,
  onPrint,
  onNewSale,
  onClose,
}: TicketPreviewProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const sc = storeConfig;
  
  const isOffline = completedSale.folio.startsWith('OFF-');
  const cliente = clientes.find(c => c.id === clienteId);

  useEffect(() => {
    if (barcodeRef.current && completedSale.folio) {
      try {
        JsBarcode(barcodeRef.current, completedSale.folio, {
          format: sc.ticketBarcodeFormat || 'CODE128',
          width: 2,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 10,
        });
      } catch (e) {
        console.error('Error generating barcode:', e);
      }
    }
  }, [completedSale.folio, sc.ticketBarcodeFormat, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <InlineStack gap="200" blockAlign="center">
          <Icon source={CheckCircleIcon} tone="success" />
          <Text as="h2" variant="headingMd">Venta Completada</Text>
        </InlineStack>
      }
      primaryAction={{
        content: 'Imprimir Ticket',
        icon: PrintIcon,
        onAction: onPrint,
      }}
      secondaryActions={[
        { content: 'Nueva Venta', onAction: onNewSale },
        { content: 'Compartir', icon: ExportIcon, onAction: () => {} },
      ]}
    >
      <Modal.Section>
        <Box padding="400" background="bg-surface-secondary">
          <BlockStack gap="400" align="center">
            
            <div className={`ticket-paper ${isOffline ? 'ticket-offline' : ''}`}>

              {/* ── Logo / Store Identity ── */}
              <div className="header-area">
                {sc.logoUrl ? (
                  <img src={sc.logoUrl} alt={sc.storeName} className="store-logo" />
                ) : (
                  <div className="logo-monogram">{sc.storeName.charAt(0)}</div>
                )}
                <div className="store-name">{sc.storeName.toUpperCase()}</div>
                <div className="store-meta">
                  {sc.legalName}<br/>
                  {sc.address}<br/>
                  C.P. {sc.postalCode}, {sc.city}<br/>
                  RFC: {sc.rfc} · TEL: {sc.phone}
                </div>
              </div>

              <div className="sep-line" />

              {isOffline && (
                <div className="offline-strip">MODO OFFLINE — COMPROBANTE DE EMERGENCIA</div>
              )}

              {/* ── Document type ── */}
              <div className="doc-label">Ticket de Venta</div>

              {/* ── Sale metadata ── */}
              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-key">Folio</span>
                  <span className="meta-val">#{completedSale.folio}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Fecha</span>
                  <span className="meta-val">{new Date(completedSale.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Hora</span>
                  <span className="meta-val">{new Date(completedSale.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Cajero</span>
                  <span className="meta-val">{completedSale.cajero.substring(0, 18)}</span>
                </div>
              </div>

              <div className="sep-line" />

              {/* ── Items ── */}
              <div className="items-section">
                {completedSale.items.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <div className="item-left">
                      <span className="item-name">{item.productName}</span>
                      <span className="item-detail">{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                    </div>
                    <span className="item-amount">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="sep-double" />

              {/* ── Totals ── */}
              <div className="totals">
                <div className="total-line">
                  <span>Subtotal</span>
                  <span>{formatCurrency(completedSale.subtotal)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="total-line total-discount">
                    <span>Descuento</span>
                    <span>−{formatCurrency(completedSale.discount)}</span>
                  </div>
                )}
                {completedSale.cardSurcharge > 0 && (
                  <div className="total-line">
                    <span>Comisión tarjeta</span>
                    <span>{formatCurrency(completedSale.cardSurcharge)}</span>
                  </div>
                )}
              </div>

              <div className="grand-total-box">
                <span>TOTAL</span>
                <span>{formatCurrency(completedSale.total)}</span>
              </div>

              <div className="payment-label">
                {completedSale.paymentMethod.toUpperCase().replace('_', ' ')}
              </div>

              {completedSale.paymentMethod === 'efectivo' && (
                <div className="cash-area">
                  <div className="total-line">
                    <span>Recibido</span>
                    <span>{formatCurrency(completedSale.amountPaid)}</span>
                  </div>
                  <div className="total-line total-change">
                    <span>Cambio</span>
                    <span>{formatCurrency(completedSale.change)}</span>
                  </div>
                </div>
              )}

              {cliente && (
                <>
                  <div className="sep-thin" />
                  <div className="loyalty-area">
                    <div className="loyalty-label">PROGRAMA DE LEALTAD</div>
                    <div className="loyalty-row">
                      <span>{cliente.name}</span>
                      <span className="loyalty-pts">+{completedSale.pointsEarned} pts</span>
                    </div>
                  </div>
                </>
              )}

              <div className="sep-line" />

              {/* ── Footer ── */}
              <div className="footer-area">
                <p className="footer-msg">{sc.ticketFooter}</p>
                <div className="barcode-wrap">
                   <svg ref={barcodeRef}></svg>
                </div>
                <div className="powered-label">OPENDEX POS</div>
              </div>
            </div>

          </BlockStack>
        </Box>

        <style>{`
          .ticket-paper {
            background: #fff;
            width: 300px;
            padding: 28px 20px 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111;
            position: relative;
          }
          .ticket-offline { border-top: 2px solid #111; }

          /* ── Header ── */
          .header-area { text-align: center; margin-bottom: 4px; }
          .store-logo {
            max-width: 120px;
            max-height: 48px;
            object-fit: contain;
            margin-bottom: 6px;
          }
          .logo-monogram {
            width: 40px; height: 40px;
            border: 2px solid #111;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; font-weight: 800;
            margin: 0 auto 6px;
            letter-spacing: -1px;
          }
          .store-name {
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 3px;
            margin-bottom: 4px;
          }
          .store-meta {
            font-size: 9px;
            color: #888;
            line-height: 1.5;
          }

          /* ── Separators ── */
          .sep-line { border-top: 1px solid #111; margin: 12px 0; }
          .sep-thin { border-top: 1px solid #e0e0e0; margin: 10px 0; }
          .sep-double { border-top: 3px double #111; margin: 10px 0; }

          .offline-strip {
            text-align: center;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            border: 1px solid #111;
            padding: 4px 8px;
            margin-bottom: 8px;
          }

          /* ── Doc label ── */
          .doc-label {
            text-align: center;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 4px;
            text-transform: uppercase;
            color: #111;
            margin-bottom: 10px;
          }

          /* ── Metadata ── */
          .meta-grid { }
          .meta-item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 11px;
          }
          .meta-key {
            color: #999;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: .5px;
          }
          .meta-val { font-weight: 600; }

          /* ── Items ── */
          .items-section { margin: 4px 0; }
          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 5px 0;
            border-bottom: 1px dotted #ddd;
          }
          .item-row:last-child { border-bottom: none; }
          .item-left { flex: 1; }
          .item-name {
            display: block;
            font-size: 11px;
            font-weight: 600;
            line-height: 1.3;
          }
          .item-detail {
            display: block;
            font-size: 9px;
            color: #999;
            margin-top: 1px;
          }
          .item-amount {
            font-size: 11px;
            font-weight: 700;
            margin-left: 8px;
            white-space: nowrap;
            padding-top: 1px;
          }

          /* ── Totals ── */
          .totals { }
          .total-line {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            padding: 2px 0;
            color: #555;
          }
          .total-discount { color: #c00; }
          .grand-total-box {
            display: flex;
            justify-content: space-between;
            font-size: 20px;
            font-weight: 800;
            padding: 6px 0;
            border-top: 2px solid #111;
            border-bottom: 2px solid #111;
            margin: 6px 0;
            letter-spacing: .5px;
          }
          .payment-label {
            text-align: center;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #888;
            margin: 6px 0;
          }
          .cash-area { margin-top: 2px; }
          .total-change { font-weight: 700; color: #111; }

          /* ── Loyalty ── */
          .loyalty-area { text-align: center; }
          .loyalty-label {
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #aaa;
            margin-bottom: 4px;
          }
          .loyalty-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
          }
          .loyalty-pts { font-weight: 700; }

          /* ── Footer ── */
          .footer-area { text-align: center; margin-top: 8px; }
          .footer-msg {
            font-size: 9px;
            white-space: pre-wrap;
            line-height: 1.4;
            color: #999;
          }
          .barcode-wrap { margin: 10px 0; display: flex; justify-content: center; }
          .powered-label {
            font-size: 7px;
            letter-spacing: 4px;
            text-transform: uppercase;
            color: #ccc;
            margin-top: 4px;
          }
        `}</style>
      </Modal.Section>
    </Modal>
  );
}
