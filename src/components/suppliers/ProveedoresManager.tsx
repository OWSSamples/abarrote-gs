'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  Modal,
  FormLayout,
  TextField,
  Select,
  BlockStack,
  InlineStack,
  EmptyState,
  useIndexResourceState,
} from '@shopify/polaris';
import { ExportIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';

export function ProveedoresManager() {
  const { proveedores, addProveedor, deleteProveedor } = useDashboardStore();
  const { showSuccess, showError } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [categoria, setCategoria] = useState('abarrotes');
  const [notas, setNotas] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resourceName = {
    singular: 'proveedor',
    plural: 'proveedores',
  };

  const proveedorItems = proveedores.map(p => ({ ...p }));
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(proveedorItems);

  const resetForm = useCallback(() => {
    setNombre('');
    setContacto('');
    setTelefono('');
    setEmail('');
    setDireccion('');
    setCategoria('abarrotes');
    setNotas('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!nombre.trim()) return;
    await addProveedor({
      nombre: nombre.trim(),
      contacto: contacto.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      direccion: direccion.trim(),
      categorias: [categoria],
      notas: notas.trim(),
      activo: true,
    });
    resetForm();
    setModalOpen(false);
  }, [nombre, contacto, telefono, email, direccion, categoria, notas, addProveedor, resetForm]);

  const handleDeleteProveedor = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const p = proveedores.find(pr => pr.id === id);
      await deleteProveedor(id);
      showSuccess(`Proveedor "${p?.nombre}" eliminado`);
      setDeleteConfirmId(null);
    } catch { showError('Error al eliminar proveedor'); }
    setDeleting(false);
  }, [proveedores, deleteProveedor, showSuccess, showError]);

  const categoryOptions = [
    { label: 'Abarrotes', value: 'abarrotes' },
    { label: 'Lácteos', value: 'lacteos' },
    { label: 'Panadería', value: 'panaderia' },
    { label: 'Carnes y Embutidos', value: 'carnes' },
    { label: 'Frutas y Verduras', value: 'frutas' },
    { label: 'Bebidas', value: 'bebidas' },
    { label: 'Limpieza', value: 'limpieza' },
    { label: 'Varios', value: 'varios' },
  ];

  const rowMarkup = proveedores.map((proveedor, index) => (
    <IndexTable.Row
      id={proveedor.id}
      key={proveedor.id}
      selected={selectedResources.includes(proveedor.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {proveedor.nombre}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{proveedor.contacto}</IndexTable.Cell>
      <IndexTable.Cell>{proveedor.telefono}</IndexTable.Cell>
      <IndexTable.Cell>{proveedor.categorias.join(', ')}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={proveedor.activo ? 'success' : undefined}>
          {proveedor.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {proveedor.ultimoPedido
          ? new Date(proveedor.ultimoPedido).toLocaleDateString('es-MX')
          : 'Sin pedidos'}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {deleteConfirmId === proveedor.id ? (
          <InlineStack gap="100">
            <Button variant="plain" tone="critical" onClick={() => handleDeleteProveedor(proveedor.id)} loading={deleting}>Confirmar</Button>
            <Button variant="plain" onClick={() => setDeleteConfirmId(null)}>No</Button>
          </InlineStack>
        ) : (
          <Button variant="plain" tone="critical" onClick={() => setDeleteConfirmId(proveedor.id)}>Eliminar</Button>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      <InlineStack align="end" gap="200">
        <Button icon={ExportIcon} onClick={() => setIsExportOpen(true)}>Exportar</Button>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Agregar proveedor
        </Button>
      </InlineStack>

      {proveedores.length === 0 ? (
        <Card>
          <EmptyState
            heading="Administra tus proveedores"
            image=""
          >
            <p>Agrega proveedores para llevar un mejor control de tus pedidos y costos.</p>
          </EmptyState>
        </Card>
      ) : (
        <Card padding="0">
          <IndexTable
            resourceName={resourceName}
            itemCount={proveedores.length}
            selectedItemsCount={
              allResourcesSelected ? 'All' : selectedResources.length
            }
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Nombre' },
              { title: 'Contacto' },
              { title: 'Teléfono' },
              { title: 'Categoría' },
              { title: 'Estado' },
              { title: 'Último pedido' },
              { title: 'Acciones' },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="Nuevo proveedor"
        primaryAction={{
          content: 'Guardar',
          onAction: handleSave,
          disabled: !nombre.trim(),
        }}
        secondaryActions={[
          { content: 'Cancelar', onAction: () => { setModalOpen(false); resetForm(); } },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Nombre de la empresa"
              value={nombre}
              onChange={setNombre}
              autoComplete="off"
              requiredIndicator
            />
            <FormLayout.Group>
              <TextField
                label="Persona de contacto"
                value={contacto}
                onChange={setContacto}
                autoComplete="off"
              />
              <TextField
                label="Teléfono"
                value={telefono}
                onChange={setTelefono}
                autoComplete="tel"
              />
            </FormLayout.Group>
            <TextField
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <TextField
              label="Dirección"
              value={direccion}
              onChange={setDireccion}
              autoComplete="off"
              multiline={2}
            />
            <Select
              label="Categoría principal"
              options={categoryOptions}
              value={categoria}
              onChange={setCategoria}
            />
            <TextField
              label="Notas"
              value={notas}
              onChange={setNotas}
              autoComplete="off"
              multiline={3}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar proveedores"
        exportName="proveedores"
        onExport={(format) => {
          const exportData = proveedores.map(p => ({
            "Empresa / Nombre": p.nombre,
            "Contacto": p.contacto || 'N/A',
            "Teléfono": p.telefono || 'N/A',
            "Email": p.email || 'N/A',
            "Categoría Principal": p.categorias.join(', '),
            "Último Pedido": p.ultimoPedido ? new Date(p.ultimoPedido).toLocaleDateString('es-MX') : 'N/A',
            "Activo": p.activo ? 'Sí' : 'No'
          }));
          const filename = `Proveedores_Kiosco_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Proveedores', exportData as Record<string, unknown>[], `${filename}.pdf`);
          } else {
            const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
            const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
            downloadFile(csvContent, `${filename}.csv`, mime);
          }
        }}
      />
    </BlockStack >
  );
}
