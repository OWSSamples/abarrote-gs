'use client';

import { useRef, useEffect } from 'react';
import { Modal, Text, Box, BlockStack, InlineStack, Icon, Badge, Button } from '@shopify/polaris';
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
            
            {/* Contenedor del Ticket Estilo Papel */}
            <div className={`ticket-paper ${isOffline ? 'offline-border' : ''}`}>
              
              {/* Encabezado */}
              <div className="ticket-header">
                <Text as="h1" variant="headingLg" alignment="center" fontWeight="bold">
                  {sc.storeName.toUpperCase()}
                </Text>
                <div className="store-details">
                  <p>{sc.legalName}</p>
                  <p>{sc.address}</p>
                  <p>C.P. {sc.postalCode}, {sc.city}</p>
                  <p>RFC: {sc.rfc}</p>
                  <p>TEL: {sc.phone}</p>
                </div>
              </div>

              {isOffline && (
                <div className="offline-banner">
                  <Badge tone="warning">MODO OFFLINE ACTIVADO</Badge>
                  <p className="offline-msg">Comprobante de Emergencia local</p>
                </div>
              )}

              <div className="divider-dashed" />

              {/* Info de Venta */}
              <div className="sale-info">
                <InlineStack align="space-between">
                  <p><strong>Folio:</strong> #{completedSale.folio}</p>
                  <p>{new Date(completedSale.date).toLocaleDateString()}</p>
                </InlineStack>
                <InlineStack align="space-between">
                  <p><strong>Cajero:</strong> {completedSale.cajero.substring(0, 15)}</p>
                  <p>{new Date(completedSale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </InlineStack>
              </div>

              <div className="divider-dashed" />

              {/* Tabla de Productos */}
              <table className="items-table">
                <thead>
                  <tr>
                    <th align="left">CANT. / PRODUCTO</th>
                    <th align="right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSale.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="item-row">
                          <span className="qty">{item.quantity}x</span>
                          <span className="name">{item.productName.toUpperCase()}</span>
                        </div>
                        <span className="unit-price">P.U. {formatCurrency(item.unitPrice)}</span>
                      </td>
                      <td align="right" valign="top">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="divider-dashed" />

              {/* Resumen de Pago */}
              <div className="totals-section">
                <InlineStack align="space-between">
                  <p>SUBTOTAL</p>
                  <p>{formatCurrency(completedSale.subtotal)}</p>
                </InlineStack>
                {completedSale.discount > 0 && (
                  <InlineStack align="space-between" className="discount">
                    <p>DESCUENTO</p>
                    <p>-{formatCurrency(completedSale.discount)}</p>
                  </InlineStack>
                )}
                {completedSale.cardSurcharge > 0 && (
                  <InlineStack align="space-between">
                    <p>COMISIÓN TARJETA</p>
                    <p>{formatCurrency(completedSale.cardSurcharge)}</p>
                  </InlineStack>
                )}
                <div className="grand-total">
                  <InlineStack align="space-between">
                    <Text as="p" variant="headingLg" fontWeight="bold">TOTAL</Text>
                    <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(completedSale.total)}</Text>
                  </InlineStack>
                </div>
                
                <InlineStack align="space-between" className="payment-method">
                  <p>METODO DE PAGO:</p>
                  <p>{completedSale.paymentMethod.toUpperCase()}</p>
                </InlineStack>
                
                {completedSale.paymentMethod === 'efectivo' && (
                  <>
                    <InlineStack align="space-between">
                      <p>RECIBIDO:</p>
                      <p>{formatCurrency(completedSale.amountPaid)}</p>
                    </InlineStack>
                    <InlineStack align="space-between" className="change">
                      <p>CAMBIO:</p>
                      <p>{formatCurrency(completedSale.change)}</p>
                    </InlineStack>
                  </>
                )}
              </div>

              {cliente && (
                <div className="loyalty-box">
                  <div className="divider-dashed" />
                  <p className="client-name">CLIENTE: {cliente.name.toUpperCase()}</p>
                  <InlineStack align="space-between">
                    <p>PUNTOS OBTENIDOS:</p>
                    <p>+{completedSale.pointsEarned}</p>
                  </InlineStack>
                </div>
              )}

              <div className="divider-dashed" />

              {/* Pie de Ticket */}
              <div className="footer">
                <p className="footer-msg">{sc.ticketFooter}</p>
                <div className="barcode-wrap">
                   <svg ref={barcodeRef}></svg>
                </div>
                <p className="slogan">POWERED BY OPENDEX POS</p>
              </div>
            </div>

          </BlockStack>
        </Box>

        <style>{`
          .ticket-paper {
            background: #fff;
            width: 300px;
            padding: 24px 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            font-family: 'Inter', sans-serif;
            color: #1a1a1a;
            position: relative;
            border-top: 5px solid #1a1a1a;
          }
          .ticket-paper.offline-border {
            border-top-color: #f59e0b;
          }
          .offline-banner {
            text-align: center;
            margin: 12px 0;
            background: #fef3c7;
            padding: 8px;
            border-radius: 4px;
          }
          .offline-msg { font-size: 10px; color: #92400e; font-weight: 600; margin-top: 4px; }
          
          .ticket-header { text-align: center; margin-bottom: 12px; }
          .store-details { font-size: 11px; color: #666; line-height: 1.4; margin-top: 4px; }
          
          .divider-dashed {
            border-top: 1px dashed #ccc;
            margin: 12px 0;
            width: 100%;
          }
          
          .sale-info { font-size: 12px; color: #333; }
          
          .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .items-table th { font-size: 10px; color: #888; padding-bottom: 8px; }
          .item-row { display: flex; gap: 8px; font-size: 12px; font-weight: 600; }
          .qty { color: #666; min-width: 25px; }
          .name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
          .unit-price { font-size: 10px; color: #999; margin-left: 33px; display: block; margin-top: 2px; }
          .items-table td { padding: 6px 0; }

          .totals-section { font-size: 12px; line-height: 1.6; }
          .grand-total { margin: 8px 0; padding-top: 8px; border-top: 1px solid #eee; }
          .payment-method { margin-top: 12px; font-weight: 600; }
          .discount { color: #ef4444; }
          .change { font-weight: bold; color: #10b981; }

          .loyalty-box { font-size: 11px; }
          .client-name { font-weight: bold; margin-bottom: 4px; }

          .footer { text-align: center; margin-top: 20px; }
          .footer-msg { font-size: 11px; white-space: pre-wrap; line-height: 1.4; color: #666; }
          .barcode-wrap { margin: 15px 0; display: flex; justify-content: center; }
          .slogan { font-size: 9px; letter-spacing: 2px; color: #ddd; font-weight: bold; margin-top: 10px; }
        `}</style>
      </Modal.Section>
    </Modal>
  );
}
