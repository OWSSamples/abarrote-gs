'use client';

import { Card, Text, Box, Icon, BlockStack, InlineStack, ProgressBar, Badge } from '@shopify/polaris';
import { ArrowUpIcon, ArrowDownIcon } from '@shopify/polaris-icons';
import type { ReactNode } from 'react';
import { formatCurrency, formatNumber } from '@/lib/utils';

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

  // Calculate percentage change from first to last entry
  const percentageChange = hasData ? getPercentageChange(Number(data[0]), Number(data.at(-1))) : (change ?? null);
  const chartTone = Number(percentageChange) < 0 ? 'critical' : Number(percentageChange) > 0 ? 'success' : 'neutral';
  const dataProgress = hasData ? getSeriesProgress(data) : 0;

  return (
    <Card>
      <Box minHeight="72px">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start" gap="300">
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" fontWeight="medium" tone="subdued">
                {title}
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {formattedValue}
              </Text>
            </BlockStack>
            {percentageChange !== null && (
              <Badge tone={chartTone === 'neutral' ? undefined : chartTone}>
                {`${Number(percentageChange) > 0 ? '+' : ''}${percentageChange}%`}
              </Badge>
            )}
          </InlineStack>

          {percentageChange !== null && (
            <InlineStack gap="100" blockAlign="center">
              {Number(percentageChange) > 0 ? (
                <Icon source={ArrowUpIcon} tone="success" />
              ) : Number(percentageChange) < 0 ? (
                <Icon source={ArrowDownIcon} tone="critical" />
              ) : null}
              <Text as="p" variant="bodySm" tone={chartTone === 'critical' ? 'critical' : chartTone === 'success' ? 'success' : 'subdued'}>
                {`${Math.abs(Number(percentageChange))}%`}
              </Text>
            </InlineStack>
          )}

          {hasData && (
            <BlockStack gap="100">
              <ProgressBar progress={dataProgress} size="small" tone={chartTone === 'critical' ? 'critical' : 'success'} />
              <Text as="p" variant="bodyXs" tone="subdued">
                Tendencia del periodo
              </Text>
            </BlockStack>
          )}
        </BlockStack>
      </Box>
    </Card>
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
