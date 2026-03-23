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
  Page,
  Icon,
  Popover,
  Tooltip,
  useIndexResourceState,
} from '@shopify/polaris';
import {
  PlusIcon,
  SearchIcon,
  ChevronDownIcon,
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
import { NewCustomerForm } from './NewCustomerForm';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { CustomerExportModal, ClientImportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';
import type { Cliente } from '@/types';

interface FiadoManagerProps {
  mode?: 'all' | 'fiado';
}

export function FiadoManager({ mode = 'all' }: FiadoManagerProps) {
  const clientes = useDashboardStore((s) => s.clientes);
  const fiadoTransactions = useDashboardStore((s) => s.fiadoTransactions);
  const loyaltyTransactions = useDashboardStore((s) => s.loyaltyTransactions);
  const addCliente = useDashboardStore((s) => s.addCliente);
  const registerFiado = useDashboardStore((s) => s.registerFiado);
  const registerAbono = useDashboardStore((s) => s.registerAbono);
  const updateCliente = useDashboardStore((s) => s.updateCliente);
  const deleteCliente = useDashboardStore((s) => s.deleteCliente);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [modeFilter, setModeFilter] = useState<'all' | 'debt' | 'no_debt'>('all');

  // Fiado form
  const [fiadoClienteId, setFiadoClienteId] = useState('');
  const [fiadoAmount, setFiadoAmount] = useState('');
  const [fiadoDescription, setFiadoDescription] = useState('');

  // Abono form
  const [abonoClienteId, setAbonoClienteId] = useState('');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoDescription, setAbonoDescription] = useState('');

  const totalDebt = useMemo(() => clientes.reduce((sum, c) => sum + c.balance, 0), [clientes]);
  
  const filteredClientes = useMemo(() => {
    let list = [...clientes];

    // Filter by UI mode filter
    if (modeFilter === 'debt') {
      list = list.filter(c => c.balance > 0);
    } else if (modeFilter === 'no_debt') {
      list = list.filter(c => c.balance === 0);
    }

    // Filter by mode (passed from Dashboard)
    if (mode === 'fiado') {
      list = list.filter(c => c.balance > 0);
    }

    // Filter by Search and Sort
    return list.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone && c.phone.includes(searchQuery))
    ).sort((a, b) => {
      const order = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'spent') {
        const spentA = fiadoTransactions.filter(t => t.clienteId === a.id && t.type === 'fiado').reduce((s, t) => s + t.amount, 0);
        const spentB = fiadoTransactions.filter(t => t.clienteId === b.id && t.type === 'fiado').reduce((s, t) => s + t.amount, 0);
        return (spentA - spentB) * order;
      }
      if (sortBy === 'balance') {
        return (a.balance - b.balance) * order;
      }
      return a.name.localeCompare(b.name) * order;
    });
  }, [clientes, searchQuery, sortBy, sortOrder, fiadoTransactions, mode, modeFilter]);

  // Selection state for IndexTable - MUST BE AFTER filteredClientes initialization
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(filteredClientes);

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

  if (addClienteOpen) {
    return (
      <NewCustomerForm
        onBack={() => setAddClienteOpen(false)}
        onSuccess={handleSuccessNewCliente}
      />
    );
  }

  if (viewingProfile) {
    return (
      <CustomerProfile
        cliente={viewingProfile}
        transactions={fiadoTransactions.filter(t => t.clienteId === viewingProfile.id)}
        loyaltyTransactions={loyaltyTransactions.filter(t => t.clienteId === viewingProfile.id)}
        onBack={() => setViewingProfile(null)}
      />
    );
  }

  return (
    <Page
      fullWidth
      title="Clientes"
      titleMetadata={<Icon source={PersonFilledIcon} tone="base" />}
      primaryAction={
        canEditClients ? {
          content: 'Agregar cliente',
          onAction: () => setAddClienteOpen(true),
        } : undefined
      }
      secondaryActions={[
        { content: 'Exportar', onAction: () => setIsExportOpen(true) },
        { content: 'Importar', onAction: () => setIsImportOpen(true) },
      ]}
    >
      <BlockStack gap="400">
        {/* Summary Card - Shopify Style */}
        <Box
          padding="300"
          background="bg-surface"
          borderRadius="200"
          borderWidth="025"
          borderColor="border"
        >
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Text as="span" variant="bodyMd">
                {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
              </Text>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#e1e3e5' }} />
              <Text as="span" tone="subdued">0 % de tu clientela</Text>
            </InlineStack>
            <Icon source={ChevronDownIcon} tone="subdued" />
          </InlineStack>
        </Box>

        {/* Banner with total debt info (Shopify Style) */}
        {totalDebt > 0 && (
          <Banner tone="info">
            <Text as="p">
              Tienes un adeudo total de <span style={{ fontWeight: 'bold' }}>{formatCurrency(totalDebt)}</span> pendiente de cobro entre todos tus clientes.
            </Text>
          </Banner>
        )}

        {clientes.length === 0 ? (
          <Card>
            <EmptyState
              heading="Aún no tienes clientes registrados"
              action={{
                content: 'Registrar primer cliente',
                onAction: () => setEditClienteOpen(true),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Comienza agregando clientes para gestionar sus compras a crédito y abonos.</p>
            </EmptyState>
          </Card>
        ) : (
          <Card padding="0">
            {/* Table Filter/Search header style Shopify - FIXED ROW NO WRAP */}
            <Box padding="200" borderBlockEndWidth="025" borderStyle="solid" borderColor="border">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                width: '100%',
                flexWrap: 'nowrap'
              }}>
                <Box paddingInlineStart="200">
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {filteredClientes.length} {filteredClientes.length === 1 ? 'cliente' : 'clientes'}
                  </Text>
                </Box>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: isSearchActive ? 1 : 'unset' }}>
                  {!isSearchActive ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Combined Button Cluster: Filter + Search */}
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '8px',
                        backgroundColor: 'var(--p-color-bg-surface-secondary)',
                        border: '1px solid var(--p-color-border-subdued)',
                        overflow: 'hidden'
                      }}>
                        {/* Search Activator */}
                        <div 
                          onClick={() => setIsSearchActive(true)}
                          style={{ 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRight: '1px solid var(--p-color-border-subdued)',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--p-color-bg-surface-secondary-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                           <Icon source={SearchIcon} tone="subdued" />
                        </div>
                        
                        {/* Status Filter Activator */}
                        <Popover
                          active={filterActive}
                          activator={
                            <div 
                              onClick={() => setFilterActive(true)}
                              style={{ 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 12px',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--p-color-bg-surface-secondary-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                               <Icon source={DataTableIcon} tone="subdued" />
                            </div>
                          }
                          onClose={() => setFilterActive(false)}
                        >
                          <Popover.Pane>
                            <div style={{ padding: '8px', minWidth: '160px' }}>
                              <BlockStack gap="200">
                                <Box paddingInlineStart="200"><Text as="p" variant="bodySm" fontWeight="bold" tone="subdued">FILTRAR POR</Text></Box>
                                <Button variant={modeFilter === 'all' ? 'secondary' : 'plain'} textAlign="left" onClick={() => { setModeFilter('all'); setFilterActive(false); }}>Todos los clientes</Button>
                                <Button variant={modeFilter === 'debt' ? 'secondary' : 'plain'} textAlign="left" onClick={() => { setModeFilter('debt'); setFilterActive(false); }}>Con deuda activa</Button>
                                <Button variant={modeFilter === 'no_debt' ? 'secondary' : 'plain'} textAlign="left" onClick={() => { setModeFilter('no_debt'); setFilterActive(false); }}>Sin adeudos</Button>
                              </BlockStack>
                            </div>
                          </Popover.Pane>
                        </Popover>
                      </div>
                      
                      {/* Separate Sort Button with Popover Menu */}
                      <Popover
                        active={sortActive}
                        activator={
                          <Button 
                            variant="tertiary" 
                            icon={SortIcon} 
                            onClick={toggleSortActive}
                            accessibilityLabel="Opciones de ordenación"
                          />
                        }
                        onClose={toggleSortActive}
                      >
                        <Popover.Pane>
                          <div style={{ padding: '8px', minWidth: '180px' }}>
                            <BlockStack gap="200">
                              <Box paddingInlineStart="200"><Text as="p" variant="bodySm" fontWeight="bold" tone="subdued">ORDENAR POR</Text></Box>
                              <Button variant={sortBy === 'name' && sortOrder === 'asc' ? 'secondary' : 'plain'} textAlign="left" onClick={() => { setSortBy('name'); setSortOrder('asc'); setSortActive(false); }}>Nombre (A-Z)</Button>
                              <Button variant={sortBy === 'name' && sortOrder === 'desc' ? 'secondary' : 'plain'} textAlign="left" onClick={() => { setSortBy('name'); setSortOrder('desc'); setSortActive(false); }}>Nombre (Z-A)</Button>
                              <Button variant={sortBy === 'spent' ? 'secondary' : 'plain'} textAlign="left" onClick={() => { setSortBy('spent'); setSortOrder('desc'); setSortActive(false); }}>Mayor inversión</Button>
                              <Button variant={sortBy === 'balance' ? 'secondary' : 'plain'} textAlign="left" onClick={() => { setSortBy('balance'); setSortOrder('desc'); setSortActive(false); }}>Saldo deudor</Button>
                            </BlockStack>
                          </div>
                        </Popover.Pane>
                      </Popover>
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      width: '100%', 
                      transition: 'all 0.3s ease-in-out',
                      maxWidth: '1200px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Buscar clientes"
                          labelHidden
                          value={searchQuery}
                          onChange={setSearchQuery}
                          autoComplete="off"
                          placeholder="Buscar por nombre o teléfono..."
                          prefix={<Icon source={SearchIcon} tone="subdued" />}
                          autoFocus
                          clearButton
                          onClearButtonClick={() => setSearchQuery('')}
                        />
                      </div>
                      <Button variant="plain" onClick={() => {
                        setIsSearchActive(false);
                        setSearchQuery('');
                      }}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Box>

            <IndexTable
              resourceName={{ singular: 'cliente', plural: 'clientes' }}
              itemCount={filteredClientes.length}
              selectedResources={selectedResources}
              onSelectionChange={handleSelectionChange}
              selectable
              headings={[
                { title: 'Nombre del cliente' },
                { title: 'Suscripción por email' },
                { title: 'Ubicación' },
                { title: 'Pedidos' },
                { title: 'Importe gastado' },
              ]}
              promotedBulkActions={[
                {
                  content: 'Eliminar seleccionados',
                  onAction: () => {
                    const confirmMsg = `¿Estás seguro de que deseas eliminar ${selectedResources.length} clientes?`;
                    if (window.confirm(confirmMsg)) {
                      selectedResources.forEach(id => deleteCliente(id));
                      clearSelection();
                    }
                  },
                  destructive: true,
                },
              ]}
            >
              {filteredClientes.map((cliente, idx) => {
                const clientTransactions = fiadoTransactions.filter(t => t.clienteId === cliente.id);
                const orderCount = new Set(clientTransactions.map(t => t.saleFolio).filter(Boolean)).size;
                const totalSpent = clientTransactions
                  .filter(t => t.type === 'fiado' && t.saleFolio)
                  .reduce((sum, t) => sum + t.amount, 0);

                return (
                  <IndexTable.Row 
                    id={cliente.id} 
                    key={cliente.id} 
                    position={idx}
                    selected={selectedResources.includes(cliente.id)}
                  >
                    <IndexTable.Cell>
                      <Button variant="plain" onClick={() => setViewingProfile(cliente)}>
                        {cliente.name}
                      </Button>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone="success">Suscrito</Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">México</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">{orderCount} pedidos</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <div style={{ textAlign: 'right', width: '100%' }}>
                         <Text as="span" variant="bodyMd">
                            {formatCurrency(totalSpent).replace('$', '')} $
                         </Text>
                      </div>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          </Card>
        )}
      </BlockStack>


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

      <CustomerExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={(format, scope) => {
          const dataToExport = scope === 'current' ? filteredClientes : clientes;
          const exportData = dataToExport.map(c => ({
            "Nombre Completo": c.name,
            "Teléfono": c.phone || 'N/A',
            "Dirección": c.address || 'N/A',
            "Límite de Crédito": c.creditLimit,
            "Crédito Utilizado": c.balance,
            "Crédito Disponible": Math.max(0, c.creditLimit - c.balance),
            "Puntos": c.points || 0
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
