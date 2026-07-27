'use client';

import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Badge } from '@cloudflare/kumo/components/badge';
import { ArrowUp16Regular, ArrowDown16Regular } from '@fluentui/react-icons';
import type { ReactNode } from 'react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import './KPICard.css';

interface KPICardProps {
  title: string;
  value: number;
  type: 'currency' | 'number' | 'percentage';
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  data?: number[];
}

export function KPICard({
  title,
  value,
  type,
  change,
  changeLabel: _changeLabel = 'vs ayer',
  icon: _icon,
  data = [],
}: KPICardProps) {
  const formattedValue =
    type === 'currency' ? formatCurrency(value) : type === 'percentage' ? `${value}%` : formatNumber(value);

  const hasData = data && data.length > 1;
  const percentageChange = hasData ? getPercentageChange(Number(data[0]), Number(data.at(-1))) : (change ?? null);

  const kumoBadgeVariant =
    Number(percentageChange) < 0 ? 'error' : Number(percentageChange) > 0 ? 'success' : 'secondary';
  const dataProgress = hasData ? getSeriesProgress(data) : 0;

  return (
    <LayerCard className="kumo-kpi-card">
      <LayerCard.Primary className="kumo-kpi-card__body">
        <div className="kumo-kpi-card__header">
          <span className="kumo-kpi-card__title">{title}</span>
          {percentageChange !== null && (
            <Badge variant={kumoBadgeVariant} appearance="filled">
              {`${Number(percentageChange) > 0 ? '+' : ''}${percentageChange}%`}
            </Badge>
          )}
        </div>

        <div className="kumo-kpi-card__value-row">
          <span className="kumo-kpi-card__value">{formattedValue}</span>
          {percentageChange !== null && (
            <span className={`kumo-kpi-card__trend kumo-kpi-card__trend--${kumoBadgeVariant}`}>
              <span className="h-lh flex items-center">
                {Number(percentageChange) > 0 ? (
                  <ArrowUp16Regular aria-hidden="true" />
                ) : Number(percentageChange) < 0 ? (
                  <ArrowDown16Regular aria-hidden="true" />
                ) : null}
              </span>
              <span>{Math.abs(Number(percentageChange))}%</span>
            </span>
          )}
        </div>

        {hasData && (
          <div className="kumo-kpi-card__progress-wrap">
            <div className="kumo-kpi-card__track">
              <div
                className={`kumo-kpi-card__bar kumo-kpi-card__bar--${kumoBadgeVariant}`}
                style={{ width: `${Math.min(100, Math.max(4, dataProgress))}%` }}
              />
            </div>
            <span className="kumo-kpi-card__subtext">Tendencia del periodo</span>
          </div>
        )}
      </LayerCard.Primary>
    </LayerCard>
  );
}

function getPercentageChange(start: number, end: number): number | null {
  if (isNaN(start) || isNaN(end) || start === 0) return null;
  const percentage = Math.round(((end - start) / start) * 100);
  if (percentage > 999) return 999;
  if (percentage < -999) return -999;
  return percentage;
}

function getSeriesProgress(data: number[]): number {
  const values = data.map(Number).filter((value) => Number.isFinite(value));
  if (values.length < 2) return 0;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return 100;

  return Math.max(0, Math.min(100, Math.round(((values.at(-1)! - min) / range) * 100)));
}
