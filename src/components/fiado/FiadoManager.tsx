'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Modal,
  FormLayout,
  Select,
  Box,
  Banner,
  Page,
  IndexFilters,
  IndexFiltersMode,
  useSetIndexFiltersMode,
  InlineGrid,
  ProgressBar,
  useIndexResourceState,
} from '@shopify/polaris';
import type { TabProps } from '@shopify/polaris';
import { PersonFilledIcon as _PersonFilledIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { CustomerProfile } from './CustomerProfile';
import { NewCustomerForm } from './NewCustomerForm';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { ClientImportModal } from '@/components/inventory/ShopifyModals';
import type { Cliente } from '@/types';

// ── Tab config ──
const TAB_DEFS: { id: string; content: string; filter: 'all' | 'debt' | 'no_debt' }[] = [
  { id: 'todos', content: 'Todos', filter: 'all' },
  { id: 'con-deuda', content: 'Con adeudo', filter: 'debt' },
  { id: 'sin-deuda', content: 'Al corriente', filter: 'no_debt' },
];

interface FiadoManagerProps {
  mode?: 'all' | 'fiado';
}

export function FiadoManager({ mode = 'all' }: FiadoManagerProps) {
  const clientes = useDashboardStore((s) => s.clientes);
  const fiadoTransactions = useDashboardStore((s) => s.fiadoTransactions);
  const loyaltyTransactions = useDashboardStore((s) => s.loyaltyTransactions);
  const _addCliente = useDashboardStore((s) => s.addCliente);
  const registerFiado = useDashboardStore((s) => s.registerFiado);
  const registerAbono = useDashboardStore((s) => s.registerAbono);
  const updateCliente = useDashboardStore((s) => s.updateCliente);
  const deleteCliente = useDashboardStore((s) => s.deleteCliente);
  const { showSuccess, showError } = useToast();
  const { hasPermission, isLoaded: permsLoaded } = usePermissions();

  const canEditClients = !permsLoaded || hasPermission('customers.edit');
  const _canCreateFiado = !permsLoaded || hasPermission('fiado.create');

  // ── Views ──
  const [addClienteOpen, setAddClienteOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Cliente | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // ── Index Filters ──
  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const [sortSelected, setSortSelected] = useState(['name asc']);
  const { mode: filterMode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);

  // ── Modal: Fiado ──
  const [fiadoOpen, setFiadoOpen] = useState(false);
  const [fiadoClienteId, setFiadoClienteId] = useState('');
  const [fiadoAmount, setFiadoAmount] = useState('');
  const [fiadoDescription, setFiadoDescription] = useState('');

  // ── Modal: Abono ──
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [abonoClienteId, setAbonoClienteId] = useState('');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoDescription, setAbonoDescription] = useState('');

  // ── Modal: Edit ──
  const [editClienteOpen, setEditClienteOpen] = useState(false);
  const [editCliente, _setEditCliente] = useState<Cliente | null>(null);
  const [editCName, setEditCName] = useState('');
  const [editCPhone, setEditCPhone] = useState('');
  const [editCAddress, setEditCAddress] = useState('');
  const [editCCreditLimit, setEditCCreditLimit] = useState('');

  // ── KPI calculations ──
  const kpis = useMemo(() => {
    const totalDebt = clientes.reduce((s, c) => s + c.balance, 0);
    const withDebt = clientes.filter((c) => c.balance > 0);
    const avgUsage =
      clientes.length > 0
        ? clientes.reduce((s, c) => s + (c.creditLimit > 0 ? (c.balance / c.creditLimit) * 100 : 0), 0) /
          clientes.length
        : 0;
    const totalPoints = clientes.reduce((s, c) => s + (c.points || 0), 0);
    const totalCredit = clientes.reduce((s, c) => s + c.creditLimit, 0);

    return { totalDebt, debtorCount: withDebt.length, avgUsage, totalPoints, totalCredit };
  }, [clientes]);

  // ── Tabs ──
  const tabs: TabProps[] = TAB_DEFS.map((t, i) => ({
    content: t.content,
    index: i,
    id: t.id,
    isLocked: i === 0,
    onAction: () => {},
  }));

  // ── Sort options ──
  const sortOptions = [
    { label: 'Nombre', value: 'name asc' as const, directionLabel: 'A-Z' },
    { label: 'Nombre', value: 'name desc' as const, directionLabel: 'Z-A' },
    { label: 'Saldo', value: 'balance desc' as const, directionLabel: 'Mayor deuda' },
    { label: 'Saldo', value: 'balance asc' as const, directionLabel: 'Menor deuda' },
    { label: 'Puntos', value: 'points desc' as const, directionLabel: 'Más puntos' },
    { label: 'Puntos', value: 'points asc' as const, directionLabel: 'Menos puntos' },
    { label: 'Actividad', value: 'activity desc' as const, directionLabel: 'Más reciente' },
    { label: 'Actividad', value: 'activity asc' as const, directionLabel: 'Más antiguo' },
  ];

  // ── Filtered + sorted ──
  const filteredClientes = useMemo(() => {
    let list = [...clientes];

    // Tab filter
    const tabFilter = TAB_DEFS[selectedTab]?.filter ?? 'all';
    if (tabFilter === 'debt') list = list.filter((c) => c.balance > 0);
    else if (tabFilter === 'no_debt') list = list.filter((c) => c.balance === 0);

    // Mode filter from parent (fiado page)
    if (mode === 'fiado') list = list.filter((c) => c.balance > 0);

    // Search
    if (queryValue.trim()) {
      const q = queryValue.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q)),
      );
    }

    // Sort
    const [sortKey, sortDir] = sortSelected[0].split(' ');
    list.sort((a, b) => {
      const order = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * order;
      if (sortKey === 'balance') return (a.balance - b.balance) * order;
      if (sortKey === 'points') return ((a.points || 0) - (b.points || 0)) * order;
      if (sortKey === 'activity') {
        const da = a.lastTransaction ? new Date(a.lastTransaction).getTime() : 0;
        const db = b.lastTransaction ? new Date(b.lastTransaction).getTime() : 0;
        return (da - db) * order;
      }
      return 0;
    });

    return list;
  }, [clientes, selectedTab, queryValue, sortSelected, mode]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(
    filteredClientes as { id: string }[],
  );

  const clienteOptions = useMemo(
    () => [
      { label: 'Seleccionar cliente...', value: '' },
      ...clientes.map((c) => ({
        label: `${c.name}${c.balance > 0 ? ` — Debe: ${formatCurrency(c.balance)}` : ''}`,
        value: c.id,
      })),
    ],
    [clientes],
  );

  const clientesWithDebt = useMemo(() => clientes.filter((c) => c.balance > 0), [clientes]);
  const clientesWithDebtOptions = useMemo(
    () => [
      { label: 'Seleccionar cliente...', value: '' },
      ...clientesWithDebt.map((c) => ({
        label: `${c.name} — Debe: ${formatCurrency(c.balance)}`,
        value: c.id,
      })),
    ],
    [clientesWithDebt],
  );

  // ── Handlers ──
  const handleSuccessNewCliente = useCallback(() => {
    setAddClienteOpen(false);
    useDashboardStore.getState().fetchDashboardData();
  }, []);

  const handleFiado = useCallback(async () => {
    if (!fiadoClienteId || !fiadoAmount || !fiadoDescription.trim()) {
      showError('Completa todos los campos');
      return;
    }
    const cliente = clientes.find((c) => c.id === fiadoClienteId);
    if (cliente && cliente.balance + parseFloat(fiadoAmount) > cliente.creditLimit) {
      showError(`El cliente excede su límite de crédito de ${formatCurrency(cliente.creditLimit)}`);
      return;
    }
    await registerFiado(fiadoClienteId, parseFloat(fiadoAmount), fiadoDescription.trim());
    showSuccess(`Fiado de ${formatCurrency(parseFloat(fiadoAmount))} registrado`);
    setFiadoClienteId('');
    setFiadoAmount('');
    setFiadoDescription('');
    setFiadoOpen(false);
  }, [fiadoClienteId, fiadoAmount, fiadoDescription, clientes, registerFiado, showSuccess, showError]);

  const handleAbono = useCallback(async () => {
    if (!abonoClienteId || !abonoAmount) {
      showError('Selecciona un cliente y monto');
      return;
    }
    await registerAbono(abonoClienteId, parseFloat(abonoAmount), abonoDescription.trim() || 'Abono');
    showSuccess(`Abono de ${formatCurrency(parseFloat(abonoAmount))} registrado`);
    setAbonoClienteId('');
    setAbonoAmount('');
    setAbonoDescription('');
    setAbonoOpen(false);
  }, [abonoClienteId, abonoAmount, abonoDescription, registerAbono, showSuccess, showError]);

  const handleSaveCliente = useCallback(async () => {
    if (!editCliente || !editCName.trim()) {
      showError('Nombre es obligatorio');
      return;
    }
    try {
      await updateCliente(editCliente.id, {
        name: editCName.trim(),
        phone: editCPhone.trim(),
        address: editCAddress.trim(),
        creditLimit: parseFloat(editCCreditLimit) || 500,
      });
      showSuccess(`"${editCName}" actualizado`);
      setEditClienteOpen(false);
    } catch {
      showError('Error al actualizar cliente');
    }
  }, [editCliente, editCName, editCPhone, editCAddress, editCCreditLimit, updateCliente, showSuccess, showError]);

  const _handleDeleteCliente = useCallback(
    async (id: string) => {
      try {
        const c = clientes.find((cl) => cl.id === id);
        await deleteCliente(id);
        showSuccess(`Cliente "${c?.name}" eliminado`);
      } catch {
        showError('Error al eliminar cliente');
      }
    },
    [clientes, deleteCliente, showSuccess, showError],
  );

  // ── Sub-views ──
  if (addClienteOpen) {
    return <NewCustomerForm onBack={() => setAddClienteOpen(false)} onSuccess={handleSuccessNewCliente} />;
  }

  if (viewingProfile) {
    return (
      <CustomerProfile
        cliente={viewingProfile}
        transactions={fiadoTransactions.filter((t) => t.clienteId === viewingProfile.id)}
        loyaltyTransactions={loyaltyTransactions.filter((t) => t.clienteId === viewingProfile.id)}
        onBack={() => setViewingProfile(null)}
      />
    );
  }

  // ── Row markup ──
  const rowMarkup = filteredClientes.map((cliente, idx) => {
    const clientTx = fiadoTransactions.filter((t) => t.clienteId === cliente.id);
    const totalSpent = clientTx.filter((t) => t.type === 'fiado').reduce((sum, t) => sum + t.amount, 0);
    const usagePercent = cliente.creditLimit > 0 ? Math.min(100, (cliente.balance / cliente.creditLimit) * 100) : 0;
    const lastActivity = cliente.lastTransaction
      ? new Date(cliente.lastTransaction).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          year: '2-digit',
        })
      : '—';

    return (
      <IndexTable.Row
        id={cliente.id}
        key={cliente.id}
        position={idx}
        selected={selectedResources.includes(cliente.id)}
        onClick={() => setViewingProfile(cliente)}
      >
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" fontWeight="semibold" variant="bodyMd">
              {cliente.name}
            </Text>
            {cliente.phone && (
              <Text as="span" variant="bodyXs" tone="subdued">
                {cliente.phone}
              </Text>
            )}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {formatCurrency(cliente.creditLimit)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {cliente.balance > 0 ? (
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" fontWeight="semibold" tone="critical">
                {formatCurrency(cliente.balance)}
              </Text>
              <div style={{ maxWidth: 120 }}>
                <ProgressBar
                  progress={usagePercent}
                  size="small"
                  tone={usagePercent > 80 ? 'critical' : usagePercent > 50 ? 'highlight' : 'primary'}
                />
              </div>
            </BlockStack>
          ) : (
            <Badge tone="success">Sin adeudo</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {formatCurrency(Math.max(0, cliente.creditLimit - cliente.balance))}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {formatCurrency(totalSpent)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {lastActivity}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {(cliente.points || 0) > 0 ? (
            <Badge tone="info">{`${cliente.points} pts`}</Badge>
          ) : (
            <Text as="span" variant="bodySm" tone="subdued">
              0
            </Text>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      fullWidth
      title="Clientes"
      primaryAction={
        canEditClients
          ? {
              content: 'Agregar cliente',
              onAction: () => setAddClienteOpen(true),
            }
          : undefined
      }
      secondaryActions={[
        { content: 'Importar', onAction: () => setIsImportOpen(true) },
      ]}
    >
      <BlockStack gap="400">
        {/* ═══ KPI SUMMARY ═══ */}
        <InlineGrid columns={{ xs: 2, md: 5 }} gap="300">
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodyXs" tone="subdued">
                Total Clientes
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {clientes.length}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                {kpis.debtorCount} con adeudo activo
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodyXs" tone="subdued">
                Cartera por Cobrar
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold" tone="critical">
                {formatCurrency(kpis.totalDebt)}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                pendiente de cobro
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodyXs" tone="subdued">
                Crédito Total Otorgado
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {formatCurrency(kpis.totalCredit)}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                entre todos los clientes
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodyXs" tone="subdued">
                Uso Promedio de Crédito
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {kpis.avgUsage.toFixed(1)}%
              </Text>
              <div style={{ maxWidth: 140 }}>
                <ProgressBar
                  progress={kpis.avgUsage}
                  size="small"
                  tone={kpis.avgUsage > 70 ? 'critical' : kpis.avgUsage > 40 ? 'highlight' : 'primary'}
                />
              </div>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodyXs" tone="subdued">
                Puntos en Circulación
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {kpis.totalPoints.toLocaleString()}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                programa de lealtad
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* ═══ QUICK ACTIONS ═══ */}
        <InlineStack gap="200" align="end">
          <Button onClick={() => setFiadoOpen(true)}>Registrar Fiado</Button>
          <Button onClick={() => setAbonoOpen(true)}>Registrar Abono</Button>
        </InlineStack>

        {/* ═══ INDEX TABLE WITH FILTERS ═══ */}
        <Card padding="0">
          <IndexFilters
            sortOptions={sortOptions}
            sortSelected={sortSelected}
            queryValue={queryValue}
            queryPlaceholder="Buscar por nombre, teléfono o dirección..."
            onQueryChange={setQueryValue}
            onQueryClear={() => setQueryValue('')}
            onSort={setSortSelected}
            cancelAction={{ onAction: () => {}, disabled: false, loading: false }}
            tabs={tabs}
            selected={selectedTab}
            onSelect={setSelectedTab}
            mode={filterMode}
            setMode={setMode}
            filters={[]}
            appliedFilters={[]}
            onClearAll={() => {}}
          />

          <IndexTable
            resourceName={{ singular: 'cliente', plural: 'clientes' }}
            itemCount={filteredClientes.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Cliente' },
              { title: 'Límite Crédito' },
              { title: 'Saldo Pendiente' },
              { title: 'Disponible' },
              { title: 'Total Compras' },
              { title: 'Última Actividad' },
              { title: 'Puntos' },
            ]}
            emptyState={
              <Box padding="800">
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="p" variant="headingMd" alignment="center">
                    {queryValue ? 'Sin resultados' : 'Sin clientes registrados'}
                  </Text>
                  <Text as="p" tone="subdued" alignment="center">
                    {queryValue
                      ? `No se encontraron clientes para "${queryValue}"`
                      : 'Comienza agregando un cliente para gestionar créditos y lealtad.'}
                  </Text>
                  {!queryValue && canEditClients && (
                    <Box paddingBlockStart="200">
                      <Button variant="primary" onClick={() => setAddClienteOpen(true)}>
                        Agregar primer cliente
                      </Button>
                    </Box>
                  )}
                </BlockStack>
              </Box>
            }
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      </BlockStack>

      {/* ═══ Modal: Registrar Fiado ═══ */}
      <Modal
        open={fiadoOpen}
        onClose={() => setFiadoOpen(false)}
        title="Registrar Fiado"
        primaryAction={{ content: 'Registrar Fiado', onAction: handleFiado, disabled: !fiadoClienteId || !fiadoAmount }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setFiadoOpen(false) }]}
      >
        <Modal.Section>
          <Banner tone="warning">
            <p>El fiado se sumará a la deuda del cliente.</p>
          </Banner>
        </Modal.Section>
        <Modal.Section>
          <FormLayout>
            <Select label="Cliente" options={clienteOptions} value={fiadoClienteId} onChange={setFiadoClienteId} />
            {fiadoClienteId &&
              (() => {
                const c = clientes.find((cl) => cl.id === fiadoClienteId);
                return c ? (
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm">
                        Deuda actual: <strong>{formatCurrency(c.balance)}</strong>
                      </Text>
                      <Text as="p" variant="bodySm">
                        Disponible: <strong>{formatCurrency(Math.max(0, c.creditLimit - c.balance))}</strong>
                      </Text>
                    </InlineStack>
                  </Box>
                ) : null;
              })()}
            <TextField
              label="Monto (MXN)"
              type="number"
              value={fiadoAmount}
              onChange={setFiadoAmount}
              autoComplete="off"
              prefix="$"
              placeholder="0.00"
            />
            <TextField
              label="Descripción / Concepto"
              value={fiadoDescription}
              onChange={setFiadoDescription}
              autoComplete="off"
              placeholder="Ej: Leche, pan, huevo"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* ═══ Modal: Registrar Abono ═══ */}
      <Modal
        open={abonoOpen}
        onClose={() => setAbonoOpen(false)}
        title="Registrar Abono"
        primaryAction={{ content: 'Registrar Abono', onAction: handleAbono, disabled: !abonoClienteId || !abonoAmount }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setAbonoOpen(false) }]}
      >
        <Modal.Section>
          <Banner tone="success">
            <p>El abono reducirá la deuda del cliente.</p>
          </Banner>
        </Modal.Section>
        <Modal.Section>
          <FormLayout>
            <Select
              label="Cliente"
              options={clientesWithDebtOptions}
              value={abonoClienteId}
              onChange={setAbonoClienteId}
            />
            {abonoClienteId &&
              (() => {
                const c = clientes.find((cl) => cl.id === abonoClienteId);
                return c ? (
                  <Box padding="300" background="bg-fill-critical-secondary" borderRadius="200">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Deuda actual: {formatCurrency(c.balance)}
                    </Text>
                  </Box>
                ) : null;
              })()}
            <TextField
              label="Monto del abono (MXN)"
              type="number"
              value={abonoAmount}
              onChange={setAbonoAmount}
              autoComplete="off"
              prefix="$"
              placeholder="0.00"
            />
            <TextField
              label="Descripción (opcional)"
              value={abonoDescription}
              onChange={setAbonoDescription}
              autoComplete="off"
              placeholder="Ej: Abono semanal"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* ═══ Modal: Editar Cliente ═══ */}
      <Modal
        open={editClienteOpen}
        onClose={() => setEditClienteOpen(false)}
        title={`Editar: ${editCliente?.name || ''}`}
        primaryAction={{ content: 'Guardar Cambios', onAction: handleSaveCliente, disabled: !editCName.trim() }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setEditClienteOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Nombre completo" value={editCName} onChange={setEditCName} autoComplete="off" />
            <TextField label="Teléfono" value={editCPhone} onChange={setEditCPhone} autoComplete="off" />
            <TextField
              label="Dirección / Referencia"
              value={editCAddress}
              onChange={setEditCAddress}
              autoComplete="off"
            />
            <TextField
              label="Límite de crédito (MXN)"
              type="number"
              value={editCCreditLimit}
              onChange={setEditCCreditLimit}
              autoComplete="off"
              prefix="$"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <ClientImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => useDashboardStore.getState().fetchDashboardData()}
      />
    </Page>
  );
}
