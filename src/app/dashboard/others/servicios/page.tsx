'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Box,
  TextField,
  Select,
  Tabs,
  Banner,
  Spinner,
  Modal,
  Divider,
  InlineGrid,
  Icon,
} from '@shopify/polaris';
import {
  PhoneIcon,
  HomeIcon,
  PlusIcon,
  XSmallIcon,
  SearchIcon,
} from '@shopify/polaris-icons';
import {
  fetchServicios,
  fetchServiciosResumen,
  createRecarga,
  createPagoServicio,
  cancelarServicio,
} from '@/app/actions/servicios-actions';
import { SERVICIO_CATALOGO } from '@/app/actions/servicios-catalogo';
import { useToast } from '@/components/notifications/ToastProvider';
import type { Servicio } from '@/types';

type TabMode = 'recargas' | 'pagos' | 'historial';

export default function ServiciosPage() {
  const { showSuccess, showError } = useToast();

  // State
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [resumen, setResumen] = useState({ totalHoy: 0, comisionesHoy: 0, recargasHoy: 0, pagosHoy: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [search, setSearch] = useState('');

  // Recarga form
  const [recargaModalOpen, setRecargaModalOpen] = useState(false);
  const [recargaOperador, setRecargaOperador] = useState('');
  const [recargaMonto, setRecargaMonto] = useState('');
  const [recargaTelefono, setRecargaTelefono] = useState('');
  const [recargaSubmitting, setRecargaSubmitting] = useState(false);

  // Pago servicio form
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [pagoServicio, setPagoServicio] = useState('');
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoReferencia, setPagoReferencia] = useState('');
  const [pagoSubmitting, setPagoSubmitting] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        fetchServicios(),
        fetchServiciosResumen(),
      ]);
      setServicios(list);
      setResumen(summary);
    } catch {
      showError('Error al cargar servicios');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { loadData(); }, [loadData]);

  // Tab mapping
  const tabMode: TabMode = selectedTab === 0 ? 'recargas' : selectedTab === 1 ? 'pagos' : 'historial';

  // Filtered list
  const filtered = useMemo(() => {
    let result = servicios;
    if (tabMode === 'recargas') result = result.filter((s) => s.tipo === 'recarga');
    if (tabMode === 'pagos') result = result.filter((s) => s.tipo === 'servicio');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          s.numeroReferencia.includes(q) ||
          s.folio.toLowerCase().includes(q),
      );
    }
    return result;
  }, [servicios, tabMode, search]);

  // Selected operator catalog entry
  const operadorEntry = SERVICIO_CATALOGO.recargas.find((r) => r.id === recargaOperador);
  const servicioEntry = SERVICIO_CATALOGO.servicios.find((s) => s.id === pagoServicio);

  // Handlers
  const handleRecarga = useCallback(async () => {
    if (!recargaOperador || !recargaMonto || !recargaTelefono) return;
    setRecargaSubmitting(true);
    try {
      const entry = SERVICIO_CATALOGO.recargas.find((r) => r.id === recargaOperador);
      await createRecarga({
        categoria: recargaOperador,
        nombre: entry?.nombre ?? recargaOperador,
        monto: Number(recargaMonto),
        numeroReferencia: recargaTelefono.replace(/\D/g, ''),
        cajero: 'Cajero',
      });
      showSuccess(`Recarga de $${recargaMonto} a ${entry?.nombre} realizada`);
      setRecargaModalOpen(false);
      setRecargaOperador('');
      setRecargaMonto('');
      setRecargaTelefono('');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al procesar recarga');
    } finally {
      setRecargaSubmitting(false);
    }
  }, [recargaOperador, recargaMonto, recargaTelefono, showSuccess, showError, loadData]);

  const handlePago = useCallback(async () => {
    if (!pagoServicio || !pagoMonto || !pagoReferencia) return;
    setPagoSubmitting(true);
    try {
      const entry = SERVICIO_CATALOGO.servicios.find((s) => s.id === pagoServicio);
      await createPagoServicio({
        categoria: pagoServicio,
        nombre: entry?.nombre ?? pagoServicio,
        monto: Number(pagoMonto),
        numeroReferencia: pagoReferencia.trim(),
        cajero: 'Cajero',
      });
      showSuccess(`Pago de ${entry?.nombre} por $${pagoMonto} registrado`);
      setPagoModalOpen(false);
      setPagoServicio('');
      setPagoMonto('');
      setPagoReferencia('');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al procesar pago');
    } finally {
      setPagoSubmitting(false);
    }
  }, [pagoServicio, pagoMonto, pagoReferencia, showSuccess, showError, loadData]);

  const handleCancelar = useCallback(async (id: string) => {
    if (!confirm('¿Cancelar este servicio?')) return;
    try {
      await cancelarServicio(id);
      showSuccess('Servicio cancelado');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al cancelar');
    }
  }, [showSuccess, showError, loadData]);

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'completado': return <Badge tone="success">Completado</Badge>;
      case 'pendiente': return <Badge tone="attention">Pendiente</Badge>;
      case 'cancelado': return <Badge tone="critical">Cancelado</Badge>;
      default: return <Badge>{estado}</Badge>;
    }
  };

  if (loading) {
    return (
      <Page title="Servicios y Recargas">
        <Box padding="800">
          <InlineStack align="center"><Spinner size="large" /></InlineStack>
        </Box>
      </Page>
    );
  }

  return (
    <Page
      title="Servicios y Recargas"
      subtitle="Recargas telefónicas y pagos de servicios — gana comisiones por cada transacción"
      primaryAction={{ content: 'Nueva Recarga', icon: PhoneIcon, onAction: () => setRecargaModalOpen(true) }}
      secondaryActions={[
        { content: 'Pago de Servicio', icon: HomeIcon, onAction: () => setPagoModalOpen(true) },
      ]}
      backAction={{ content: 'Dashboard', url: '/dashboard' }}
    >
      <Layout>
        {/* KPI Cards */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">Transacciones hoy</Text>
                <Text variant="headingLg" as="p">{resumen.recargasHoy + resumen.pagosHoy}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">Monto operado</Text>
                <Text variant="headingLg" as="p">${resumen.totalHoy.toFixed(2)}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">Comisiones ganadas</Text>
                <Text variant="headingLg" as="p" fontWeight="bold">${resumen.comisionesHoy.toFixed(2)}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">Desglose</Text>
                <InlineStack gap="200">
                  <Badge tone="info">{`${resumen.recargasHoy} recargas`}</Badge>
                  <Badge>{`${resumen.pagosHoy} pagos`}</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Tabs + table */}
        <Layout.Section>
          <Card padding="0">
            <Tabs
              tabs={[
                { id: 'recargas', content: `Recargas (${servicios.filter((s) => s.tipo === 'recarga').length})` },
                { id: 'pagos', content: `Pagos (${servicios.filter((s) => s.tipo === 'servicio').length})` },
                { id: 'historial', content: `Todo (${servicios.length})` },
              ]}
              selected={selectedTab}
              onSelect={setSelectedTab}
            >
              <Box padding="400" paddingBlockEnd="0">
                <TextField
                  label=""
                  labelHidden
                  prefix={<Icon source={SearchIcon} />}
                  placeholder="Buscar por nombre, teléfono o folio..."
                  value={search}
                  onChange={setSearch}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearch('')}
                />
              </Box>

              <IndexTable
                resourceName={{ singular: 'servicio', plural: 'servicios' }}
                itemCount={filtered.length}
                headings={[
                  { title: 'Folio' },
                  { title: 'Tipo' },
                  { title: 'Servicio' },
                  { title: 'Referencia' },
                  { title: 'Monto' },
                  { title: 'Comisión' },
                  { title: 'Estado' },
                  { title: 'Fecha' },
                  { title: '' },
                ]}
                selectable={false}
                emptyState={
                  <Box padding="800">
                    <BlockStack gap="300" align="center">
                      <Text variant="headingSm" as="h3">Sin transacciones</Text>
                      <Text as="p" tone="subdued">Realiza tu primera recarga o pago de servicio.</Text>
                    </BlockStack>
                  </Box>
                }
              >
                {filtered.map((srv) => (
                  <IndexTable.Row id={srv.id} key={srv.id} position={0}>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" fontWeight="semibold" as="span">{srv.folio}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={srv.tipo === 'recarga' ? 'info' : 'warning'}>
                        {srv.tipo === 'recarga' ? 'Recarga' : 'Pago'}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span">{srv.nombre}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">{srv.numeroReferencia}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="semibold">${srv.monto.toFixed(2)}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="success">${srv.comision.toFixed(2)}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{estadoBadge(srv.estado)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {new Date(srv.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {srv.estado === 'completado' && (
                        <Button
                          icon={XSmallIcon}
                          tone="critical"
                          variant="plain"
                          onClick={() => handleCancelar(srv.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      {/* ── Modal: Nueva Recarga ── */}
      <Modal
        open={recargaModalOpen}
        onClose={() => setRecargaModalOpen(false)}
        title="Nueva Recarga Telefónica"
        primaryAction={{
          content: recargaSubmitting ? 'Procesando...' : `Recargar $${recargaMonto || '0'}`,
          onAction: handleRecarga,
          loading: recargaSubmitting,
          disabled: !recargaOperador || !recargaMonto || !recargaTelefono || recargaTelefono.replace(/\D/g, '').length < 10,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setRecargaModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Operador"
              options={[
                { label: 'Selecciona operador...', value: '' },
                ...SERVICIO_CATALOGO.recargas.map((r) => ({ label: r.nombre, value: r.id })),
              ]}
              value={recargaOperador}
              onChange={(v) => { setRecargaOperador(v); setRecargaMonto(''); }}
            />

            {operadorEntry && (
              <>
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p" fontWeight="semibold">Selecciona monto</Text>
                  <InlineStack gap="200" wrap>
                    {operadorEntry.montos.map((m) => (
                      <Button
                        key={m}
                        variant={recargaMonto === String(m) ? 'primary' : 'secondary'}
                        onClick={() => setRecargaMonto(String(m))}
                      >
                        {`$${m}`}
                      </Button>
                    ))}
                  </InlineStack>
                </BlockStack>

                <TextField
                  label="Número de teléfono (10 dígitos)"
                  value={recargaTelefono}
                  onChange={setRecargaTelefono}
                  placeholder="55 1234 5678"
                  autoComplete="tel"
                  type="tel"
                  maxLength={15}
                />

                {recargaMonto && (
                  <Banner tone="info">
                    <Text as="p" variant="bodySm">
                      Comisión por esta recarga: <Text as="span" fontWeight="bold">${(Number(recargaMonto) * operadorEntry.comisionPct / 100).toFixed(2)} ({operadorEntry.comisionPct}%)</Text>
                    </Text>
                  </Banner>
                )}
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ── Modal: Pago de Servicio ── */}
      <Modal
        open={pagoModalOpen}
        onClose={() => setPagoModalOpen(false)}
        title="Pago de Servicio"
        primaryAction={{
          content: pagoSubmitting ? 'Procesando...' : `Pagar $${pagoMonto || '0'}`,
          onAction: handlePago,
          loading: pagoSubmitting,
          disabled: !pagoServicio || !pagoMonto || Number(pagoMonto) <= 0 || !pagoReferencia || pagoReferencia.trim().length < 5,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setPagoModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Servicio"
              options={[
                { label: 'Selecciona servicio...', value: '' },
                ...SERVICIO_CATALOGO.servicios.map((s) => ({ label: s.nombre, value: s.id })),
              ]}
              value={pagoServicio}
              onChange={setPagoServicio}
            />

            {servicioEntry && (
              <>
                <TextField
                  label={`Número de referencia / cuenta ${servicioEntry.nombre}`}
                  value={pagoReferencia}
                  onChange={setPagoReferencia}
                  placeholder="Número de servicio, cuenta o contrato"
                  autoComplete="off"
                />

                <TextField
                  label="Monto a pagar"
                  value={pagoMonto}
                  onChange={setPagoMonto}
                  prefix="$"
                  type="number"
                  autoComplete="off"
                  min={1}
                />

                <Banner tone="info">
                  <Text as="p" variant="bodySm">
                    Comisión fija por este pago: <Text as="span" fontWeight="bold">${servicioEntry.comisionFija.toFixed(2)}</Text>
                  </Text>
                </Banner>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
