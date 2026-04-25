'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  IndexTable,
  InlineGrid,
  InlineStack,
  OptionList,
  Popover,
  ProgressBar,
  Tabs,
  Text,
  TextField,
  Tooltip,
} from '@shopify/polaris';
import {
  SearchIcon,
  SettingsIcon,
  NotificationIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InventoryIcon,
  CalendarIcon,
  XCircleIcon,
  CartIcon,
} from '@shopify/polaris-icons';
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

const TYPE_ICONS: Record<InventoryAlert['alertType'], React.FC<React.SVGProps<SVGSVGElement>>> = {
  low_stock: InventoryIcon,
  expiration: CalendarIcon,
  expired: XCircleIcon,
  merma: CartIcon,
};

const SEVERITY_ORDER: Record<InventoryAlert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_LABELS: Record<InventoryAlert['severity'], string> = {
  critical: 'Críticas',
  warning: 'Advertencias',
  info: 'Informativas',
};

const SEVERITY_TONES: Record<InventoryAlert['severity'], 'critical' | 'highlight' | 'success'> = {
  critical: 'critical',
  warning: 'highlight',
  info: 'success',
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

function StockBar({
  current,
  minimum,
  severity,
}: {
  current: number;
  minimum: number;
  severity: InventoryAlert['severity'];
}) {
  const ratio = minimum > 0 ? Math.min(Math.round((current / minimum) * 100), 100) : 100;
  const tone = SEVERITY_TONES[severity];
  return (
    <InlineStack gap="150" blockAlign="center" wrap={false}>
      <div style={{ width: 80 }}>
        <ProgressBar size="small" tone={tone} progress={ratio} />
      </div>
      <Text as="span" variant="bodyXs" tone="subdued">
        {current}/{minimum}
      </Text>
    </InlineStack>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <BlockStack gap="200">
      <BlockStack gap="100">
        <Text as="h2" variant="headingMd" fontWeight="semibold">
          {title}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {subtitle}
        </Text>
      </BlockStack>
      <Divider />
    </BlockStack>
  );
}

export function NotificationsCenter({ alerts, storeConfig, onProductClick, onOpenSettings }: NotificationsCenterProps) {
  const [queryValue, setQueryValue] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);

  const counts = useMemo(
    () => ({
      all: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
    }),
    [alerts],
  );

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = { low_stock: 0, expiration: 0, expired: 0, merma: 0 };
    for (const a of alerts) map[a.alertType] = (map[a.alertType] || 0) + 1;
    return map;
  }, [alerts]);

  const tabs = useMemo(
    () => [
      { id: 'all', content: `Todas (${counts.all})`, panelID: 'panel-all' },
      { id: 'critical', content: `Críticas (${counts.critical})`, panelID: 'panel-critical' },
      { id: 'warning', content: `Advertencias (${counts.warning})`, panelID: 'panel-warning' },
      { id: 'info', content: `Info (${counts.info})`, panelID: 'panel-info' },
    ],
    [counts],
  );

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

  const isConnected = !!(storeConfig.enableNotifications && storeConfig.telegramToken && storeConfig.telegramChatId);

  const criticalPct = counts.all > 0 ? Math.round((counts.critical / counts.all) * 100) : 0;

  const rowMarkup = filteredAlerts.map((alert, index) => {
    const badgeTone = alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info';
    const rowTone = alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : undefined;

    return (
      <IndexTable.Row id={alert.id} key={alert.id} position={index} tone={rowTone}>
        <IndexTable.Cell>
          <Badge tone={badgeTone}>
            {alert.severity === 'critical' ? 'Crítica' : alert.severity === 'warning' ? 'Advertencia' : 'Info'}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Button variant="plain" onClick={() => onProductClick?.(alert.product)}>
              {alert.product.name}
            </Button>
            <InlineStack gap="100" wrap>
              {alert.product.category && (
                <Text as="span" variant="bodyXs" tone="subdued">
                  {alert.product.category}
                </Text>
              )}
              {alert.product.sku && (
                <Text as="span" variant="bodyXs" tone="subdued">
                  · SKU {alert.product.sku}
                </Text>
              )}
            </InlineStack>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100" blockAlign="center" wrap={false}>
            <Icon source={TYPE_ICONS[alert.alertType]} tone="subdued" />
            <Badge>{TYPE_LABELS[alert.alertType]}</Badge>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <StockBar current={alert.product.currentStock} minimum={alert.product.minStock} severity={alert.severity} />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {alert.message}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Tooltip content={new Date(alert.createdAt).toLocaleString('es-MX')}>
            <Text as="span" variant="bodyXs" tone="subdued">
              {getRelativeTime(alert.createdAt)}
            </Text>
          </Tooltip>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const typeFilterLabel = typeFilter === 'all' ? 'Todos los tipos' : TYPE_LABELS[typeFilter];

  return (
    <BlockStack gap="600">
      {/* ═══════════════════════════════════════════════════════════════
          Chapter 1 · Panorama de Alertas — KPIs macro
         ═══════════════════════════════════════════════════════════════ */}
      <BlockStack gap="400">
        <SectionHeader
          title="Panorama de Alertas"
          subtitle={`${counts.all} alertas activas · ${criticalPct}% requieren acción inmediata`}
        />
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
                  TOTAL ALERTAS
                </Text>
                <div style={{ color: 'var(--p-color-icon-info)' }}>
                  <Icon source={NotificationIcon} tone="inherit" />
                </div>
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {counts.all}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Pendientes de revisión
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
                  CASOS CRÍTICOS
                </Text>
                <div style={{ color: 'var(--p-color-icon-critical)' }}>
                  <Icon source={AlertCircleIcon} tone="inherit" />
                </div>
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {counts.critical}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Resolver de inmediato
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
                  ADVERTENCIAS
                </Text>
                <div style={{ color: 'var(--p-color-icon-caution)' }}>
                  <Icon source={AlertTriangleIcon} tone="inherit" />
                </div>
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {counts.warning}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Monitoreo preventivo
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
                  CANAL EXTERNO
                </Text>
                <div style={{ color: isConnected ? 'var(--p-color-icon-success)' : 'var(--p-color-icon-caution)' }}>
                  <Icon source={isConnected ? CheckCircleIcon : SettingsIcon} tone="inherit" />
                </div>
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {isConnected ? 'Activo' : 'Pendiente'}
              </Text>
              <InlineStack gap="100" blockAlign="center">
                <Text as="p" variant="bodyXs" tone="subdued">
                  {isConnected ? 'Telegram conectado' : 'Configuración necesaria'}
                </Text>
                {!isConnected && (
                  <Button variant="plain" size="micro" onClick={onOpenSettings}>
                    Configurar
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>

      {/* ═══════════════════════════════════════════════════════════════
          Chapter 2 · Distribución — Severidad + Tipo
         ═══════════════════════════════════════════════════════════════ */}
      <BlockStack gap="400">
        <SectionHeader
          title="Distribución de Alertas"
          subtitle="Proporción por severidad y tipo de alerta activa"
        />
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {/* Severity distribution */}
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingSm" fontWeight="semibold">
                Por Severidad
              </Text>
              <BlockStack gap="300">
                {(['critical', 'warning', 'info'] as const).map((sev) => {
                  const count = counts[sev];
                  const pct = counts.all > 0 ? Math.round((count / counts.all) * 100) : 0;
                  return (
                    <BlockStack key={sev} gap="100">
                      <InlineStack align="space-between">
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={sev === 'critical' ? 'critical' : sev === 'warning' ? 'warning' : 'info'}>
                            {SEVERITY_LABELS[sev]}
                          </Badge>
                        </InlineStack>
                        <Text as="span" variant="bodySm" fontWeight="medium">
                          {count} ({pct}%)
                        </Text>
                      </InlineStack>
                      <ProgressBar size="small" tone={SEVERITY_TONES[sev]} progress={pct} />
                    </BlockStack>
                  );
                })}
              </BlockStack>
            </BlockStack>
          </Card>

          {/* Type distribution */}
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingSm" fontWeight="semibold">
                Por Tipo de Alerta
              </Text>
              <BlockStack gap="300">
                {(Object.keys(TYPE_LABELS) as InventoryAlert['alertType'][]).map((type) => {
                  const count = typeCounts[type] || 0;
                  const pct = counts.all > 0 ? Math.round((count / counts.all) * 100) : 0;
                  return (
                    <BlockStack key={type} gap="100">
                      <InlineStack align="space-between">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={TYPE_ICONS[type]} tone="subdued" />
                          <Text as="span" variant="bodySm">
                            {TYPE_LABELS[type]}
                          </Text>
                        </InlineStack>
                        <Text as="span" variant="bodySm" fontWeight="medium">
                          {count} ({pct}%)
                        </Text>
                      </InlineStack>
                      <ProgressBar
                        size="small"
                        tone={type === 'expired' ? 'critical' : type === 'merma' ? 'critical' : 'highlight'}
                        progress={pct}
                      />
                    </BlockStack>
                  );
                })}
              </BlockStack>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>

      {/* ═══════════════════════════════════════════════════════════════
          Chapter 3 · Detalle de Alertas — Tabla interactiva
         ═══════════════════════════════════════════════════════════════ */}
      <BlockStack gap="400">
        <SectionHeader
          title="Detalle de Alertas"
          subtitle={`${filteredAlerts.length} de ${counts.all} alertas visibles con filtros actuales`}
        />

        {!isConnected && (
          <Banner tone="warning" title="Canal externo no configurado">
            <p>
              Las alertas críticas no se enviarán a supervisión. Configura Telegram para recibir avisos en tiempo real.
            </p>
          </Banner>
        )}

        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box padding="400" paddingBlockEnd="300">
              <InlineStack gap="300" wrap>
                <div style={{ flex: 2, minWidth: 240 }}>
                  <TextField
                    label="Buscar"
                    labelHidden
                    autoComplete="off"
                    value={queryValue}
                    onChange={setQueryValue}
                    prefix={<Icon source={SearchIcon} tone="subdued" />}
                    placeholder="Buscar por producto, SKU, categoría o mensaje…"
                    clearButton
                    onClearButtonClick={() => setQueryValue('')}
                  />
                </div>
                <div style={{ minWidth: 160 }}>
                  <Popover
                    active={typePopoverOpen}
                    activator={
                      <Button
                        onClick={() => setTypePopoverOpen((o) => !o)}
                        disclosure={typePopoverOpen ? 'up' : 'down'}
                        fullWidth
                      >
                        {typeFilterLabel}
                      </Button>
                    }
                    onClose={() => setTypePopoverOpen(false)}
                    preferredAlignment="left"
                    fullWidth
                  >
                    <OptionList
                      onChange={([v]) => {
                        setTypeFilter((v as TypeFilter) || 'all');
                        setTypePopoverOpen(false);
                      }}
                      options={[
                        { label: 'Todos los tipos', value: 'all' },
                        { label: `Stock bajo (${typeCounts.low_stock || 0})`, value: 'low_stock' },
                        { label: `Por vencer (${typeCounts.expiration || 0})`, value: 'expiration' },
                        { label: `Vencido (${typeCounts.expired || 0})`, value: 'expired' },
                        { label: `Merma (${typeCounts.merma || 0})`, value: 'merma' },
                      ]}
                      selected={[typeFilter]}
                    />
                  </Popover>
                </div>
              </InlineStack>
            </Box>

            {filteredAlerts.length === 0 ? (
              <Box padding="600">
                <EmptyState
                  heading={alerts.length === 0 ? '¡Todo en orden!' : 'Sin resultados para este filtro'}
                  image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg"
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
    </BlockStack>
  );
}
