'use client';

import { useCallback, useState, useTransition, useEffect, useMemo } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  Box,
  Checkbox,
  Divider,
  Banner,
  Badge,
  Icon,
  TextField,
  RangeSlider,
  Tabs,
  ButtonGroup,
  Button,
  Collapsible,
  Tooltip,
} from '@shopify/polaris';
import {
  ReceiptIcon,
  CashDollarIcon,
  ViewIcon,
  ImageIcon,
  TextFontIcon,
  SettingsIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon,
  PrintIcon,
  ResetIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { parseError } from '@/lib/errors';
import { TicketPreview } from './TicketPreview';
import type {
  TicketDesignConfig,
  TicketPaperWidth,
  TicketFontSize,
  TicketSeparatorStyle,
} from '@/types';
import { DEFAULT_TICKET_DESIGN } from '@/types';

// ═══════════════════════════════════════════════════════════
// Option definitions
// ═══════════════════════════════════════════════════════════

const PAPER_OPTS: { label: string; value: TicketPaperWidth; help: string }[] = [
  { label: '58mm', value: '58mm', help: 'Mini / portable' },
  { label: '72mm', value: '72mm', help: 'Estándar' },
  { label: '80mm', value: '80mm', help: 'Ancho' },
];

const FONT_OPTS: { label: string; value: TicketFontSize }[] = [
  { label: 'Pequeña', value: 'small' },
  { label: 'Mediana', value: 'medium' },
  { label: 'Grande', value: 'large' },
];

const SEP_OPTS: { label: string; value: TicketSeparatorStyle }[] = [
  { label: '─ Guiones', value: 'dashes' },
  { label: '· Puntos', value: 'dots' },
  { label: '━ Línea', value: 'line' },
  { label: '═ Doble', value: 'double' },
  { label: '✦ Estrellas', value: 'stars' },
  { label: 'Ninguno', value: 'none' },
];

const BARCODE_OPTS: { label: string; value: 'CODE128' | 'CODE39' | 'QR' }[] = [
  { label: 'CODE128', value: 'CODE128' },
  { label: 'CODE39', value: 'CODE39' },
  { label: 'QR Code', value: 'QR' },
];

const LOGO_SIZE_OPTS: { label: string; value: 'small' | 'medium' | 'large' }[] = [
  { label: 'S', value: 'small' },
  { label: 'M', value: 'medium' },
  { label: 'L', value: 'large' },
];

// ═══════════════════════════════════════════════════════════
// Collapsible section header
// ═══════════════════════════════════════════════════════════

function SectionHeader({
  icon,
  title,
  badge,
  open,
  onToggle,
}: {
  icon: typeof ReceiptIcon;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="200" blockAlign="center">
          <Icon source={icon} tone="base" />
          <Text variant="headingSm" as="h3">{title}</Text>
          {badge && <Badge tone="info">{badge}</Badge>}
        </InlineStack>
        <Icon source={open ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
      </InlineStack>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════

export function TicketDesignerSection() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const saveStoreConfig = useDashboardStore((s) => s.saveStoreConfig);

  // ── State ──
  const [selectedTab, setSelectedTab] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    header: true, items: true, totals: true, footer: false, barcode: false, style: false, advanced: false,
  });
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Design state per ticket type
  const [designVenta, setDesignVenta] = useState<TicketDesignConfig>(
    () => storeConfig.ticketDesignVenta ?? { ...DEFAULT_TICKET_DESIGN },
  );
  const [designCorte, setDesignCorte] = useState<TicketDesignConfig>(
    () => storeConfig.ticketDesignCorte ?? { ...DEFAULT_TICKET_DESIGN, headerNote: 'CORTE DE CAJA' },
  );

  // Sync from store on hydration
  useEffect(() => {
    if (storeConfig.ticketDesignVenta) setDesignVenta(storeConfig.ticketDesignVenta);
    if (storeConfig.ticketDesignCorte) setDesignCorte(storeConfig.ticketDesignCorte);
  }, [storeConfig.ticketDesignVenta, storeConfig.ticketDesignCorte]);

  const isVenta = selectedTab === 0;
  const currentDesign = isVenta ? designVenta : designCorte;
  const setCurrentDesign = isVenta ? setDesignVenta : setDesignCorte;
  const configKey = isVenta ? 'ticketDesignVenta' : 'ticketDesignCorte';
  const ticketType = isVenta ? 'venta' as const : 'corte' as const;

  // ── Save handler (debounced auto-save) ──
  const updateDesign = useCallback(<K extends keyof TicketDesignConfig>(field: K, value: TicketDesignConfig[K]) => {
    setCurrentDesign(prev => {
      const next = { ...prev, [field]: value };
      startTransition(async () => {
        setStatus('saving');
        try {
          await saveStoreConfig({ [configKey]: next } as any);
          setStatus('saved');
          setTimeout(() => setStatus('idle'), 1500);
        } catch (err) {
          setStatus('error');
          setErrorMsg(parseError(err).description);
        }
      });
      return next;
    });
  }, [setCurrentDesign, configKey, saveStoreConfig]);

  const resetToDefaults = useCallback(() => {
    const defaults = isVenta
      ? { ...DEFAULT_TICKET_DESIGN }
      : { ...DEFAULT_TICKET_DESIGN, headerNote: 'CORTE DE CAJA', showItemCount: false, showDiscount: false, showUnitDetail: false };
    setCurrentDesign(defaults);
    startTransition(async () => {
      setStatus('saving');
      try {
        await saveStoreConfig({ [configKey]: defaults } as any);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 1500);
      } catch (err) {
        setStatus('error');
        setErrorMsg(parseError(err).description);
      }
    });
  }, [isVenta, setCurrentDesign, configKey, saveStoreConfig]);

  // ── Stats ──
  const enabledCount = useMemo(() => {
    let count = 0;
    const bools: (keyof TicketDesignConfig)[] = [
      'showLogo', 'showStoreName', 'showLegalName', 'showAddress', 'showPhone', 'showRfc',
      'showRegimen', 'showStoreNumber', 'showSku', 'showBarcode', 'showUnitDetail',
      'showSubtotal', 'showIva', 'showDiscount', 'showAmountPaid', 'showChange',
      'showItemCount', 'showPaymentMethod', 'showServicePhone', 'showVigencia',
      'showPoweredBy', 'showTicketBarcode',
    ];
    for (const k of bools) {
      if (currentDesign[k]) count++;
    }
    return count;
  }, [currentDesign]);

  const isBusy = isPending || status === 'saving';

  const tabs = [
    { id: 'venta', content: 'Ticket de Venta' },
    { id: 'corte', content: 'Corte de Caja' },
  ];

  return (
    <BlockStack gap="400">
      {/* ── Status banners ── */}
      {status === 'saved' && (
        <Banner tone="success" onDismiss={() => setStatus('idle')}>
          Diseño guardado correctamente
        </Banner>
      )}
      {status === 'error' && (
        <Banner tone="critical" onDismiss={() => setStatus('idle')}>
          {errorMsg}
        </Banner>
      )}

      {/* ── Tab selector + stats ── */}
      <Card padding="0">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box padding="400" paddingBlockStart="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={isVenta ? ReceiptIcon : CashDollarIcon} tone="base" />
                <Text as="p" variant="bodySm" tone="subdued">
                  {isVenta
                    ? 'Recibo que se entrega al cliente después de una venta.'
                    : 'Reporte impreso del corte de caja.'
                  }
                </Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center">
                {isBusy && <Badge tone="attention">Guardando…</Badge>}
                <Badge>{enabledCount} campos activos</Badge>
              </InlineStack>
            </InlineStack>
          </Box>
        </Tabs>
      </Card>

      {/* ── Main layout: Controls + Preview ── */}
      <InlineGrid columns={{ xs: 1, lg: ['twoThirds', 'oneThird'] }} gap="400">
        {/* ═══════════ LEFT: Controls ═══════════ */}
        <BlockStack gap="300">

          {/* ── 1. Encabezado ── */}
          <Card>
            <BlockStack gap="300">
              <SectionHeader icon={ImageIcon} title="Encabezado" badge="Logo y datos" open={openSections.header} onToggle={() => toggle('header')} />
              <Collapsible open={openSections.header} id="section-header">
                <Divider />
                <Box paddingBlockStart="300">
                  <BlockStack gap="300">
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                      <Checkbox label="Logo de tienda" checked={currentDesign.showLogo} onChange={(v) => updateDesign('showLogo', v)} />
                      <Checkbox label="Nombre comercial" checked={currentDesign.showStoreName} onChange={(v) => updateDesign('showStoreName', v)} />
                      <Checkbox label="Razón social" checked={currentDesign.showLegalName} onChange={(v) => updateDesign('showLegalName', v)} />
                      <Checkbox label="Dirección completa" checked={currentDesign.showAddress} onChange={(v) => updateDesign('showAddress', v)} />
                      <Checkbox label="Teléfono" checked={currentDesign.showPhone} onChange={(v) => updateDesign('showPhone', v)} />
                      <Checkbox label="RFC" checked={currentDesign.showRfc} onChange={(v) => updateDesign('showRfc', v)} />
                      <Checkbox label="Régimen fiscal" checked={currentDesign.showRegimen} onChange={(v) => updateDesign('showRegimen', v)} />
                      <Checkbox label="Número de sucursal" checked={currentDesign.showStoreNumber} onChange={(v) => updateDesign('showStoreNumber', v)} />
                    </InlineGrid>

                    {currentDesign.showLogo && (
                      <Box>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" as="span" tone="subdued">Tamaño del logo:</Text>
                          <ButtonGroup variant="segmented">
                            {LOGO_SIZE_OPTS.map(o => (
                              <Button key={o.value} pressed={currentDesign.logoSize === o.value} onClick={() => updateDesign('logoSize', o.value)} size="slim">{o.label}</Button>
                            ))}
                          </ButtonGroup>
                        </InlineStack>
                      </Box>
                    )}

                    <TextField
                      label="Nota de encabezado"
                      value={currentDesign.headerNote}
                      onChange={(v) => updateDesign('headerNote', v)}
                      placeholder="COMPROBANTE DE VENTA"
                      maxLength={60}
                      autoComplete="off"
                      helpText='Se imprime debajo de los datos fiscales. Ej: "COMPROBANTE DE VENTA"'
                    />
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>

          {/* ── 2. Detalle de productos (only venta) ── */}
          {isVenta && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader icon={ReceiptIcon} title="Detalle de productos" open={openSections.items} onToggle={() => toggle('items')} />
                <Collapsible open={openSections.items} id="section-items">
                  <Divider />
                  <Box paddingBlockStart="300">
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                      <Checkbox
                        label="Código SKU"
                        checked={currentDesign.showSku}
                        onChange={(v) => updateDesign('showSku', v)}
                        helpText="Código interno junto al nombre"
                      />
                      <Checkbox
                        label="Código de barras"
                        checked={currentDesign.showBarcode}
                        onChange={(v) => updateDesign('showBarcode', v)}
                        helpText="Número EAN/UPC debajo del nombre"
                      />
                      <Checkbox
                        label="Desglose de cantidad × precio"
                        checked={currentDesign.showUnitDetail}
                        onChange={(v) => updateDesign('showUnitDetail', v)}
                        helpText='Muestra "2 pza × $25.00"'
                      />
                    </InlineGrid>
                  </Box>
                </Collapsible>
              </BlockStack>
            </Card>
          )}

          {/* ── 3. Totales y pago ── */}
          <Card>
            <BlockStack gap="300">
              <SectionHeader icon={CashDollarIcon} title="Totales y pago" open={openSections.totals} onToggle={() => toggle('totals')} />
              <Collapsible open={openSections.totals} id="section-totals">
                <Divider />
                <Box paddingBlockStart="300">
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                    <Checkbox label="Subtotal" checked={currentDesign.showSubtotal} onChange={(v) => updateDesign('showSubtotal', v)} />
                    <Checkbox label="IVA desglosado" checked={currentDesign.showIva} onChange={(v) => updateDesign('showIva', v)} />
                    <Checkbox label="Descuento aplicado" checked={currentDesign.showDiscount} onChange={(v) => updateDesign('showDiscount', v)} />
                    <Checkbox label="Método de pago" checked={currentDesign.showPaymentMethod} onChange={(v) => updateDesign('showPaymentMethod', v)} />
                    <Checkbox label="Monto recibido" checked={currentDesign.showAmountPaid} onChange={(v) => updateDesign('showAmountPaid', v)} />
                    <Checkbox label="Cambio" checked={currentDesign.showChange} onChange={(v) => updateDesign('showChange', v)} />
                    <Checkbox label="Conteo de artículos" checked={currentDesign.showItemCount} onChange={(v) => updateDesign('showItemCount', v)} />
                  </InlineGrid>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>

          {/* ── 4. Pie de ticket ── */}
          <Card>
            <BlockStack gap="300">
              <SectionHeader icon={TextFontIcon} title="Pie de ticket" open={openSections.footer} onToggle={() => toggle('footer')} />
              <Collapsible open={openSections.footer} id="section-footer">
                <Divider />
                <Box paddingBlockStart="300">
                  <BlockStack gap="300">
                    <TextField
                      label="Mensaje personalizado"
                      value={currentDesign.customFooterMessage}
                      onChange={(v) => updateDesign('customFooterMessage', v)}
                      multiline={3}
                      maxLength={500}
                      autoComplete="off"
                      placeholder="¡Gracias por su compra!"
                      helpText="Si queda vacío se usa el pie general de Punto de Venta"
                    />
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                      <Checkbox label="Teléfono de soporte" checked={currentDesign.showServicePhone} onChange={(v) => updateDesign('showServicePhone', v)} />
                      <Checkbox label="Vigencia de cambios" checked={currentDesign.showVigencia} onChange={(v) => updateDesign('showVigencia', v)} />
                      <Checkbox label='Leyenda "Powered by"' checked={currentDesign.showPoweredBy} onChange={(v) => updateDesign('showPoweredBy', v)} />
                    </InlineGrid>
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>

          {/* ── 5. Código de barras ── */}
          <Card>
            <BlockStack gap="300">
              <SectionHeader icon={CodeIcon} title="Código de identificación" open={openSections.barcode} onToggle={() => toggle('barcode')} />
              <Collapsible open={openSections.barcode} id="section-barcode">
                <Divider />
                <Box paddingBlockStart="300">
                  <BlockStack gap="300">
                    <Checkbox label="Imprimir código de barras / QR en el ticket" checked={currentDesign.showTicketBarcode} onChange={(v) => updateDesign('showTicketBarcode', v)} />
                    {currentDesign.showTicketBarcode && (
                      <Box>
                        <Text variant="bodySm" as="p" tone="subdued">Formato:</Text>
                        <Box paddingBlockStart="100">
                          <ButtonGroup variant="segmented">
                            {BARCODE_OPTS.map(o => (
                              <Button key={o.value} pressed={currentDesign.barcodeFormat === o.value} onClick={() => updateDesign('barcodeFormat', o.value)} size="slim">{o.label}</Button>
                            ))}
                          </ButtonGroup>
                        </Box>
                      </Box>
                    )}
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>

          {/* ── 6. Estilo y formato ── */}
          <Card>
            <BlockStack gap="300">
              <SectionHeader icon={SettingsIcon} title="Estilo y formato" open={openSections.style} onToggle={() => toggle('style')} />
              <Collapsible open={openSections.style} id="section-style">
                <Divider />
                <Box paddingBlockStart="300">
                  <BlockStack gap="400">
                    {/* Paper width */}
                    <BlockStack gap="100">
                      <Text variant="bodySm" as="p" fontWeight="semibold">Ancho de papel</Text>
                      <ButtonGroup variant="segmented">
                        {PAPER_OPTS.map(o => (
                          <Tooltip key={o.value} content={o.help}>
                            <Button pressed={currentDesign.paperWidth === o.value} onClick={() => updateDesign('paperWidth', o.value)} size="slim">{o.label}</Button>
                          </Tooltip>
                        ))}
                      </ButtonGroup>
                    </BlockStack>

                    {/* Font size */}
                    <BlockStack gap="100">
                      <Text variant="bodySm" as="p" fontWeight="semibold">Tamaño de fuente</Text>
                      <ButtonGroup variant="segmented">
                        {FONT_OPTS.map(o => (
                          <Button key={o.value} pressed={currentDesign.fontSize === o.value} onClick={() => updateDesign('fontSize', o.value)} size="slim">{o.label}</Button>
                        ))}
                      </ButtonGroup>
                    </BlockStack>

                    {/* Separator */}
                    <BlockStack gap="100">
                      <Text variant="bodySm" as="p" fontWeight="semibold">Estilo de separador</Text>
                      <ButtonGroup variant="segmented">
                        {SEP_OPTS.map(o => (
                          <Button key={o.value} pressed={currentDesign.separatorStyle === o.value} onClick={() => updateDesign('separatorStyle', o.value)} size="slim">{o.label}</Button>
                        ))}
                      </ButtonGroup>
                    </BlockStack>

                    {/* Copies */}
                    <RangeSlider
                      label={`Copias por impresión: ${currentDesign.copies}`}
                      value={currentDesign.copies}
                      min={1}
                      max={5}
                      onChange={(v) => updateDesign('copies', v as number)}
                      output
                      helpText="Número de copias que se envían a la impresora automáticamente"
                    />
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>

          {/* ── 7. Acciones avanzadas ── */}
          <Card>
            <BlockStack gap="300">
              <SectionHeader icon={PrintIcon} title="Acciones avanzadas" open={openSections.advanced} onToggle={() => toggle('advanced')} />
              <Collapsible open={openSections.advanced} id="section-advanced">
                <Divider />
                <Box paddingBlockStart="300">
                  <BlockStack gap="300">
                    <Banner tone="info">
                      <Text as="p" variant="bodySm">
                        El diseño configurado aquí se aplica automáticamente en todos los puntos de impresión:
                        cobro en mostrador, reimpresión desde historial de ventas, y corte de caja.
                        Si además defines una plantilla HTML personalizada (sección superior), ésta tiene prioridad.
                      </Text>
                    </Banner>
                    <InlineStack gap="200">
                      <Tooltip content="Restaura todas las opciones de este ticket a su valor predeterminado">
                        <Button icon={ResetIcon} onClick={resetToDefaults} tone="critical" variant="plain">
                          Restablecer diseño por defecto
                        </Button>
                      </Tooltip>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>
        </BlockStack>

        {/* ═══════════ RIGHT: Live Preview ═══════════ */}
        <Box>
          <div style={{ position: 'sticky', top: 80 }}>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={ViewIcon} tone="base" />
                    <Text variant="headingSm" as="h3">Vista previa</Text>
                  </InlineStack>
                  <Badge tone={isVenta ? 'success' : 'warning'}>
                    {isVenta ? 'Venta' : 'Corte'}
                  </Badge>
                </InlineStack>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued">
                  Simulación con datos de ejemplo. La impresión real usa los datos de la venta.
                </Text>
                <TicketPreview design={currentDesign} config={storeConfig} type={ticketType} />
              </BlockStack>
            </Card>
          </div>
        </Box>
      </InlineGrid>
    </BlockStack>
  );
}
