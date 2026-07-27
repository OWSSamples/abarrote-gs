'use client';

import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Badge } from '@cloudflare/kumo/components/badge';
import { formatCurrency } from '@/lib/utils';
import './TopProducts.css';

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  margin: number;
  trend: 'up' | 'down' | 'stable';
}

interface TopProductsProps {
  products?: TopProduct[];
  title?: string;
  period?: string;
}

const defaultTopProducts: TopProduct[] = [
  { id: '1', name: 'Coca-Cola 600ml', sku: 'BEB-001', unitsSold: 245, revenue: 4165, margin: 22, trend: 'up' },
  { id: '2', name: 'Leche Entera 1L', sku: 'LAC-001', unitsSold: 180, revenue: 5130, margin: 15, trend: 'up' },
  { id: '3', name: 'Pan Blanco Bimbo', sku: 'PAN-001', unitsSold: 156, revenue: 5460, margin: 18, trend: 'stable' },
  { id: '4', name: 'Huevo Blanco 1kg', sku: 'HUE-001', unitsSold: 142, revenue: 7384, margin: 12, trend: 'up' },
  { id: '5', name: 'Sabritas Original', sku: 'BOT-001', unitsSold: 128, revenue: 2560, margin: 35, trend: 'down' },
];

const trendConfig = {
  up: { label: '↑', color: '#16a34a' },
  down: { label: '↓', color: '#dc2626' },
  stable: { label: '–', color: '#71717a' },
} as const;

export function TopProducts({
  products = defaultTopProducts,
  title = 'Top productos',
  period = 'Hoy',
}: TopProductsProps) {
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalUnits = products.reduce((s, p) => s + p.unitsSold, 0);
  const maxRevenue = Math.max(...products.map((p) => p.revenue));

  return (
    <LayerCard className="kumo-top-products">
      <LayerCard.Secondary className="kumo-top-products__header">
        <h3 className="kumo-top-products__title">{title}</h3>
        <Badge variant="secondary">{period}</Badge>
      </LayerCard.Secondary>

      <LayerCard.Primary className="kumo-top-products__body">
        <div className="kumo-top-products__list">
          {products.map((product, i) => {
            const trend = trendConfig[product.trend];
            const barPct = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;
            const share = totalRevenue > 0 ? ((product.revenue / totalRevenue) * 100).toFixed(0) : '0';
            const isFirst = i === 0;

            return (
              <div key={product.id} className="kumo-top-products__item">
                <div
                  className="kumo-top-products__bar"
                  style={{
                    width: `${barPct}%`,
                    background: isFirst
                      ? 'linear-gradient(90deg, rgba(22, 163, 74, 0.08), rgba(22, 163, 74, 0.02))'
                      : 'linear-gradient(90deg, rgba(0, 0, 0, 0.03), transparent)',
                  }}
                />
                <div className="kumo-top-products__item-content">
                  <span className={`kumo-top-products__rank ${isFirst ? 'is-first' : ''}`}>{i + 1}</span>
                  <div className="kumo-top-products__details">
                    <span className={`kumo-top-products__name ${isFirst ? 'is-first' : ''}`}>{product.name}</span>
                    <div className="kumo-top-products__meta">
                      <span>{product.unitsSold} uds</span>
                      <span className="dot">·</span>
                      <span>{share}% del total</span>
                      <span className="dot">·</span>
                      <span style={{ color: trend.color }} className="trend">
                        {trend.label}
                      </span>
                    </div>
                  </div>
                  <span className="kumo-top-products__revenue">{formatCurrency(product.revenue)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="kumo-top-products__footer">
          <span>{totalUnits} unidades</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
        </div>
      </LayerCard.Primary>
    </LayerCard>
  );
}
