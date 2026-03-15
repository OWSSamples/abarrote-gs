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
  EmptyState,
  Box,
  Divider,
  Banner,
  ProgressBar,
  Page,
  Icon,
  Popover,
  ActionList,
  Tooltip,
} from '@shopify/polaris';
import {
  PlusIcon,
  CashDollarIcon,
  SearchIcon,
  ChevronDownIcon,
  CheckIcon,
  PersonIcon,
  ExportIcon,
  ImportIcon,
  SortIcon,
  DataTableIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  RefreshIcon,
  PersonFilledIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { CustomerProfile } from './CustomerProfile';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/lib/usePermissions';
import { GenericExportModal, ClientImportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';
import type { Cliente, FiadoTransaction } from '@/types';

export function FiadoManager() {
  const { clientes, fiadoTransactions, addCliente, registerFiado, registerAbono, updateCliente, deleteCliente } = useDashboardStore();
  const { showSuccess, showError } = useToast();
  const { hasPermission, isLoaded: permsLoaded } = usePermissions();

  const canEditClients = !permsLoaded || hasPermission('customers.edit');
  const canCreateFiado = !permsLoaded || hasPermission('fiado.create');

  const [addClienteOpen, setAddClienteOpen] = useState(false);
  const [fiadoOpen, setFiadoOpen] = useState(false);
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Cliente | null>(null);

  // Sort state
  const [sortActive, setSortActive] = useState(false);
  const [sortBy, setSortBy] = useState('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const toggleSortActive = useCallback(() => setSortActive((active) => !active), []);

  // Edit / Delete client state
  const [editClienteOpen, setEditClienteOpen] = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | null>(null);
  const [editCName, setEditCName] = useState('');
  const [editCPhone, setEditCPhone] = useState('');
  const [editCAddress, setEditCAddress] = useState('');
  const [editCCreditLimit, setEditCCreditLimit] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New cliente form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('500');

  // Fiado form
  const [fiadoClienteId, setFiadoClienteId] = useState('');
  const [fiadoAmount, setFiadoAmount] = useState('');
  const [fiadoDescription, setFiadoDescription] = useState('');

  // Abono form
  const [abonoClienteId, setAbonoClienteId] = useState('');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoDescription, setAbonoDescription] = useState('');

  const totalDebt = useMemo(() => clientes.reduce((sum, c) => sum + c.balance, 0), [clientes]);
  const clientesWithDebt = useMemo(() => clientes.filter((c) => c.balance > 0), [clientes]);

  const clienteOptions = useMemo(() => [
    { label: 'Seleccionar cliente...', value: '' },
    ...clientes.map((c) => ({
      label: `${c.name}${c.balance > 0 ? ` — Debe: ${formatCurrency(c.balance)}` : ''}`,
      value: c.id,
    })),
  ], [clientes]);

  const clientesWithDebtOptions = useMemo(() => [
    { label: 'Seleccionar cliente...', value: '' },
    ...clientesWithDebt.map((c) => ({
      label: `${c.name} — Debe: ${formatCurrency(c.balance)}`,
      value: c.id,
    })),
  ], [clientesWithDebt]);

  const handleAddCliente = useCallback(async () => {
    if (!newName.trim()) { showError('Ingresa el nombre del cliente'); return; }
    await addCliente({
      name: newName.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim(),
      creditLimit: parseFloat(newCreditLimit) || 500,
      points: 0,
    });
    showSuccess(`Cliente "${newName}" agregado`);
    setNewName(''); setNewPhone(''); setNewAddress(''); setNewCreditLimit('500');
    setAddClienteOpen(false);
  }, [newName, newPhone, newAddress, newCreditLimit, addCliente, showSuccess, showError]);

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
    setFiadoClienteId(''); setFiadoAmount(''); setFiadoDescription('');
    setFiadoOpen(false);
  }, [fiadoClienteId, fiadoAmount, fiadoDescription, clientes, registerFiado, showSuccess, showError]);

  const handleAbono = useCallback(async () => {
    if (!abonoClienteId || !abonoAmount) {
      showError('Selecciona un cliente y monto');
      return;
    }
    await registerAbono(abonoClienteId, parseFloat(abonoAmount), abonoDescription.trim() || 'Abono');
    showSuccess(`Abono de ${formatCurrency(parseFloat(abonoAmount))} registrado`);
    setAbonoClienteId(''); setAbonoAmount(''); setAbonoDescription('');
    setAbonoOpen(false);
  }, [abonoClienteId, abonoAmount, abonoDescription, registerAbono, showSuccess, showError]);

  const handleStartEditCliente = useCallback((cliente: Cliente) => {
    setEditCliente(cliente);
    setEditCName(cliente.name);
    setEditCPhone(cliente.phone);
    setEditCAddress(cliente.address);
    setEditCCreditLimit(String(cliente.creditLimit));
    setEditClienteOpen(true);
  }, []);

  const handleSaveCliente = useCallback(async () => {
    if (!editCliente || !editCName.trim()) { showError('Nombre es obligatorio'); return; }
    try {
      await updateCliente(editCliente.id, {
        name: editCName.trim(),
        phone: editCPhone.trim(),
        address: editCAddress.trim(),
        creditLimit: parseFloat(editCCreditLimit) || 500,
      });
      showSuccess(`"${editCName}" actualizado`);
      setEditClienteOpen(false);
    } catch { showError('Error al actualizar cliente'); }
  }, [editCliente, editCName, editCPhone, editCAddress, editCCreditLimit, updateCliente, showSuccess, showError]);

  const handleDeleteCliente = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const c = clientes.find(cl => cl.id === id);
      await deleteCliente(id);
      showSuccess(`Cliente "${c?.name}" eliminado`);
      setDeleteConfirmId(null);
    } catch { showError('Error al eliminar cliente'); }
    setDeleting(false);
  }, [clientes, deleteCliente, showSuccess, showError]);

  if (viewingProfile) {
    return (
      <CustomerProfile
        cliente={viewingProfile}
        transactions={fiadoTransactions.filter(t => t.clienteId === viewingProfile.id)}
        onBack={() => setViewingProfile(null)}
      />
    );
  }

  return (
    <Page
      fullWidth
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon source={PersonFilledIcon} tone="base" />
          <span>Clientes</span>
        </div>
      ) as any}
      primaryAction={
        canEditClients ? {
          content: 'Agregar cliente',
          onAction: () => setAddClienteOpen(true),
        } : undefined
      }
      secondaryActions={[
        {
          content: 'Actualizar',
          icon: RefreshIcon,
          onAction: () => {
            useDashboardStore.getState().fetchDashboardData();
          },
        },
        { content: 'Exportar', icon: ExportIcon, onAction: () => setIsExportOpen(true) },
        { content: 'Importar', icon: ImportIcon, onAction: () => setIsImportOpen(true) },
      ]}
    >
      <BlockStack gap="400">
        {/* Summary Card */}
        <Box
          padding="300"
          background="bg-surface-secondary"
          borderRadius="200"
          borderWidth="025"
          borderColor="border"
        >
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="100">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
              </Text>
              <Box borderInlineStartWidth="025" borderColor="border" paddingInlineStart="200">
                <Text as="span" tone="subdued">0 % de tu clientela</Text>
              </Box>
            </InlineStack>
            <Icon source={ChevronDownIcon} tone="subdued" />
          </InlineStack>
        </Box>

        {/* Action Buttons for Store logic */}
        <InlineStack gap="200">
          {canCreateFiado && (
            <Button variant="primary" tone="critical" onClick={() => setFiadoOpen(true)} disabled={clientes.length === 0}>
              Registrar Fiado
            </Button>
          )}
          {canCreateFiado && (
            <Button variant="primary" onClick={() => setAbonoOpen(true)} disabled={clientesWithDebt.length === 0}>
              Registrar Abono
            </Button>
          )}
          <Badge tone={totalDebt > 0 ? 'attention' : 'success'}>
            {`Deuda total en tienda: ${formatCurrency(totalDebt)}`}
          </Badge>
        </InlineStack>

        {/* Clients list */}
        {clientes.length === 0 ? (
          <Card>
            <EmptyState heading="Sin clientes registrados" image="">
              <p>Agrega un cliente para empezar a manejar fiados y créditos.</p>
            </EmptyState>
          </Card>
        ) : (
          <Card padding="0">
            {/* Table Filter/Search header style Shopify */}
            <Box padding="200" borderBlockEndWidth="025" borderStyle="solid" borderColor="border">
              <InlineStack align="space-between" blockAlign="center">
                <Box width="320px">
                  <TextField
                    label="Buscar clientes"
                    labelHidden
                    autoComplete="off"
                    placeholder="Buscar clientes"
                    prefix={<Icon source={SearchIcon} tone="subdued" />}
                  />
                </Box>
                <InlineStack gap="200">
                  <Button variant="tertiary" icon={DataTableIcon} />
                  <Popover
                    active={sortActive}
                    activator={
                      <Tooltip content="Ordenar" dismissOnMouseOut>
                        <Button variant="tertiary" icon={SortIcon} onClick={toggleSortActive} />
                      </Tooltip>
                    }
                    onClose={toggleSortActive}
                  >
                    <Box padding="200" minWidth="280px">
                      <BlockStack gap="100">
                        <Box paddingInlineStart="300" paddingBlock="200">
                          <Text as="p" variant="bodyMd" tone="subdued">Ordenar por</Text>
                        </Box>

                        <div className="custom-sort-list">
                          {[
                            { id: 'updated', label: 'Última actualización' },
                            { id: 'spent', label: 'Importe gastado' },
                            { id: 'orders', label: 'Pedidos totales' },
                            { id: 'lastOrder', label: 'Fecha del último pedido' },
                            { id: 'firstOrder', label: 'Fecha del primer pedido' },
                            { id: 'created', label: 'Fecha en que se agregó como cliente' },
                            { id: 'abandoned', label: 'Fecha del último pedido abandonado' },
                          ].map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setSortBy(option.id)}
                              className={`sort-option-btn ${sortBy === option.id ? 'active' : ''}`}
                            >
                              <div className="radio-circle">
                                {sortBy === option.id && <div className="radio-inner" />}
                              </div>
                              <Text as="span" variant="bodyMd">
                                {option.label}
                              </Text>
                            </button>
                          ))}
                        </div>

                        <Divider />

                        <Box padding="100">
                          <BlockStack gap="100">
                            <button
                              onClick={() => setSortOrder('asc')}
                              className={`direction-btn ${sortOrder === 'asc' ? 'active' : ''}`}
                            >
                              <Icon source={ArrowUpIcon} tone="base" />
                              <Text as="span" variant="bodyMd" fontWeight={sortOrder === 'asc' ? 'semibold' : 'regular'}>
                                Más antiguo a más reciente
                              </Text>
                            </button>
                            <button
                              onClick={() => setSortOrder('desc')}
                              className={`direction-btn ${sortOrder === 'desc' ? 'active' : ''}`}
                            >
                              <Icon source={ArrowDownIcon} tone="base" />
                              <Text as="span" variant="bodyMd" fontWeight={sortOrder === 'desc' ? 'semibold' : 'regular'}>
                                Más reciente a más antiguo
                              </Text>
                            </button>
                          </BlockStack>
                        </Box>
                      </BlockStack>
                    </Box>
                  </Popover>
                </InlineStack>
              </InlineStack>
            </Box>

            <IndexTable
              resourceName={{ singular: 'cliente', plural: 'clientes' }}
              itemCount={clientes.length}
              headings={[
                { title: 'Nombre del cliente' },
                { title: 'Suscripción por email' },
                { title: 'Ubicación' },
                { title: 'Pedidos' },
                { title: 'Importe gastado' },
                { title: 'Acciones' },
              ]}
              selectable={false}
            >
              {clientes.map((cliente, idx) => {
                const clientTransactions = fiadoTransactions.filter(t => t.clienteId === cliente.id);
                const orderCount = new Set(clientTransactions.map(t => t.saleFolio).filter(Boolean)).size;
                const totalSpent = clientTransactions
                  .filter(t => t.type === 'fiado' && t.saleFolio)
                  .reduce((sum, t) => sum + t.amount, 0);

                return (
                  <IndexTable.Row id={cliente.id} key={cliente.id} position={idx}>
                    <IndexTable.Cell>
                      <Button variant="plain" onClick={() => setViewingProfile(cliente)}>
                        {cliente.name.toUpperCase()}
                      </Button>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone="success">Suscrito</Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">México</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span">{orderCount} pedidos</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="semibold">
                        {formatCurrency(totalSpent)}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="100">
                        {canEditClients && (
                          <Button variant="plain" onClick={() => handleStartEditCliente(cliente)}>Editar</Button>
                        )}
                        {canEditClients && (
                          deleteConfirmId === cliente.id ? (
                            <InlineStack gap="100">
                              <Button variant="plain" tone="critical" onClick={() => handleDeleteCliente(cliente.id)} loading={deleting}>Si</Button>
                              <Button variant="plain" onClick={() => setDeleteConfirmId(null)}>No</Button>
                            </InlineStack>
                          ) : (
                            <Button variant="plain" tone="critical" onClick={() => setDeleteConfirmId(cliente.id)}>Eliminar</Button>
                          )
                        )}
                      </InlineStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          </Card>
        )}
      </BlockStack>

      {/* Modal: Nuevo Cliente */}
      <Modal
        open={addClienteOpen}
        onClose={() => setAddClienteOpen(false)}
        title="Agregar Cliente"
        primaryAction={{ content: 'Guardar', onAction: handleAddCliente, disabled: !newName.trim() }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setAddClienteOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Nombre completo" value={newName} onChange={setNewName} autoComplete="off" placeholder="Juan Pérez" />
            <TextField label="Teléfono" value={newPhone} onChange={setNewPhone} autoComplete="off" placeholder="55 1234 5678" />
            <TextField label="Dirección / Referencia" value={newAddress} onChange={setNewAddress} autoComplete="off" placeholder="Calle Juárez #45, cerca de la iglesia" />
            <TextField label="Límite de crédito (MXN)" type="number" value={newCreditLimit} onChange={setNewCreditLimit} autoComplete="off" prefix="$" helpText="Monto máximo que puede deber" />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal: Registrar Fiado */}
      <Modal
        open={fiadoOpen}
        onClose={() => setFiadoOpen(false)}
        title="Registrar Fiado"
        primaryAction={{ content: 'Registrar Fiado', onAction: handleFiado, disabled: !fiadoClienteId || !fiadoAmount }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setFiadoOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <Banner tone="warning"><p>El fiado se sumará a la deuda del cliente.</p></Banner>
            <Select label="Cliente" options={clienteOptions} value={fiadoClienteId} onChange={setFiadoClienteId} />
            {fiadoClienteId && (() => {
              const c = clientes.find((cl) => cl.id === fiadoClienteId);
              return c ? (
                <Text as="p" variant="bodySm" tone="subdued">
                  Deuda actual: {formatCurrency(c.balance)} / Límite: {formatCurrency(c.creditLimit)} — Disponible: {formatCurrency(Math.max(0, c.creditLimit - c.balance))}
                </Text>
              ) : null;
            })()}
            <TextField label="Monto (MXN)" type="number" value={fiadoAmount} onChange={setFiadoAmount} autoComplete="off" prefix="$" placeholder="0.00" />
            <TextField label="Descripción / Concepto" value={fiadoDescription} onChange={setFiadoDescription} autoComplete="off" placeholder="Ej: Leche, pan, huevo" />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal: Registrar Abono */}
      <Modal
        open={abonoOpen}
        onClose={() => setAbonoOpen(false)}
        title="Registrar Abono"
        primaryAction={{ content: 'Registrar Abono', onAction: handleAbono, disabled: !abonoClienteId || !abonoAmount }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setAbonoOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <Banner tone="success"><p>El abono reducirá la deuda del cliente.</p></Banner>
            <Select label="Cliente" options={clientesWithDebtOptions} value={abonoClienteId} onChange={setAbonoClienteId} />
            {abonoClienteId && (() => {
              const c = clientes.find((cl) => cl.id === abonoClienteId);
              return c ? (
                <Text as="p" variant="bodySm" tone="critical">
                  Deuda actual: {formatCurrency(c.balance)}
                </Text>
              ) : null;
            })()}
            <TextField label="Monto del abono (MXN)" type="number" value={abonoAmount} onChange={setAbonoAmount} autoComplete="off" prefix="$" placeholder="0.00" />
            <TextField label="Descripción (opcional)" value={abonoDescription} onChange={setAbonoDescription} autoComplete="off" placeholder="Ej: Abono semanal" />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal: Editar Cliente */}
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
            <TextField label="Dirección / Referencia" value={editCAddress} onChange={setEditCAddress} autoComplete="off" />
            <TextField label="Límite de crédito (MXN)" type="number" value={editCCreditLimit} onChange={setEditCCreditLimit} autoComplete="off" prefix="$" />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar clientes"
        exportName="clientes"
        onExport={(format) => {
          const exportData = filteredClientes.map(c => ({
            "Nombre Completo": c.name,
            "Teléfono": c.phone || 'N/A',
            "Dirección": c.address || 'N/A',
            "Límite de Crédito": c.creditLimit,
            "Crédito Utilizado": c.currentBalance,
            "Crédito Disponible": Math.max(0, c.creditLimit - c.currentBalance)
          }));
          const filename = `Clientes_Kiosco_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Clientes y Créditos', exportData as Record<string, unknown>[], `${filename}.pdf`);
          } else {
            const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
            const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
            downloadFile(csvContent, `${filename}.csv`, mime);
          }
        }}
      />

      <ClientImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => useDashboardStore.getState().fetchDashboardData()}
      />
    </Page>
  );
}
