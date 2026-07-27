'use client';

import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Badge } from '@cloudflare/kumo/components/badge';
import type { ComponentProps } from 'react';
import { InventoryAlert, Product } from '@/types';
import { formatDate, getDaysUntil, getStockStatus } from '@/lib/utils';
import './InventoryTable.css';

type KumoBadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>;

interface InventoryTableProps {
  alerts: InventoryAlert[];
  onProductClick?: (product: Product) => void;
}

export function InventoryTable({ alerts, onProductClick }: InventoryTableProps) {
  const getAlertBadge = (alert: InventoryAlert) => {
    switch (alert.alertType) {
      case 'expiration':
        return <Badge variant="error">Vence pronto</Badge>;
      case 'expired':
        return <Badge variant="error">Vencido</Badge>;
      case 'low_stock':
        return <Badge variant="warning">Stock bajo</Badge>;
      case 'merma':
        return <Badge variant="info">Merma</Badge>;
      default:
        return <Badge variant="secondary">{alert.alertType}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string): KumoBadgeVariant => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'secondary';
    }
  };

  return (
    <LayerCard className="kumo-inv-card">
      <LayerCard.Secondary className="kumo-inv-card__header">
        <div>
          <h3 className="kumo-inv-card__title">Inventario prioritario</h3>
          <p className="kumo-inv-card__subtitle">{alerts.length} productos requieren atención inmediata</p>
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary className="kumo-inv-card__body">
        {alerts.length === 0 ? (
          <div className="kumo-inv-card__empty">
            <p>No hay alertas prioritarias registradas</p>
          </div>
        ) : (
          <div className="kumo-inv-card__table-wrap">
            <table className="kumo-inv-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                  <th>Vencimiento</th>
                  <th>Alerta</th>
                  <th>Severidad</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const { product } = alert;
                  const stockStatus = getStockStatus(product.currentStock, product.minStock);
                  const daysUntil = product.expirationDate ? getDaysUntil(product.expirationDate) : null;

                  return (
                    <tr
                      key={alert.id}
                      className="kumo-inv-table__row"
                      onClick={() => onProductClick?.(product)}
                      tabIndex={0}
                      role="button"
                    >
                      <td>
                        <div className="kumo-inv-table__product-col">
                          <span className="kumo-inv-table__product-name">{product.name}</span>
                          <span className="kumo-inv-table__product-sku">{product.sku}</span>
                        </div>
                      </td>
                      <td>
                        <div className="kumo-inv-table__stock-col">
                          <div className="kumo-inv-table__stock-meta">
                            <span>
                              {product.currentStock} / {product.minStock} uds
                            </span>
                            <span
                              className={`kumo-inv-table__stock-pct ${
                                stockStatus.status === 'critical' ? 'is-critical' : ''
                              }`}
                            >
                              {Math.round(stockStatus.percentage)}%
                            </span>
                          </div>
                          <div className="kumo-inv-table__track">
                            <div
                              className={`kumo-inv-table__bar ${
                                stockStatus.status === 'critical' ? 'is-critical' : ''
                              }`}
                              style={{ width: `${Math.min(100, Math.max(2, stockStatus.percentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        {product.expirationDate ? (
                          <div className="kumo-inv-table__exp-col">
                            <span>{formatDate(product.expirationDate)}</span>
                            {daysUntil !== null && (
                              <span className={`kumo-inv-table__days ${daysUntil <= 2 ? 'is-critical' : ''}`}>
                                {daysUntil <= 0 ? 'Vencido' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil} días`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="kumo-inv-table__na">N/A</span>
                        )}
                      </td>
                      <td>{getAlertBadge(alert)}</td>
                      <td>
                        <Badge variant={getSeverityBadge(alert.severity)} appearance="dot">
                          {alert.severity}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </LayerCard.Primary>
    </LayerCard>
  );
}
