'use client';

import { useState, useCallback, useMemo } from 'react';
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
  InlineGrid,
  EmptyState,
  Box,
  Divider,
  ProgressBar,
  useIndexResourceState,
} from '@shopify/polaris';
import { PlusIcon, ExportIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';

export function ProveedoresManager() {
  const proveedores = useDashboardStore((s) => s.proveedores);
  const pedidos = useDashboardStore((s) => s.pedidos);
  const addProveedor = useDashboardStore((s) => s.addProveedor);
  const deleteProveedor = useDashboardStore((s) => s.deleteProveedor);
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
  const [searchQuery, setSearchQuery] = useState('');

  const resourceName = {
    singular: 'proveedor',
    plural: 'proveedores',
  };

  // ── KPI computations ──
  const stats = useMemo(() => {
    const total = proveedores.length;
    const activos = proveedores.filter((p) => p.activo).length;
    const inactivos = total - activos;
    const conPedidos = proveedores.filter((p) => p.ultimoPedido).length;
    const sinPedidos = total - conPedidos;
    const pedidosPendientes = pedidos.filter((p) => p.estado === 'pendiente').length;
    return { total, activos, inactivos, conPedidos, sinPedidos, pedidosPendientes };
  }, [proveedores, pedidos]);

  // ── Category distribution ──
  const categoryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    proveedores.forEach((p) => {
      p.categorias.forEach((c) => {
        map[c] = (map[c] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => b.count - a.count);
  }, [proveedores]);

  // ── Filtered proveedores ──
  const filteredProveedores = useMemo(() => {
    if (!searchQuery.trim()) return proveedores;
    const q = searchQuery.toLowerCase();
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.contacto.toLowerCase().includes(q) ||
        p.categorias.some((c) => c.toLowerCase().includes(q)),
    );
  }, [proveedores, searchQuery]);

  const proveedorItems = filteredProveedores.map((p) => ({ ...p }));
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(proveedorItems);

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

  const handleDeleteProveedor = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        const p = proveedores.find((pr) => pr.id === id);
        await deleteProveedor(id);
        showSuccess(`Proveedor "${p?.nombre}" eliminado`);
        setDeleteConfirmId(null);
      } catch {
        showError('Error al eliminar proveedor');
      }
      setDeleting(false);
    },
    [proveedores, deleteProveedor, showSuccess, showError],
  );

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

  const categoryLabels: Record<string, string> = {
    abarrotes: 'Abarrotes',
    lacteos: 'Lácteos',
    panaderia: 'Panadería',
    carnes: 'Carnes y Embutidos',
    frutas: 'Frutas y Verduras',
    bebidas: 'Bebidas',
    limpieza: 'Limpieza',
    varios: 'Varios',
  };

  const categoryTones: Record<string, 'info' | 'success' | 'warning' | 'attention' | 'critical' | 'new'> = {
    abarrotes: 'info',
    lacteos: 'new',
    panaderia: 'warning',
    carnes: 'critical',
    frutas: 'success',
    bebidas: 'attention',
    limpieza: 'info',
    varios: 'new',
  };

  const rowMarkup = filteredProveedores.map((proveedor, index) => (
    <IndexTable.Row
      id={proveedor.id}
      key={proveedor.id}
      selected={selectedResources.includes(proveedor.id)}
      position={index}
    >
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {proveedor.nombre}
          </Text>
          {proveedor.email && (
            <Text variant="bodyXs" tone="subdued" as="span">
              {proveedor.email}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text variant="bodySm" as="span">
            {proveedor.contacto || '—'}
          </Text>
          {proveedor.telefono && (
            <Text variant="bodyXs" tone="subdued" as="span">
              {proveedor.telefono}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100" wrap={false}>
          {proveedor.categorias.map((c) => (
            <Badge key={c} tone={categoryTones[c] || 'info'}>
              {categoryLabels[c] || c}
            </Badge>
          ))}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={proveedor.activo ? 'success' : undefined}>{proveedor.activo ? 'Activo' : 'Inactivo'}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" as="span" tone={proveedor.ultimoPedido ? undefined : 'subdued'}>
          {proveedor.ultimoPedido ? new Date(proveedor.ultimoPedido).toLocaleDateString('es-MX') : 'Sin pedidos'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {deleteConfirmId === proveedor.id ? (
          <InlineStack gap="100">
            <Button
              variant="plain"
              tone="critical"
              onClick={() => handleDeleteProveedor(proveedor.id)}
              loading={deleting}
            >
              Confirmar
            </Button>
            <Button variant="plain" onClick={() => setDeleteConfirmId(null)}>
              No
            </Button>
          </InlineStack>
        ) : (
          <Button variant="plain" tone="critical" onClick={() => setDeleteConfirmId(proveedor.id)}>
            Eliminar
          </Button>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="600">
      {/* ═══ CHAPTER 1: PANORAMA DE PROVEEDORES ═══ */}
      <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" tone="subdued">
              Total Proveedores
            </Text>
            <Text as="p" variant="headingLg" fontWeight="bold">
              {`${stats.total}`}
            </Text>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" tone="subdued">
              Activos
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Text as="p" variant="headingLg" fontWeight="bold" tone="success">
                {`${stats.activos}`}
              </Text>
              {stats.total > 0 && (
                <Badge tone="success">{`${Math.round((stats.activos / stats.total) * 100)}%`}</Badge>
              )}
            </InlineStack>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" tone="subdued">
              Con Pedidos Recientes
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Text as="p" variant="headingLg" fontWeight="bold">
                {`${stats.conPedidos}`}
              </Text>
              {stats.sinPedidos > 0 && (
                <Badge tone="attention">{`${stats.sinPedidos} sin pedidos`}</Badge>
              )}
            </InlineStack>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" tone="subdued">
              Pedidos Pendientes
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Text as="p" variant="headingLg" fontWeight="bold" tone={stats.pedidosPendientes > 0 ? 'caution' : 'success'}>
                {`${stats.pedidosPendientes}`}
              </Text>
              <Badge tone={stats.pedidosPendientes > 0 ? 'warning' : 'success'}>
                {stats.pedidosPendientes > 0 ? 'Por surtir' : 'Al día'}
              </Badge>
            </InlineStack>
          </BlockStack>
        </Card>
      </InlineGrid>

      {/* ═══ CHAPTER 2: DISTRIBUCIÓN POR CATEGORÍA ═══ */}
      {categoryDistribution.length > 0 && (
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Distribución por Categoría
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Cobertura de proveedores por línea de producto
                </Text>
              </BlockStack>
              <Badge>{`${categoryDistribution.length} categorías`}</Badge>
            </InlineStack>
            <Divider />
            <BlockStack gap="400">
              {categoryDistribution.map(({ cat, count }) => {
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <BlockStack key={cat} gap="150">
                    <InlineStack align="space-between" blockAlign="center">
                      <Badge tone={categoryTones[cat] || 'info'}>{categoryLabels[cat] || cat}</Badge>
                      <InlineStack gap="300" blockAlign="center">
                        <Text as="span" variant="bodySm" tone="subdued">
                          {pct.toFixed(0)}%
                        </Text>
                        <Text as="span" variant="bodySm" fontWeight="bold">
                          {`${count} proveedor${count !== 1 ? 'es' : ''}`}
                        </Text>
                      </InlineStack>
                    </InlineStack>
                    <ProgressBar progress={pct} tone="primary" size="small" />
                  </BlockStack>
                );
              })}
            </BlockStack>
          </BlockStack>
        </Card>
      )}

      {/* ═══ CHAPTER 3: DIRECTORIO DE PROVEEDORES ═══ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h3" variant="headingMd" fontWeight="bold">
                Directorio de Proveedores
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Detalle de contacto y estado de cada proveedor
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button icon={ExportIcon} onClick={() => setIsExportOpen(true)} variant="secondary">
                Exportar
              </Button>
              <Button icon={PlusIcon} variant="primary" onClick={() => setModalOpen(true)}>
                Agregar proveedor
              </Button>
            </InlineStack>
          </InlineStack>
          <Divider />
          <Box maxWidth="400px">
            <TextField
              label="Buscar"
              labelHidden
              placeholder="Buscar por nombre, contacto o categoría..."
              value={searchQuery}
              onChange={setSearchQuery}
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setSearchQuery('')}
            />
          </Box>
        </BlockStack>
      </Card>

      {filteredProveedores.length === 0 && proveedores.length === 0 ? (
        <Card>
          <EmptyState heading="Administra tus proveedores" image="">
            <p>Agrega proveedores para llevar un mejor control de tus pedidos y costos.</p>
          </EmptyState>
        </Card>
      ) : filteredProveedores.length === 0 ? (
        <Card>
          <Box padding="800">
            <Text as="p" tone="subdued" alignment="center">
              Sin resultados para &ldquo;{searchQuery}&rdquo;
            </Text>
          </Box>
        </Card>
      ) : (
        <Card padding="0">
          <IndexTable
            resourceName={resourceName}
            itemCount={filteredProveedores.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Proveedor' },
              { title: 'Contacto' },
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
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Nuevo proveedor"
        primaryAction={{
          content: 'Guardar',
          onAction: handleSave,
          disabled: !nombre.trim(),
        }}
        secondaryActions={[
          {
            content: 'Cancelar',
            onAction: () => {
              setModalOpen(false);
              resetForm();
            },
          },
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
              <TextField label="Persona de contacto" value={contacto} onChange={setContacto} autoComplete="off" />
              <TextField label="Teléfono" value={telefono} onChange={setTelefono} autoComplete="tel" />
            </FormLayout.Group>
            <TextField label="Correo electrónico" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <TextField label="Dirección" value={direccion} onChange={setDireccion} autoComplete="off" multiline={2} />
            <Select label="Categoría principal" options={categoryOptions} value={categoria} onChange={setCategoria} />
            <TextField label="Notas" value={notas} onChange={setNotas} autoComplete="off" multiline={3} />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar proveedores"
        exportName="proveedores"
        onExport={(format) => {
          const exportData = proveedores.map((p) => ({
            'Empresa / Nombre': p.nombre,
            Contacto: p.contacto || 'N/A',
            Teléfono: p.telefono || 'N/A',
            Email: p.email || 'N/A',
            'Categoría Principal': p.categorias.join(', '),
            'Último Pedido': p.ultimoPedido ? new Date(p.ultimoPedido).toLocaleDateString('es-MX') : 'N/A',
            Activo: p.activo ? 'Sí' : 'No',
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
    </BlockStack>
  );
}
