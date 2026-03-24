'use client';

import { useEffect, useState } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { 
  Box, 
  Text, 
  BlockStack, 
  InlineStack, 
  Divider,
  Icon
} from '@shopify/polaris';
import { 
  OrderIcon, 
  CreditCardIcon, 
  CashIcon, 
  TickIcon,
  StoreIcon
} from '@shopify/polaris-icons';

interface SaleState {
  items: any[];
  total: number;
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  discountAmount: number;
  paymentMethod: string;
  status: 'idle' | 'active' | 'paying' | 'finished';
  folio?: string;
}

export default function CustomerDisplayPage() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const [sale, setSale] = useState<SaleState>({
    items: [],
    total: 0,
    subtotal: 0,
    iva: 0,
    cardSurcharge: 0,
    discountAmount: 0,
    paymentMethod: 'efectivo',
    status: 'idle'
  });

  useEffect(() => {
    const channel = new BroadcastChannel('customer_display');
    
    channel.onmessage = (event) => {
      if (event.data.type === 'UPDATE_SALE') {
        setSale(event.data.payload);
      }
    };

    return () => channel.close();
  }, []);

  // Animation effect for finished sale
  useEffect(() => {
    if (sale.status === 'finished') {
      const timer = setTimeout(() => {
        setSale(prev => ({ ...prev, status: 'idle', items: [], total: 0 }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [sale.status]);

  if (sale.status === 'idle') {
    return (
      <div className="display-container idle">
        <BlockStack gap="1000" align="center">
          {storeConfig.logoUrl ? (
            <img src={storeConfig.logoUrl} alt="Logo" className="main-logo" />
          ) : (
            <div className="placeholder-logo">
               <Icon source={StoreIcon} tone="base" />
               <Text variant="heading2xl" as="h1">{storeConfig.storeName}</Text>
            </div>
          )}
          <div className="welcome-text">
            <Text variant="heading3xl" as="h1" alignment="center">
              ¡Bienvenido a {storeConfig.storeName}!
            </Text>
            <Text variant="headingLg" as="p" tone="subdued" alignment="center">
              Estamos a su servicio
            </Text>
          </div>
        </BlockStack>
        {renderStyles()}
      </div>
    );
  }

  return (
    <div className="display-container active">
      <div className="main-layout">
        {/* Left Side: Items List */}
        <div className="items-column">
          <div className="column-header">
            <InlineStack gap="200" align="start" blockAlign="center">
               <Icon source={OrderIcon} />
               <Text variant="headingLg" as="h2">Su Compra</Text>
            </InlineStack>
          </div>
          <div className="items-list">
            {sale.items.map((item, idx) => (
              <div key={idx} className="item-row">
                <div className="item-info">
                  <Text variant="bodyLg" as="p" fontWeight="bold">{item.productName}</Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                  </Text>
                </div>
                <div className="item-price">
                  <Text variant="bodyLg" as="p" fontWeight="bold">
                    {formatCurrency(item.subtotal)}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Totals & Branding */}
        <div className="totals-column">
          <div className="branding-mini">
             {storeConfig.logoUrl && (
               <img src={storeConfig.logoUrl} alt="Logo mini" className="mini-logo" />
             )}
             <Text variant="headingMd" as="h3">{storeConfig.storeName}</Text>
          </div>

          <div className="totals-card">
            <BlockStack gap="400">
              <div className="total-row sub">
                <Text variant="bodyLg" as="p">Subtotal</Text>
                <Text variant="bodyLg" as="p">{formatCurrency(sale.subtotal)}</Text>
              </div>
              {sale.discountAmount > 0 && (
                <div className="total-row discount">
                  <Text variant="bodyLg" as="p">Descuento</Text>
                  <Text variant="bodyLg" as="p" tone="success">-{formatCurrency(sale.discountAmount)}</Text>
                </div>
              )}
              {sale.cardSurcharge > 0 && (
                <div className="total-row surcharge">
                  <Text variant="bodyLg" as="p">Comisión Tarjeta</Text>
                  <Text variant="bodyLg" as="p">+{formatCurrency(sale.cardSurcharge)}</Text>
                </div>
              )}
              <Divider />
              <div className="total-row main">
                <Text variant="heading3xl" as="p">TOTAL</Text>
                <Text variant="heading3xl" as="p" fontWeight="bold">{formatCurrency(sale.total)}</Text>
              </div>
            </BlockStack>
          </div>

          <div className="status-indicator">
            {sale.status === 'paying' ? (
              <div className="paying-box">
                <Icon source={CreditCardIcon} tone="warning" />
                <Text variant="headingLg" as="p">Esperando Pago...</Text>
              </div>
            ) : sale.status === 'finished' ? (
              <div className="finished-box">
                <div className="success-icon">
                   <Icon source={TickIcon} tone="success" />
                </div>
                <Text variant="headingLg" as="p">¡Pago Exitoso!</Text>
                <Text variant="bodyMd" as="p" tone="subdued">Folio: {sale.folio}</Text>
              </div>
            ) : (
              <div className="payment-method-icon">
                 <Icon source={sale.paymentMethod === 'efectivo' ? CashIcon : CreditCardIcon} />
                 <Text variant="bodyMd" as="p" tone="subdued">Pago con {sale.paymentMethod}</Text>
              </div>
            )}
          </div>
          
          <div className="footer-message">
             <Text variant="bodySm" as="p" tone="subdued">Gracias por preferir {storeConfig.storeName}</Text>
          </div>
        </div>
      </div>
      {renderStyles()}
    </div>
  );
}

function renderStyles() {
  return (
    <style jsx global>{`
      body, html {
        margin: 0;
        padding: 0;
        height: 100vh;
        overflow: hidden;
        background: #f4f6f8;
      }

      .display-container {
        height: 100vh;
        width: 100vw;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .display-container.idle {
        background: radial-gradient(circle at center, #ffffff 0%, #f4f6f8 100%);
      }

      .main-logo {
        max-width: 300px;
        max-height: 200px;
        object-fit: contain;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,0.1));
      }

      .placeholder-logo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }

      .welcome-text {
        animation: fadeIn 2s ease-out;
      }

      .main-layout {
        display: flex;
        width: 100%;
        height: 100%;
      }

      .items-column {
        flex: 1.5;
        background: white;
        padding: 40px;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }

      .column-header {
        margin-bottom: 40px;
        border-bottom: 2px solid #f1f2f3;
        padding-bottom: 20px;
      }

      .items-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .item-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 0;
        border-bottom: 1px solid #f9fafb;
        animation: slideIn 0.3s ease-out;
      }

      .totals-column {
        flex: 1;
        background: #f4f6f8;
        padding: 40px;
        display: flex;
        flex-direction: column;
        gap: 30px;
        box-shadow: inset 10px 0 20px rgba(0,0,0,0.02);
      }

      .branding-mini {
        display: flex;
        align-items: center;
        gap: 15px;
      }

      .mini-logo {
        height: 40px;
        object-fit: contain;
      }

      .totals-card {
        background: white;
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      }

      .total-row {
        display: flex;
        justify-content: space-between;
      }

      .total-row.main {
        margin-top: 10px;
        color: #008060;
      }

      .status-indicator {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .paying-box, .finished-box {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        padding: 30px;
        background: white;
        border-radius: 20px;
        width: 100%;
        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
      }

      .success-icon {
        width: 60px;
        height: 60px;
        background: #e3f1df;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      .footer-message {
        text-align: center;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes scaleIn {
        from { transform: scale(0); }
        to { transform: scale(1); }
      }
    `}</style>
  );
}
