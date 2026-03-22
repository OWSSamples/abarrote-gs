'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  Icon,
  IndexTable,
  InlineGrid,
  InlineStack,
  ProgressBar,
  Select,
  Tabs,
  Text,
  TextField,
  Tooltip,
} from '@shopify/polaris';
import { SearchIcon, SettingsIcon, NotificationIcon } from '@shopify/polaris-icons';
import type { InventoryAlert, Product, StoreConfig } from '@/types';

interface NotificationsCenterProps {
  alerts: InventoryAlert[];
  storeConfig: StoreConfig;
  onProductClick?: (product: Product) => void;
  onOpenSettings?: () => void;
}

type TypeFilter = 'all' | InventoryAlert['alertType'];

const TYPE_LABELS: Record<InventoryAlert['alertType'], string> = {
  low_stock: 'Stock bajo',
  expiration: 'Por vencer',
  expired: 'Vencido',
  merma: 'Merma',
};

const SEVERITY_ORDER: Record<InventoryAlert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '–';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function StockBar({ current, minimum, severity }: {
  current: number;
  minimum: number;
  severity: InventoryAlert['severity'];
}) {
  const ratio = minimum > 0 ? Math.min(Math.round((current / minimum) * 100), 100) : 100;
  const tone = severity === 'critical' ? 'critical' : severity === 'warning' ? 'highlight' : 'success';
  return (
    <InlineStack gap="150" blockAlign="center" wrap={false}>
      <div style={{ width: 80 }}>
        <ProgressBar size="small" tone={tone} progress={ratio} />
      </div>
      <Text as="span" variant="bodyXs" tone="subdued">{current}/{minimum}</Text>
    </InlineStack>
  );
}

function MetricCard({ label, value, tone, subtitle, icon }: {
  label: string;
  value: number | string;
  tone: 'success' | 'critical' | 'attention' | 'info';
  subtitle?: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between">
          <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">{label.toUpperCase()}</Text>
          <div style={{ color: `var(--p-color-icon-${tone})` }}>
            <Icon source={icon} tone="inherit" />
          </div>
        </InlineStack>
        <BlockStack gap="050">
          <Text as="h2" variant="heading2xl" fontWeight="bold">{value}</Text>
          {subtitle && <Text as="p" variant="bodyXs" tone="subdued">{subtitle}</Text>}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

export function NotificationsCenter({
  alerts,
  storeConfig,
  onProductClick,
  onOpenSettings,
}: NotificationsCenterProps) {
  const [queryValue, setQueryValue] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const counts = useMemo(() => ({
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  }), [alerts]);

  const tabs = useMemo(() => [
    { id: 'all', content: `Todas (${counts.all})`, panelID: 'panel-all' },
    { id: 'critical', content: `Críticas (${counts.critical})`, panelID: 'panel-critical' },
    { id: 'warning', content: `Advertencias (${counts.warning})`, panelID: 'panel-warning' },
    { id: 'info', content: `Info (${counts.info})`, panelID: 'panel-info' },
  ], [counts]);

  const severityFromTab = useMemo<'all' | InventoryAlert['severity']>(() => {
    const map = ['all', 'critical', 'warning', 'info'] as const;
    return map[selectedTab];
  }, [selectedTab]);

  const filteredAlerts = useMemo(() => {
    const q = queryValue.trim().toLowerCase();
    return alerts
      .filter((alert) => {
        if (severityFromTab !== 'all' && alert.severity !== severityFromTab) return false;
        if (typeFilter !== 'all' && alert.alertType !== typeFilter) return false;
        if (!q) return true;
        return [
          alert.product.name,
          alert.product.sku,
          alert.product.category,
          alert.message,
          TYPE_LABELS[alert.alertType],
        ].some((v) => v?.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [alerts, severityFromTab, typeFilter, queryValue]);

  const isConnected = !!(
    storeConfig.enableNotifications &&
    storeConfig.telegramToken &&
    storeConfig.telegramChatId
  );

  const rowMarkup = filteredAlerts.map((alert, index) => {
    const badgeTone = alert.severity === 'critical'
      ? 'critical'
      : alert.severity === 'warning'
      ? 'warning'
      : 'info';
    const rowTone = alert.severity === 'critical'
      ? 'critical'
      : alert.severity === 'warning'
      ? 'warning'
      : undefined;

    return (
      <IndexTable.Row id={alert.id} key={alert.id} position={index} tone={rowTone}>
        {/* Severity indicator */}
        <IndexTable.Cell>
          <Badge tone={badgeTone as any}>
            {alert.severity === 'critical' ? 'Crítica' : alert.severity === 'warning' ? 'Advertencia' : 'Info'}
          </Badge>
        </IndexTable.Cell>

        {/* Product name + meta */}
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Button variant="plain" onClick={() => onProductClick?.(alert.product)}>
              {alert.product.name}
            </Button>
            <InlineStack gap="100" wrap>
              {alert.product.category && (
                <Text as="span" variant="bodyXs" tone="subdued">{alert.product.category}</Text>
              )}
              {alert.product.sku && (
                <Text as="span" variant="bodyXs" tone="subdued">· SKU {alert.product.sku}</Text>
              )}
            </InlineStack>
          </BlockStack>
        </IndexTable.Cell>

        {/* Alert type */}
        <IndexTable.Cell>
          <Badge>{TYPE_LABELS[alert.alertType]}</Badge>
        </IndexTable.Cell>

        {/* Stock level bar */}
        <IndexTable.Cell>
          <StockBar
            current={alert.product.currentStock}
            minimum={alert.product.minStock}
            severity={alert.severity}
          />
        </IndexTable.Cell>

        {/* Message */}
        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">{alert.message}</Text>
        </IndexTable.Cell>

        {/* Relative time */}
        <IndexTable.Cell>
          <Tooltip content={new Date(alert.createdAt).toLocaleString('es-MX')}>
            <Text as="span" variant="bodyXs" tone="subdued">{getRelativeTime(alert.createdAt)}</Text>
          </Tooltip>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <BlockStack gap="400">
      {/* ── Header ── */}
      <Box paddingBlockEnd="400">
        <BlockStack gap="400">
          <Banner tone="info" title="Sistema de Notificaciones en Beta">
            <p>
              Este centro de control está en fase Beta. Estamos priorizando las <strong>notificaciones vía Telegram</strong> para una gestión más inmediata.
              {!isConnected && " Actualmente Telegram no está configurado."}
            </p>
          </Banner>

          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h1" variant="headingLg">Gestión de Alertas</Text>
                <Badge tone="attention">Beta</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                Monitoreo centralizado · Canal principal sugerido: Telegram.
              </Text>
            </BlockStack>
            <Button icon={SettingsIcon} onClick={onOpenSettings}>
              Configurar Telegram
            </Button>
          </InlineStack>
        </BlockStack>
      </Box>

      {/* ── Metric cards ── */}
      <Box paddingBlockEnd="400">
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          <MetricCard
            label="Total Alertas"
            value={counts.all}
            tone="info"
            subtitle="Pendientes globales"
            icon={NotificationIcon}
          />
          <MetricCard
            label="Casos Críticos"
            value={counts.critical}
            tone="critical"
            subtitle="Resolver de inmediato"
            icon={SearchIcon}
          />
          <MetricCard
            label="Advertencias"
            value={counts.warning}
            tone="attention"
            subtitle="Monitoreo preventivo"
            icon={SearchIcon}
          />
          <MetricCard
            label="Canal Externo"
            value={isConnected ? 'Conectado' : 'Pendiente'}
            tone={isConnected ? 'success' : 'attention'}
            subtitle={isConnected ? 'Telegram activo' : 'Configuración necesaria'}
            icon={SettingsIcon}
          />
        </InlineGrid>
      </Box>

      {/* ── Main alerts table ── */}
      <Card padding="0">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {/* Toolbar */}
          <Box padding="400" paddingBlockEnd="300">
            <InlineStack gap="300" wrap>
              <div style={{ flex: 2, minWidth: 240 }}>
                <TextField
                  label="Buscar"
                  labelHidden
                  autoComplete="off"
                  value={queryValue}
                  onChange={setQueryValue}
                  prefix={<Icon source={SearchIcon} tone="subdued" /> as any}
                  placeholder="Buscar por producto, SKU, categoría o mensaje…"
                  clearButton
                  onClearButtonClick={() => setQueryValue('')}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Select
                  label="Tipo"
                  labelHidden
                  options={[
                    { label: 'Todos los tipos', value: 'all' },
                    { label: 'Stock bajo', value: 'low_stock' },
                    { label: 'Por vencer', value: 'expiration' },
                    { label: 'Vencido', value: 'expired' },
                    { label: 'Merma', value: 'merma' },
                  ]}
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as TypeFilter)}
                />
              </div>
            </InlineStack>
          </Box>

          {/* Telegram warning banner */}
          {!isConnected && (
            <Box paddingInline="400" paddingBlockEnd="300">
              <Banner tone="warning" title="Canal externo no configurado">
                <p>Las alertas críticas no se enviarán a supervisión. Configura Telegram para recibir avisos en tiempo real.</p>
              </Banner>
            </Box>
          )}

          {/* Empty state */}
          {filteredAlerts.length === 0 ? (
            <Box padding="600">
              <EmptyState
                heading={alerts.length === 0 ? '¡Todo en orden!' : 'Sin resultados para este filtro'}
                image=""
              >
                <p>
                  {alerts.length === 0
                    ? 'No hay alertas activas. El inventario está dentro de los parámetros normales.'
                    : 'Ajusta la búsqueda o el tipo de alerta para ver otros resultados.'}
                </p>
              </EmptyState>
            </Box>
          ) : (
            <IndexTable
              resourceName={{ singular: 'alerta', plural: 'alertas' }}
              itemCount={filteredAlerts.length}
              selectable={false}
              headings={[
                { title: 'Severidad' },
                { title: 'Producto' },
                { title: 'Tipo' },
                { title: 'Nivel de stock' },
                { title: 'Mensaje' },
                { title: 'Tiempo' },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Tabs>
      </Card>
    </BlockStack>
  );
}