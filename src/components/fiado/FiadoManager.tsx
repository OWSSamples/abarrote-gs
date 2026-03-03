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
} from '@shopify/polaris';
import { PlusIcon, CashDollarIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import type { Cliente, FiadoTransaction } from '@/types';

export function FiadoManager() {
  const { clientes, fiadoTransactions, addCliente, registerFiado, registerAbono, updateCliente, deleteCliente } = useDashboardStore();
  const { showSuccess, showError } = useToast();

  const [addClienteOpen, setAddClienteOpen] = useState(false);
  const [fiadoOpen, setFiadoOpen] = useState(false);
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

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

  const handleViewHistory = useCallback((cliente: Cliente) => {
    setSelectedCliente(cliente);
    setHistoryOpen(true);
  }, []);

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

  const clienteTransactions = useMemo(() => {
    if (!selectedCliente) return [];
    return fiadoTransactions
      .filter((t) => t.clienteId === selectedCliente.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCliente, fiadoTransactions]);

  return (
    <>
      <BlockStack gap="400">
        {/* Summary */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">Fiado / Crédito a Clientes</Text>
              <Badge tone={totalDebt > 0 ? 'attention' : 'success'}>{`Deuda total: ${formatCurrency(totalDebt)}`}</Badge>
            </InlineStack>

            <InlineStack gap="200">
              <Button icon={PlusIcon} onClick={() => setAddClienteOpen(true)}>
                Nuevo Cliente
              </Button>
              <Button variant="primary" tone="critical" onClick={() => setFiadoOpen(true)} disabled={clientes.length === 0}>
                Registrar Fiado
              </Button>
              <Button variant="primary" onClick={() => setAbonoOpen(true)} disabled={clientesWithDebt.length === 0}>
                Registrar Abono
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Clients list */}
        {clientes.length === 0 ? (
          <Card>
            <EmptyState heading="Sin clientes registrados" image="">
              <p>Agrega un cliente para empezar a manejar fiados y créditos.</p>
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <IndexTable
              resourceName={{ singular: 'cliente', plural: 'clientes' }}
              itemCount={clientes.length}
              headings={[
                { title: 'Cliente' },
                { title: 'Teléfono' },
                { title: 'Saldo / Límite' },
                { title: 'Uso crédito' },
                { title: 'Última transacción' },
                { title: '' },
              ]}
              selectable={false}
            >
              {clientes.map((cliente, idx) => {
                const usagePct = cliente.creditLimit > 0 ? Math.min(100, (cliente.balance / cliente.creditLimit) * 100) : 0;
                return (
                  <IndexTable.Row id={cliente.id} key={cliente.id} position={idx}>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" fontWeight="bold">{cliente.name}</Text>
                        {cliente.address && <Text as="span" variant="bodySm" tone="subdued">{cliente.address}</Text>}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodySm">{cliente.phone || '—'}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" fontWeight="semibold" tone={cliente.balance > 0 ? 'critical' : 'success'}>
                          {formatCurrency(cliente.balance)}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          Límite: {formatCurrency(cliente.creditLimit)}
                        </Text>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Box minWidth="100px">
                        <ProgressBar
                          progress={usagePct}
                          tone={usagePct > 80 ? 'critical' : usagePct > 50 ? 'highlight' : 'success'}
                          size="small"
                        />
                        <Text as="span" variant="bodySm" tone="subdued">{usagePct.toFixed(0)}%</Text>
                      </Box>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {cliente.lastTransaction ? new Date(cliente.lastTransaction).toLocaleDateString('es-MX') : 'Sin movimientos'}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="100">
                        <Button variant="plain" onClick={() => handleViewHistory(cliente)}>Historial</Button>
                        <Button variant="plain" onClick={() => handleStartEditCliente(cliente)}>Editar</Button>
                        {deleteConfirmId === cliente.id ? (
                          <InlineStack gap="100">
                            <Button variant="plain" tone="critical" onClick={() => handleDeleteCliente(cliente.id)} loading={deleting}>Sí</Button>
                            <Button variant="plain" onClick={() => setDeleteConfirmId(null)}>No</Button>
                          </InlineStack>
                        ) : (
                          <Button variant="plain" tone="critical" onClick={() => setDeleteConfirmId(cliente.id)}>Eliminar</Button>
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

      {/* Modal: Historial de cliente */}
      {selectedCliente && (
        <Modal
          open={historyOpen}
          onClose={() => { setHistoryOpen(false); setSelectedCliente(null); }}
          title={`Historial — ${selectedCliente.name}`}
          secondaryActions={[{ content: 'Cerrar', onAction: () => { setHistoryOpen(false); setSelectedCliente(null); } }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="span">Deuda actual:</Text>
                <Badge tone={selectedCliente.balance > 0 ? 'critical' : 'success'}>
                  {formatCurrency(selectedCliente.balance)}
                </Badge>
              </InlineStack>
              <Divider />
              {clienteTransactions.length === 0 ? (
                <Text as="p" tone="subdued">Sin movimientos registrados.</Text>
              ) : (
                clienteTransactions.map((t) => (
                  <BlockStack key={t.id} gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <InlineStack gap="100">
                          <Badge tone={t.type === 'fiado' ? 'critical' : 'success'}>
                            {t.type === 'fiado' ? 'Fiado' : 'Abono'}
                          </Badge>
                          <Text as="span" variant="bodySm">{t.description}</Text>
                        </InlineStack>
                        {t.saleFolio && (
                          <Text as="span" variant="bodySm" tone="subdued">
                            Folio: {t.saleFolio}
                          </Text>
                        )}
                        <Text as="span" variant="bodySm" tone="subdued">
                          {new Date(t.date).toLocaleString('es-MX')}
                        </Text>
                      </BlockStack>
                      <Text as="span" fontWeight="bold" tone={t.type === 'fiado' ? 'critical' : 'success'}>
                        {t.type === 'fiado' ? '+' : '-'}{formatCurrency(t.amount)}
                      </Text>
                    </InlineStack>
                    {/* Show itemized products for fiado transactions */}
                    {t.type === 'fiado' && t.items && t.items.length > 0 && (
                      <Box paddingInlineStart="400">
                        <Card>
                          <BlockStack gap="100">
                            <Text as="p" variant="bodySm" fontWeight="semibold">Productos fiados:</Text>
                            {t.items.map((item, idx) => (
                              <InlineStack key={idx} align="space-between">
                                <Text as="span" variant="bodySm">
                                  {item.productName} x{item.quantity}
                                </Text>
                                <Text as="span" variant="bodySm" tone="subdued">
                                  {formatCurrency(item.subtotal)}
                                </Text>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </Card>
                      </Box>
                    )}
                    <Divider />
                  </BlockStack>
                ))
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

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
    </>
  );
}
