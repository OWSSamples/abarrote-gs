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
  ProgressBar,
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
  DeliveryIcon,
  CartIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { parseError } from '@/lib/errors';
import { TicketPreview } from './TicketPreview';
import type {
  TicketDesignConfig,
  TicketPaperWidth,
  TicketFontSize,
  TicketSeparatorStyle,
  TicketHeaderAlignment,
} from '@/types';
import { DEFAULT_TICKET_DESIGN, DEFAULT_TICKET_DESIGN_PROVEEDOR } from '@/types';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type TicketTab = 'venta' | 'corte' | 'proveedor';
type SectionKey = 'header' | 'items' | 'supplier' | 'totals' | 'footer' | 'barcode' | 'style' | 'advanced';

const CONFIG_KEY_MAP: Record<TicketTab, 'ticketDesignVenta' | 'ticketDesignCorte' | 'ticketDesignProveedor'> = {
  venta: 'ticketDesignVenta',
  corte: 'ticketDesignCorte',
  proveedor: 'ticketDesignProveedor',
};

const TAB_DEFAULTS: Record<TicketTab, TicketDesignConfig> = {
  venta: { ...DEFAULT_TICKET_DESIGN },
  corte: { ...DEFAULT_TICKET_DESIGN, headerNote: 'CORTE DE CAJA', showItemCount: false, showDiscount: false, showUnitDetail: false },
  proveedor: { ...DEFAULT_TICKET_DESIGN_PROVEEDOR },
};

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

const ALIGN_OPTS: { label: string; value: TicketHeaderAlignment }[] = [
  { label: 'Izquierda', value: 'left' },
  { label: 'Centro', value: 'center' },
];

// ═══════════════════════════════════════════════════════════
// Boolean field counter utility
// ═══════════════════════════════════════════════════════════

const ALL_BOOL_FIELDS: (keyof TicketDesignConfig)[] = [
  'showLogo', 'showStoreName', 'showLegalName', 'showAddress', 'showPhone', 'showRfc',
  'showRegimen', 'showStoreNumber', 'showSku', 'showBarcode', 'showUnitDetail',
  'showSubtotal', 'showIva', 'showDiscount', 'showAmountPaid', 'showChange',
  'showItemCount', 'showPaymentMethod', 'showDateTime', 'showCashierInfo', 'showCurrency',
  'showServicePhone', 'showVigencia', 'showPoweredBy', 'showTicketBarcode',
  'showSupplierInfo', 'showOrderFolio', 'showDeliveryDate', 'showPaymentTerms',
  'showOrderNotes', 'showCostPrice', 'showTotalPieces', 'showDestination',
];

function countEnabled(design: TicketDesignConfig): number {
  return ALL_BOOL_FIELDS.reduce((acc, k) => acc + (design[k] ? 1 : 0), 0);
}

/** Sections relevant to each tab - used for conditional rendering */
const TAB_SECTIONS: Record<TicketTab, SectionKey[]> = {
  venta: ['header', 'items', 'totals', 'footer', 'barcode', 'style', 'advanced'],
  corte: ['header', 'totals', 'footer', 'barcode', 'style', 'advanced'],
  proveedor: ['header', 'supplier', 'items', 'totals', 'footer', 'barcode', 'style', 'advanced'],
};

// ═══════════════════════════════════════════════════════════
// Collapsible section header
// ═══════════════════════════════════════════════════════════

function SectionHeader({
  icon,
  title,
  badge,
  open,
  onToggle,
  description,
}: {
  icon: typeof ReceiptIcon;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  description?: string;
}) {
  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <BlockStack gap="100">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300" blockAlign="center">
            <Box
              background="bg-surface-secondary"
              borderRadius="200"
              padding="150"
            >
              <Icon source={icon} tone="base" />
            </Box>
            <Text variant="headingSm" as="h3">{title}</Text>
            {badge && <Badge tone="info">{badge}</Badge>}
          </InlineStack>
          <Icon source={open ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
        </InlineStack>
        {description && !open && (
          <Box paddingInlineStart="1000">
            <Text as="p" variant="bodySm" tone="subdued">{description}</Text>
          </Box>
        )}
      </BlockStack>
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
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    header: true, items: true, supplier: true, totals: true,
    footer: false, barcode: false, style: false, advanced: false,
  });
  const toggle = (key: SectionKey) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Design state per ticket type
  const [designVenta, setDesignVenta] = useState<TicketDesignConfig>(
    () => storeConfig.ticketDesignVenta ?? { ...DEFAULT_TICKET_DESIGN },
  );
  const [designCorte, setDesignCorte] = useState<TicketDesignConfig>(
    () => storeConfig.ticketDesignCorte ?? { ...DEFAULT_TICKET_DESIGN, headerNote: 'CORTE DE CAJA' },
  );
  const [designProveedor, setDesignProveedor] = useState<TicketDesignConfig>(
    () => storeConfig.ticketDesignProveedor ?? { ...DEFAULT_TICKET_DESIGN_PROVEEDOR },
  );

  // Sync from store on hydration
  useEffect(() => {
    if (storeConfig.ticketDesignVenta) setDesignVenta(storeConfig.ticketDesignVenta);
    if (storeConfig.ticketDesignCorte) setDesignCorte(storeConfig.ticketDesignCorte);
    if (storeConfig.ticketDesignProveedor) setDesignProveedor(storeConfig.ticketDesignProveedor);
  }, [storeConfig.ticketDesignVenta, storeConfig.ticketDesignCorte, storeConfig.ticketDesignProveedor]);

  // Map tab index to ticket type
  const TAB_ORDER: TicketTab[] = useMemo(() => ['venta', 'corte', 'proveedor'], []);
  const activeTab = TAB_ORDER[selectedTab] ?? 'venta';

  const designMap: Record<TicketTab, TicketDesignConfig> = useMemo(() => ({
    venta: designVenta, corte: designCorte, proveedor: designProveedor,
  }), [designVenta, designCorte, designProveedor]);

  const setDesignMap: Record<TicketTab, React.Dispatch<React.SetStateAction<TicketDesignConfig>>> = useMemo(() => ({
    venta: setDesignVenta, corte: setDesignCorte, proveedor: setDesignProveedor,
  }), []);

  const currentDesign = designMap[activeTab];
  const setCurrentDesign = setDesignMap[activeTab];
  const configKey = CONFIG_KEY_MAP[activeTab];
  const ticketType = activeTab;
  const visibleSections = TAB_SECTIONS[activeTab];

  // ── Save handler (auto-save on change) ──
  const updateDesign = useCallback(<K extends keyof TicketDesignConfig>(field: K, value: TicketDesignConfig[K]) => {
    const next = { ...currentDesign, [field]: value };
    setCurrentDesign(next);
    startTransition(async () => {
      setStatus('saving');
      try {
        await saveStoreConfig({ [configKey]: next } as Partial<Record<string, TicketDesignConfig>>);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 1500);
      } catch (err) {
        setStatus('error');
        setErrorMsg(parseError(err).description);
      }
    });
  }, [currentDesign, setCurrentDesign, configKey, saveStoreConfig]);

  const resetToDefaults = useCallback(() => {
    const defaults = TAB_DEFAULTS[activeTab];
    setCurrentDesign({ ...defaults });
    startTransition(async () => {
      setStatus('saving');
      try {
        await saveStoreConfig({ [configKey]: { ...defaults } } as Partial<Record<string, TicketDesignConfig>>);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 1500);
      } catch (err) {
        setStatus('error');
        setErrorMsg(parseError(err).description);
      }
    });
  }, [activeTab, setCurrentDesign, configKey, saveStoreConfig]);

  // ── Stats ──
  const enabledCount = useMemo(() => countEnabled(currentDesign), [currentDesign]);
  const maxFields = ALL_BOOL_FIELDS.length;
  const completionPct = Math.round((enabledCount / maxFields) * 100);

  const isBusy = isPending || status === 'saving';

  const tabs = [
    { id: 'venta', content: '🧾 Ticket de Venta' },
    { id: 'corte', content: '💰 Corte de Caja' },
    { id: 'proveedor', content: '📦 Orden de Proveedor' },
  ];

  const tabDescriptions: Record<TicketTab, string> = {
    venta: 'Recibo que se entrega al cliente después de una venta o reimpresión.',
    corte: 'Reporte impreso del corte de caja con desglose de operaciones del turno.',
    proveedor: 'Orden de compra / surtido que se envía al proveedor para abastecimiento.',
  };

  const tabIcons: Record<TicketTab, typeof ReceiptIcon> = {
    venta: ReceiptIcon,
    corte: CashDollarIcon,
    proveedor: DeliveryIcon,
  };

  const showSection = (key: SectionKey) => visibleSections.includes(key);

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
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={tabIcons[activeTab]} tone="base" />
                  <Text as="p" variant="bodySm" tone="subdued">
                    {tabDescriptions[activeTab]}
                  </Text>
                </InlineStack>
                <InlineStack gap="200" blockAlign="center">
                  {isBusy && <Badge tone="attention">Guardando…</Badge>}
                  <Badge>{enabledCount} campos activos</Badge>
                </InlineStack>
              </InlineStack>
              <Tooltip content={`${enabledCount} de ${maxFields} campos habilitados (${completionPct}%)`}>
                <ProgressBar progress={completionPct} tone="primary" size="small" />
              </Tooltip>
            </BlockStack>
          </Box>
        </Tabs>
      </Card>

      {/* ── Main layout: Controls + Preview ── */}
      <InlineGrid columns={{ xs: 1, lg: ['oneHalf', 'oneHalf'] }} gap="400">
        {/* ═══════════ LEFT: Controls ═══════════ */}
        <BlockStack gap="300">

          {/* ── 1. Encabezado ── */}
          {showSection('header') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={ImageIcon}
                  title="Encabezado"
                  badge="Logo y datos fiscales"
                  open={openSections.header}
                  onToggle={() => toggle('header')}
                  description="Logo, nombre, dirección, RFC y datos de la tienda"
                />
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
                        <Checkbox label="Fecha y hora" checked={currentDesign.showDateTime} onChange={(v) => updateDesign('showDateTime', v)} />
                        <Checkbox label="Datos del cajero/operador" checked={currentDesign.showCashierInfo} onChange={(v) => updateDesign('showCashierInfo', v)} />
                      </InlineGrid>

                      {/* Logo size */}
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

                      {/* Header alignment */}
                      <Box>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodySm" as="span" tone="subdued">Alineación del encabezado:</Text>
                          <ButtonGroup variant="segmented">
                            {ALIGN_OPTS.map(o => (
                              <Button key={o.value} pressed={currentDesign.headerAlignment === o.value} onClick={() => updateDesign('headerAlignment', o.value)} size="slim">{o.label}</Button>
                            ))}
                          </ButtonGroup>
                        </InlineStack>
                      </Box>

                      <TextField
                        label="Nota de encabezado"
                        value={currentDesign.headerNote}
                        onChange={(v) => updateDesign('headerNote', v)}
                        placeholder={activeTab === 'proveedor' ? 'ORDEN DE COMPRA' : activeTab === 'corte' ? 'CORTE DE CAJA' : 'COMPROBANTE DE VENTA'}
                        maxLength={60}
                        autoComplete="off"
                        helpText='Se imprime debajo de los datos fiscales.'
                      />
                    </BlockStack>
                  </Box>
                </Collapsible>
              </BlockStack>
            </Card>
          )}

          {/* ── 2. Información del proveedor (only proveedor) ── */}
          {showSection('supplier') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={DeliveryIcon}
                  title="Información del proveedor"
                  badge="Datos del pedido"
                  open={openSections.supplier}
                  onToggle={() => toggle('supplier')}
                  description="Proveedor, folio, fecha de entrega y condiciones de pago"
                />
                <Collapsible open={openSections.supplier} id="section-supplier">
                  <Divider />
                  <Box paddingBlockStart="300">
                    <BlockStack gap="300">
                      <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                        <Checkbox
                          label="Nombre del proveedor"
                          checked={currentDesign.showSupplierInfo}
                          onChange={(v) => updateDesign('showSupplierInfo', v)}
                          helpText="Razón social o nombre comercial del proveedor"
                        />
                        <Checkbox
                          label="Folio de la orden"
                          checked={currentDesign.showOrderFolio}
                          onChange={(v) => updateDesign('showOrderFolio', v)}
                          helpText="Identificador único del pedido"
                        />
                        <Checkbox
                          label="Fecha de entrega estimada"
                          checked={currentDesign.showDeliveryDate}
                          onChange={(v) => updateDesign('showDeliveryDate', v)}
                          helpText="Fecha esperada de recepción del producto"
                        />
                        <Checkbox
                          label="Condiciones de pago"
                          checked={currentDesign.showPaymentTerms}
                          onChange={(v) => updateDesign('showPaymentTerms', v)}
                          helpText='Ej: "Contado", "Crédito 30 días"'
                        />
                        <Checkbox
                          label="Destino / sucursal de entrega"
                          checked={currentDesign.showDestination}
                          onChange={(v) => updateDesign('showDestination', v)}
                          helpText="Dirección de la tienda que recibe"
                        />
                        <Checkbox
                          label="Notas del pedido"
                          checked={currentDesign.showOrderNotes}
                          onChange={(v) => updateDesign('showOrderNotes', v)}
                          helpText="Instrucciones especiales o comentarios"
                        />
                      </InlineGrid>
                    </BlockStack>
                  </Box>
                </Collapsible>
              </BlockStack>
            </Card>
          )}

          {/* ── 3. Detalle de productos (venta + proveedor) ── */}
          {showSection('items') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={activeTab === 'proveedor' ? CartIcon : ReceiptIcon}
                  title={activeTab === 'proveedor' ? 'Detalle de productos a surtir' : 'Detalle de productos'}
                  open={openSections.items}
                  onToggle={() => toggle('items')}
                  description={activeTab === 'proveedor'
                    ? 'Productos solicitados al proveedor con cantidades y costos'
                    : 'Cómo se muestra cada producto vendido en el ticket'
                  }
                />
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
                        helpText={activeTab === 'proveedor' ? 'Muestra "10 pza × $18.50 (costo)"' : 'Muestra "2 pza × $25.00"'}
                      />
                      {activeTab === 'proveedor' && (
                        <>
                          <Checkbox
                            label="Precio de costo"
                            checked={currentDesign.showCostPrice}
                            onChange={(v) => updateDesign('showCostPrice', v)}
                            helpText="Muestra precio de costo unitario en lugar del precio de venta"
                          />
                          <Checkbox
                            label="Total de piezas"
                            checked={currentDesign.showTotalPieces}
                            onChange={(v) => updateDesign('showTotalPieces', v)}
                            helpText="Suma total de unidades al final del listado"
                          />
                        </>
                      )}
                    </InlineGrid>
                  </Box>
                </Collapsible>
              </BlockStack>
            </Card>
          )}

          {/* ── 4. Totales y pago ── */}
          {showSection('totals') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={CashDollarIcon}
                  title={activeTab === 'proveedor' ? 'Totales del pedido' : 'Totales y pago'}
                  open={openSections.totals}
                  onToggle={() => toggle('totals')}
                  description={activeTab === 'proveedor'
                    ? 'Subtotal, IVA y total estimado del pedido de compra'
                    : 'Subtotal, IVA, descuentos, método de pago y cambio'
                  }
                />
                <Collapsible open={openSections.totals} id="section-totals">
                  <Divider />
                  <Box paddingBlockStart="300">
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                      <Checkbox label="Subtotal" checked={currentDesign.showSubtotal} onChange={(v) => updateDesign('showSubtotal', v)} />
                      <Checkbox label="IVA desglosado" checked={currentDesign.showIva} onChange={(v) => updateDesign('showIva', v)} />
                      <Checkbox label="Moneda del ticket" checked={currentDesign.showCurrency} onChange={(v) => updateDesign('showCurrency', v)} helpText='Ej: "MXN", "USD"' />
                      {activeTab !== 'proveedor' && (
                        <>
                          <Checkbox label="Descuento aplicado" checked={currentDesign.showDiscount} onChange={(v) => updateDesign('showDiscount', v)} />
                          <Checkbox label="Método de pago" checked={currentDesign.showPaymentMethod} onChange={(v) => updateDesign('showPaymentMethod', v)} />
                          <Checkbox label="Monto recibido" checked={currentDesign.showAmountPaid} onChange={(v) => updateDesign('showAmountPaid', v)} />
                          <Checkbox label="Cambio" checked={currentDesign.showChange} onChange={(v) => updateDesign('showChange', v)} />
                          <Checkbox label="Conteo de artículos" checked={currentDesign.showItemCount} onChange={(v) => updateDesign('showItemCount', v)} />
                        </>
                      )}
                      {activeTab === 'proveedor' && (
                        <Checkbox label="Conteo total de piezas" checked={currentDesign.showTotalPieces} onChange={(v) => updateDesign('showTotalPieces', v)} />
                      )}
                    </InlineGrid>
                  </Box>
                </Collapsible>
              </BlockStack>
            </Card>
          )}

          {/* ── 5. Pie de ticket ── */}
          {showSection('footer') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={TextFontIcon}
                  title="Pie de ticket"
                  open={openSections.footer}
                  onToggle={() => toggle('footer')}
                  description="Mensajes de agradecimiento, políticas y datos de contacto"
                />
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
                        placeholder={activeTab === 'proveedor'
                          ? 'Favor de confirmar recepción de este pedido.'
                          : '¡Gracias por su compra!'
                        }
                        helpText="Si queda vacío se usa el pie general de Punto de Venta"
                      />
                      <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                        <Checkbox label="Teléfono de soporte" checked={currentDesign.showServicePhone} onChange={(v) => updateDesign('showServicePhone', v)} />
                        {activeTab !== 'proveedor' && (
                          <Checkbox label="Vigencia de cambios" checked={currentDesign.showVigencia} onChange={(v) => updateDesign('showVigencia', v)} />
                        )}
                        <Checkbox label='Leyenda "Powered by"' checked={currentDesign.showPoweredBy} onChange={(v) => updateDesign('showPoweredBy', v)} />
                      </InlineGrid>
                    </BlockStack>
                  </Box>
                </Collapsible>
              </BlockStack>
            </Card>
          )}

          {/* ── 6. Código de barras ── */}
          {showSection('barcode') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={CodeIcon}
                  title="Código de identificación"
                  open={openSections.barcode}
                  onToggle={() => toggle('barcode')}
                  description="Código de barras o QR para identificar el ticket"
                />
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
          )}

          {/* ── 7. Estilo y formato ── */}
          {showSection('style') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={SettingsIcon}
                  title="Estilo y formato"
                  open={openSections.style}
                  onToggle={() => toggle('style')}
                  description="Tamaño de papel, fuente, separadores y copias"
                />
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
          )}

          {/* ── 8. Acciones avanzadas ── */}
          {showSection('advanced') && (
            <Card>
              <BlockStack gap="300">
                <SectionHeader
                  icon={PrintIcon}
                  title="Acciones avanzadas"
                  open={openSections.advanced}
                  onToggle={() => toggle('advanced')}
                />
                <Collapsible open={openSections.advanced} id="section-advanced">
                  <Divider />
                  <Box paddingBlockStart="300">
                    <BlockStack gap="300">
                      <Banner tone="info">
                        <Text as="p" variant="bodySm">
                          {activeTab === 'venta'
                            ? 'Este diseño se aplica en cobro en mostrador, reimpresión desde historial de ventas. Si defines una plantilla HTML personalizada (sección superior), ésta tiene prioridad.'
                            : activeTab === 'corte'
                              ? 'Este diseño se aplica al generar el reporte de corte de caja manual o automático.'
                              : 'Este diseño se aplica al imprimir órdenes de compra desde la sección de proveedores. Si defines una plantilla HTML personalizada, ésta tiene prioridad.'
                          }
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
          )}
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
                  <Badge tone={activeTab === 'venta' ? 'success' : activeTab === 'corte' ? 'warning' : 'info'}>
                    {activeTab === 'venta' ? 'Venta' : activeTab === 'corte' ? 'Corte' : 'Proveedor'}
                  </Badge>
                </InlineStack>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued">
                  Simulación con datos de ejemplo. La impresión real usa los datos de la {activeTab === 'proveedor' ? 'orden de compra' : 'operación'}.
                </Text>
                <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
                  <TicketPreview design={currentDesign} config={storeConfig} type={ticketType} />
                </div>
              </BlockStack>
            </Card>
          </div>
        </Box>
      </InlineGrid>
    </BlockStack>
  );
}
