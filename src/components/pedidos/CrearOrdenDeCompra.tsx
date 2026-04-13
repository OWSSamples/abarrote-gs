'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Modal,
  Divider,
  TextField,
  Select,
  Icon,
  Popover,
  ActionList,
  DatePicker,
} from '@shopify/polaris';
import { ArrowLeftIcon, DeleteIcon, SearchIcon, CalendarIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import type { Product } from '@/types';
import { printTicketSurtido, type OrderLineItem } from './printTicketSurtido';
import { CrearDistribuidorModal } from './CrearDistribuidorModal';
import { DistribuidorSelector } from './DistribuidorSelector';

/* ─── Crear Orden de Compra form ─── */
export function CrearOrdenDeCompra({ onBack }: { onBack: () => void }) {
  const proveedores = useDashboardStore((s) => s.proveedores);
  const products = useDashboardStore((s) => s.products);
  const createPedido = useDashboardStore((s) => s.createPedido);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const { showSuccess, showError } = useToast();

  // Modal crear distribuidor
  const [crearDistribuidorOpen, setCrearDistribuidorOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [terminosPago, setTerminosPago] = useState('');
  const [datosEnvio, setDatosEnvio] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [{ month, year }, setMonthYear] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [transportista, setTransportista] = useState('');
  const [numSeguimiento, setNumSeguimiento] = useState('');
  const [moneda, setMoneda] = useState('MXN');
  const [notas, setNotas] = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([]);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [explorarOpen, setExplorarOpen] = useState(false);
  const [explorarSearch, setExplorarSearch] = useState('');

  const selectedProveedor = useMemo(
    () => proveedores.find((p) => p.id === proveedorId) ?? null,
    [proveedores, proveedorId],
  );

  const monedaOptions = [
    { label: 'MXN - Peso Mexicano', value: 'MXN' },
    { label: 'USD - Dolar Americano', value: 'USD' },
    { label: 'EUR - Euro', value: 'EUR' },
  ];

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    const addedIds = new Set(lineItems.map((l) => l.productId));
    return products
      .filter(
        (p: Product) =>
          !addedIds.has(p.id) &&
          (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [productSearch, products, lineItems]);

  const explorarFiltered = useMemo(() => {
    const addedIds = new Set(lineItems.map((l) => l.productId));
    if (!explorarSearch.trim()) return products.filter((p: Product) => !addedIds.has(p.id));
    const q = explorarSearch.toLowerCase();
    return products.filter(
      (p: Product) =>
        !addedIds.has(p.id) &&
        (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)),
    );
  }, [explorarSearch, products, lineItems]);

  const addProduct = useCallback((product: Product) => {
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        precio: product.costPrice,
        cantidad: 1,
      },
    ]);
    setProductSearch('');
    setShowProductDropdown(false);
  }, []);

  const updateLineItem = useCallback((idx: number, field: 'precio' | 'cantidad', value: number) => {
    setLineItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }, []);

  const removeLineItem = useCallback((idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0), [lineItems]);

  const canSave = Boolean(selectedProveedor) && lineItems.length > 0 && lineItems.every((l) => l.cantidad > 0);

  const handleSave = useCallback(async () => {
    if (!canSave || !selectedProveedor) return;
    setSaving(true);
    try {
      const destino = storeConfig.storeName;
      const newPedido = await createPedido({
        proveedor: selectedProveedor.nombre,
        notas: [
          terminosPago ? `Terminos: ${terminosPago}` : '',
          datosEnvio ? `Llegada estimada: ${datosEnvio}` : '',
          transportista ? `Transportista: ${transportista}` : '',
          numSeguimiento ? `Seguimiento: ${numSeguimiento}` : '',
          moneda !== 'MXN' ? `Moneda: ${moneda}` : '',
          notas,
        ]
          .filter(Boolean)
          .join(' | '),
        productos: lineItems.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          cantidad: l.cantidad,
        })),
      });
      showSuccess('Orden de compra creada exitosamente');
      printTicketSurtido({
        folio: newPedido.id,
        fecha: newPedido.fecha,
        proveedor: selectedProveedor.nombre,
        terminosPago,
        moneda,
        destino,
        destinoAddress: [storeConfig.address, storeConfig.city].filter(Boolean).join(', '),
        notas,
        lineItems,
        subtotal,
        storeName: storeConfig.storeName,
        storeAddress: [storeConfig.address, storeConfig.city, storeConfig.postalCode].filter(Boolean).join(', '),
        storePhone: storeConfig.phone,
        templateProveedor: storeConfig.ticketTemplateProveedor,
      });
      onBack();
    } catch {
      showError('Error al crear la orden de compra');
    }
    setSaving(false);
  }, [
    canSave,
    createPedido,
    selectedProveedor,
    terminosPago,
    datosEnvio,
    transportista,
    numSeguimiento,
    moneda,
    notas,
    lineItems,
    subtotal,
    storeConfig,
    showSuccess,
    showError,
    onBack,
  ]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <BlockStack gap="400">
        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <InlineStack gap="300" blockAlign="center">
            <Button icon={ArrowLeftIcon} variant="plain" onClick={onBack} />
            <Text as="h1" variant="headingLg">
              Crear orden de compra
            </Text>
          </InlineStack>
          <InlineStack gap="200">
            <Button onClick={onBack}>Descartar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving} disabled={!canSave}>
              Guardar como borrador
            </Button>
          </InlineStack>
        </div>

        {/* ── Card 1: Distribuidor + Destino + Condiciones + Moneda ── */}
        <Card>
          {/* Row 1: Distribuidor | Destino */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
            {/* Distribuidor */}
            <div style={{ padding: '16px 20px 20px' }}>
              <Text as="p" variant="bodySm" tone="subdued">
                Distribuidor
              </Text>
              <div style={{ marginTop: '8px' }}>
                <DistribuidorSelector
                  proveedores={proveedores}
                  selectedId={proveedorId}
                  onSelect={setProveedorId}
                  onCrearNuevo={() => setCrearDistribuidorOpen(true)}
                />
              </div>
            </div>

            {/* Divisor vertical */}
            <div style={{ borderLeft: '1px solid #e1e3e5', padding: '16px 20px 20px' }}>
              <Text as="p" variant="bodySm" tone="subdued">
                Destino
              </Text>
              {/* Botón estilo Shopify: nombre grande + dirección + chevron */}
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'default',
                  padding: '6px 0 0',
                  gap: '8px',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 600, color: '#303030', lineHeight: '1.2' }}>
                      {storeConfig.storeName || 'Mi tienda'}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      style={{ color: '#303030', flexShrink: 0, marginTop: '2px' }}
                    >
                      <path
                        d="M5 7.5L10 12.5L15 7.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {(storeConfig.address || storeConfig.city) && (
                    <div style={{ fontSize: '13px', color: '#6d7175', marginTop: '2px' }}>
                      {[storeConfig.address, storeConfig.city].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Divisor horizontal */}
          <div style={{ borderTop: '1px solid #e1e3e5' }} />

          {/* Row 2: Condiciones de pago | Moneda del distribuidor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
            <div style={{ padding: '16px 20px 20px' }}>
              <Select
                label="Condiciones de pago (opcional)"
                options={[
                  { label: 'Ninguna', value: '' },
                  { label: 'Pago inmediato', value: 'inmediato' },
                  { label: 'Neto 15 días', value: 'net15' },
                  { label: 'Neto 30 días', value: 'net30' },
                  { label: 'Neto 60 días', value: 'net60' },
                  { label: 'Contra entrega', value: 'contra_entrega' },
                ]}
                value={terminosPago}
                onChange={setTerminosPago}
              />
            </div>
            <div style={{ borderLeft: '1px solid #e1e3e5', padding: '16px 20px 20px' }}>
              <Select label="Moneda del distribuidor" options={monedaOptions} value={moneda} onChange={setMoneda} />
            </div>
          </div>
        </Card>

        {/* ── Card 2: Información del envío ── */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Información del envío
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <Popover
                active={datePickerOpen}
                activator={
                  <TextField
                    label="Llegada estimada"
                    value={datosEnvio ? new Date(datosEnvio + 'T12:00:00').toLocaleDateString('es-MX') : ''}
                    onFocus={() => setDatePickerOpen(true)}
                    onChange={() => {}}
                    placeholder="Seleccionar fecha"
                    autoComplete="off"
                    prefix={<Icon source={CalendarIcon} />}
                    readOnly
                  />
                }
                onClose={() => setDatePickerOpen(false)}
                preferredAlignment="left"
              >
                <div style={{ padding: '8px', width: '260px' }}>
                  <DatePicker
                    month={month}
                    year={year}
                    selected={
                      datosEnvio
                        ? { start: new Date(datosEnvio + 'T12:00:00'), end: new Date(datosEnvio + 'T12:00:00') }
                        : undefined
                    }
                    onMonthChange={(m, y) => setMonthYear({ month: m, year: y })}
                    onChange={({ start }) => {
                      const d = start as Date;
                      setDatosEnvio(d.toISOString().split('T')[0]);
                      setDatePickerOpen(false);
                    }}
                  />
                </div>
              </Popover>
              <TextField
                label="Empresa de transporte"
                value={transportista}
                onChange={setTransportista}
                autoComplete="off"
              />
              <TextField
                label="Número de seguimiento"
                value={numSeguimiento}
                onChange={setNumSeguimiento}
                autoComplete="off"
              />
            </div>
          </BlockStack>
        </Card>

        {/* ── Card 3: Agregar productos ── */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Agregar productos
            </Text>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Popover
                  active={showProductDropdown && filteredProducts.length > 0}
                  activator={
                    <TextField
                      label=""
                      labelHidden
                      value={productSearch}
                      onChange={(v) => {
                        setProductSearch(v);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="Buscar productos"
                      prefix={<Icon source={SearchIcon} />}
                      autoComplete="off"
                    />
                  }
                  onClose={() => setShowProductDropdown(false)}
                  fullWidth
                  preferredAlignment="left"
                >
                  <ActionList
                    items={filteredProducts.map((p: Product) => ({
                      content: p.name,
                      helpText: `SKU: ${p.sku}  ·  $${p.costPrice.toFixed(2)}`,
                      onAction: () => addProduct(p),
                    }))}
                  />
                </Popover>
              </div>
              <Button
                onClick={() => {
                  setExplorarSearch('');
                  setExplorarOpen(true);
                }}
              >
                Explorar
              </Button>
            </div>

            {/* Line items table */}
            {lineItems.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e1e3e5' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6d7175', fontWeight: 500 }}>
                        Producto
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6d7175', fontWeight: 500 }}>SKU</th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '8px 12px',
                          color: '#6d7175',
                          fontWeight: 500,
                          width: '120px',
                        }}
                      >
                        Precio
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '8px 12px',
                          color: '#6d7175',
                          fontWeight: 500,
                          width: '100px',
                        }}
                      >
                        Cantidad
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '8px 12px',
                          color: '#6d7175',
                          fontWeight: 500,
                          width: '110px',
                        }}
                      >
                        Total
                      </th>
                      <th style={{ width: '44px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={item.productId} style={{ borderBottom: '1px solid #f1f1f1' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#303030' }}>{item.productName}</td>
                        <td style={{ padding: '10px 12px', color: '#6d7175' }}>{item.sku}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                          <input
                            type="number"
                            value={item.precio}
                            onChange={(e) =>
                              updateLineItem(idx, 'precio', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            style={{
                              width: '100px',
                              padding: '6px 8px',
                              border: '1px solid #d2d5d8',
                              borderRadius: '8px',
                              textAlign: 'right',
                              fontSize: '13px',
                              outline: 'none',
                            }}
                            min={0}
                            step={0.01}
                          />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) =>
                              updateLineItem(idx, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            style={{
                              width: '80px',
                              padding: '6px 8px',
                              border: '1px solid #d2d5d8',
                              borderRadius: '8px',
                              textAlign: 'right',
                              fontSize: '13px',
                              outline: 'none',
                            }}
                            min={1}
                            step={1}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#303030' }}>
                          ${(item.precio * item.cantidad).toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <Button
                            icon={DeleteIcon}
                            variant="plain"
                            tone="critical"
                            onClick={() => removeLineItem(idx)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '16px 12px',
                    borderTop: '2px solid #e1e3e5',
                    gap: '32px',
                  }}
                >
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Subtotal
                  </Text>
                  <Text as="span" variant="bodyMd" fontWeight="bold">
                    ${subtotal.toFixed(2)} {moneda}
                  </Text>
                </div>
              </div>
            )}
          </BlockStack>
        </Card>

        {/* ── Bottom 2-col: Información adicional | Resumen de costos ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' }}>
          {/* Información adicional */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingSm">
                Información adicional
              </Text>
              <TextField
                label="Nota para el distribuidor"
                value={notas}
                onChange={setNotas}
                placeholder=""
                autoComplete="off"
                multiline={4}
                maxLength={5000}
                showCharacterCount
              />
              <TextField label="Etiquetas" value={etiquetas} onChange={setEtiquetas} autoComplete="off" />
            </BlockStack>
          </Card>

          {/* Resumen de costos */}
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingSm">
                  Resumen de costos
                </Text>
              </InlineStack>
              <Divider />
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm" tone="subdued">
                  Impuestos <span style={{ fontSize: '11px' }}>(Incluidos)</span>
                </Text>
                <Text as="span" variant="bodySm">
                  ${(subtotal * 0).toFixed(2)} $
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  Subtotal
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  ${subtotal.toFixed(2)} $
                </Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                {lineItems.reduce((s, l) => s + l.cantidad, 0)} artículo
                {lineItems.reduce((s, l) => s + l.cantidad, 0) !== 1 ? 's' : ''}
              </Text>
              <Divider />
              <Text as="h3" variant="bodySm" tone="subdued">
                Ajustes de costos
              </Text>
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm">
                  Envío
                </Text>
                <Text as="span" variant="bodySm">
                  0,00 $
                </Text>
              </InlineStack>
              <Divider />
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd" fontWeight="bold">
                  Total
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="bold">
                  ${subtotal.toFixed(2)} $
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>
      </BlockStack>

      {/* Modal Crear Distribuidor */}
      <CrearDistribuidorModal
        open={crearDistribuidorOpen}
        onClose={() => setCrearDistribuidorOpen(false)}
        onSaved={(prov) => {
          setProveedorId(prov.id);
        }}
      />

      {/* Modal Explorar Productos */}
      <Modal open={explorarOpen} onClose={() => setExplorarOpen(false)} title="Agregar productos" size="large">
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label=""
              labelHidden
              value={explorarSearch}
              onChange={setExplorarSearch}
              placeholder="Buscar por nombre, SKU o código de barras"
              prefix={<Icon source={SearchIcon} />}
              autoComplete="off"
              autoFocus
            />
          </BlockStack>
        </Modal.Section>
        {explorarFiltered.length === 0 ? (
          <Modal.Section>
            <Text as="p" tone="subdued" alignment="center">
              No se encontraron productos
            </Text>
          </Modal.Section>
        ) : (
          <Modal.Section flush>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {explorarFiltered.map((p: Product) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid #f1f1f1',
                  }}
                >
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {p.name}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      SKU: {p.sku}
                      {p.barcode ? ` · ${p.barcode}` : ''}
                    </Text>
                  </div>
                  <InlineStack gap="300" blockAlign="center">
                    <Text as="span" variant="bodyMd">
                      ${p.costPrice.toFixed(2)}
                    </Text>
                    <Button
                      size="slim"
                      onClick={() => {
                        addProduct(p);
                        // keep modal open to allow adding more
                      }}
                    >
                      Agregar
                    </Button>
                  </InlineStack>
                </div>
              ))}
            </div>
          </Modal.Section>
        )}
      </Modal>
    </div>
  );
}
