'use client';

import { useState, useCallback, useMemo } from 'react';
import { useForm, useField } from '@shopify/react-form';
import { useI18n } from '@shopify/react-i18n';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Modal,
  FormLayout,
  Box,
  Divider,
  Checkbox,
  Banner,
} from '@shopify/polaris';
import { PlusIcon, ExportIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyStateCard } from '@/components/ui/EmptyStateCard';
import { DeleteConfirmation } from '@/components/ui/DeleteConfirmation';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';
import type { GastoCategoria } from '@/types';

const categoriaOptions: { label: string; value: GastoCategoria | '' }[] = [
  { label: 'Todas las categorías', value: '' },
  { label: '🏠 Renta', value: 'renta' },
  { label: 'Servicios (luz, agua, gas)', value: 'servicios' },
  { label: 'Proveedores', value: 'proveedores' },
  { label: '👷 Salarios', value: 'salarios' },
  { label: '🔧 Mantenimiento', value: 'mantenimiento' },
  { label: 'Impuestos', value: 'impuestos' },
  { label: '📌 Otro', value: 'otro' },
];

const categoriaFormOptions = categoriaOptions.filter((o) => o.value !== '');

const categoriaBadge: Record<GastoCategoria, { tone: 'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new'; label: string }> = {
  renta: { tone: 'info', label: '🏠 Renta' },
  servicios: { tone: 'attention', label: 'Servicios' },
  proveedores: { tone: 'success', label: 'Proveedores' },
  salarios: { tone: 'warning', label: '👷 Salarios' },
  mantenimiento: { tone: 'info', label: '🔧 Mantenimiento' },
  impuestos: { tone: 'critical', label: 'Impuestos' },
  otro: { tone: 'new', label: '📌 Otro' },
};

export function GastosManager() {
  const gastos = useDashboardStore((s) => s.gastos);
  const registerGasto = useDashboardStore((s) => s.registerGasto);
  const updateGasto = useDashboardStore((s) => s.updateGasto);
  const deleteGasto = useDashboardStore((s) => s.deleteGasto);
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const { showSuccess, showError } = useToast();
  const [i18n] = useI18n();

  const [addOpen, setAddOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // ── Form State (Add Gasto) ──
  const {
    fields: addFields,
    reset: resetAddForm,
    validate: validateAdd,
    submitting: addSubmitting,
    submit: submitAdd,
  } = useForm({
    fields: {
      concepto: useField({ value: '', validates: [(v) => (v.trim() ? undefined : 'Ingresa el concepto')] }),
      categoria: useField<GastoCategoria | ''>({ value: '', validates: [(v) => (v ? undefined : 'Selecciona una categoría')] }),
      monto: useField({ value: '', validates: [(v) => (v && parseFloat(v) > 0 ? undefined : 'Ingresa un monto válido')] }),
      fecha: useField(new Date().toISOString().split('T')[0]),
      notas: useField(''),
      comprobante: useField(false),
    },
    onSubmit: async (f) => {
      await registerGasto({
        concepto: f.concepto.trim(),
        categoria: f.categoria as GastoCategoria,
        monto: parseFloat(f.monto),
        fecha: f.fecha,
        notas: f.notas,
        comprobante: f.comprobante,
      });
      showSuccess(`Gasto "${f.concepto}" registrado`);
      setAddOpen(false);
      resetAddForm();
      return { status: 'success' };
    },
  });

  // ── Form State (Edit Gasto) ──
  const [editId, setEditId] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const {
    fields: editFields,
    reset: resetEditForm,
    validate: validateEdit,
    submitting: editSubmitting,
    makeClean: makeEditClean,
    submit: submitEdit,
  } = useForm({
    fields: {
      concepto: useField({ value: '', validates: [(v) => (v.trim() ? undefined : 'Ingresa el concepto')] }),
      categoria: useField<GastoCategoria | ''>({ value: '', validates: [(v) => (v ? undefined : 'Selecciona una categoría')] }),
      monto: useField({ value: '', validates: [(v) => (v && parseFloat(v) > 0 ? undefined : 'Ingresa un monto válido')] }),
      fecha: useField(''),
      notas: useField(''),
      comprobante: useField(false),
    },
    onSubmit: async (f) => {
      await updateGasto(editId, {
        concepto: f.concepto.trim(),
        categoria: f.categoria as GastoCategoria,
        monto: parseFloat(f.monto),
        fecha: f.fecha,
        notas: f.notas,
        comprobante: f.comprobante,
      });
      showSuccess('Gasto actualizado');
      setEditOpen(false);
      return { status: 'success' };
    },
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredGastos = useMemo(() => {
    return gastos
      .filter((g) => {
        if (filterCategoria && g.categoria !== filterCategoria) return false;
        if (filterMonth && !g.fecha.startsWith(filterMonth)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [gastos, filterCategoria, filterMonth]);

  const totalGastos = useMemo(() => filteredGastos.reduce((sum, g) => sum + g.monto, 0), [filteredGastos]);
  const totalVentas = useMemo(() => {
    if (filterMonth) {
      return saleRecords.filter((s) => s.date.startsWith(filterMonth)).reduce((sum, s) => sum + s.total, 0);
    }
    return saleRecords.reduce((sum, s) => sum + s.total, 0);
  }, [saleRecords, filterMonth]);

  const gananciaEstimada = totalVentas - totalGastos;

  // Summary by category
  const gastosByCategory = useMemo(() => {
    const map: Partial<Record<GastoCategoria, number>> = {};
    filteredGastos.forEach((g) => {
      map[g.categoria] = (map[g.categoria] || 0) + g.monto;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => (b as number) - (a as number)) as [GastoCategoria, number][];
  }, [filteredGastos]);

  const handleStartEdit = useCallback((g: (typeof gastos)[0]) => {
    setEditId(g.id);
    editFields.concepto.onChange(g.concepto);
    editFields.categoria.onChange(g.categoria);
    editFields.monto.onChange(String(g.monto));
    editFields.fecha.onChange(g.fecha);
    editFields.notas.onChange(g.notas || '');
    editFields.comprobante.onChange(g.comprobante);
    makeEditClean();
    setEditOpen(true);
  }, [editFields, makeEditClean]);

  // edit logic moved to useForm onSubmit

  const handleDeleteGasto = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      await deleteGasto(id);
      showSuccess('Gasto eliminado');
      setDeleteConfirmId(null);
    } catch { showError('Error al eliminar'); }
    setDeleting(false);
  }, [deleteGasto, showSuccess, showError]);

  // Month options for filter
  const monthOptions = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    return [
      { label: 'Todos los meses', value: '' },
      ...months.map((m) => {
        const d = new Date(m + '-01');
        return { label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }), value: m };
      }),
    ];
  }, []);

  return (
    <>
      <BlockStack gap="400">
        {/* Summary Cards */}
        <InlineStack gap="400" align="start">
          <Box minWidth="200px">
            <StatCard label="Total Gastos" value={totalGastos} format="currency" tone="critical" />
          </Box>
          <Box minWidth="200px">
            <StatCard label="Total Ventas" value={totalVentas} format="currency" />
          </Box>
          <Box minWidth="200px">
            <StatCard label="Ganancia Estimada" value={gananciaEstimada} format="currency" tone={gananciaEstimada >= 0 ? 'success' : 'critical'} />
          </Box>
        </InlineStack>

        {/* Category breakdown */}
        {gastosByCategory.length > 0 && (
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Gastos por Categoría</Text>
              {gastosByCategory.map(([cat, amount]) => (
                <InlineStack key={cat} align="space-between">
                  <Badge tone={categoriaBadge[cat].tone}>{categoriaBadge[cat].label}</Badge>
                  <Text as="span" fontWeight="semibold">{formatCurrency(amount)}</Text>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>
        )}

        {/* Filters + Actions */}
        <Card>
          <BlockStack gap="300">
            <SectionHeader
              title="Registro de Gastos"
              primaryAction={{ content: 'Nuevo Gasto', icon: PlusIcon, onAction: () => setAddOpen(true) }}
              secondaryActions={[{ content: 'Exportar', icon: ExportIcon, onAction: () => setIsExportOpen(true) }]}
            />

            <InlineStack gap="200" align="start" blockAlign="end">
              <Box minWidth="200px">
                <Select
                  label="Categoría"
                  options={categoriaOptions as { label: string; value: string }[]}
                  value={filterCategoria}
                  onChange={setFilterCategoria}
                />
              </Box>
              <Box minWidth="200px">
                <Select
                  label="Mes"
                  options={monthOptions}
                  value={filterMonth}
                  onChange={setFilterMonth}
                />
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Gastos list */}
        {filteredGastos.length === 0 ? (
          <EmptyStateCard heading="Sin gastos registrados" description="Agrega tus gastos para llevar control de tus finanzas." />
        ) : (
          <Card>
            <IndexTable
              resourceName={{ singular: 'gasto', plural: 'gastos' }}
              itemCount={filteredGastos.length}
              headings={[
                { title: 'Fecha' },
                { title: 'Concepto' },
                { title: 'Categoría' },
                { title: 'Monto' },
                { title: 'Comprobante' },
                { title: 'Acciones' },
              ]}
              selectable={false}
            >
              {filteredGastos.map((gasto, idx) => (
                <IndexTable.Row id={gasto.id} key={gasto.id} position={idx}>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodySm">{new Date(gasto.fecha).toLocaleDateString('es-MX')}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">{gasto.concepto}</Text>
                      {gasto.notas && <Text as="span" variant="bodySm" tone="subdued">{gasto.notas}</Text>}
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={categoriaBadge[gasto.categoria].tone}>{categoriaBadge[gasto.categoria].label}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" fontWeight="bold" tone="critical">{formatCurrency(gasto.monto)}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={gasto.comprobante ? 'success' : 'attention'}>
                      {gasto.comprobante ? 'Sí' : 'No'}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="100">
                      <Button variant="plain" onClick={() => handleStartEdit(gasto)}>Editar</Button>
                      <DeleteConfirmation
                        isConfirming={deleteConfirmId === gasto.id}
                        isDeleting={deleting}
                        onConfirm={() => handleDeleteGasto(gasto.id)}
                        onCancel={() => setDeleteConfirmId(deleteConfirmId === gasto.id ? null : gasto.id)}
                      />
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        )}
      </BlockStack>

      {/* Modal: Nuevo Gasto */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Registrar Gasto"
        primaryAction={{ content: 'Guardar Gasto', onAction: () => {
          if (validateAdd().length === 0) submitAdd();
        }, loading: addSubmitting }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setAddOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Concepto"
              value={addFields.concepto.value}
              onChange={addFields.concepto.onChange}
              error={addFields.concepto.error}
              autoComplete="off"
            />
            <Select
              label="Categoría"
              options={[{ label: 'Seleccionar...', value: '' }, ...categoriaFormOptions] as { label: string; value: string }[]}
              value={addFields.categoria.value}
              onChange={(v) => addFields.categoria.onChange(v as GastoCategoria)}
              error={addFields.categoria.error}
            />
            <TextField
              label="Monto (MXN)"
              type="number"
              value={addFields.monto.value}
              onChange={addFields.monto.onChange}
              error={addFields.monto.error}
              autoComplete="off"
              prefix="$"
            />
            <TextField
              label="Fecha"
              type="date"
              value={addFields.fecha.value}
              onChange={addFields.fecha.onChange}
              autoComplete="off"
            />
            <TextField
              label="Notas (opcional)"
              value={addFields.notas.value}
              onChange={addFields.notas.onChange}
              autoComplete="off"
              multiline={2}
            />
            <Checkbox
              label="¿Tiene comprobante/factura?"
              checked={addFields.comprobante.value}
              onChange={addFields.comprobante.onChange}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal: Editar Gasto */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar Gasto"
        primaryAction={{ content: 'Guardar Cambios', onAction: () => {
          if (validateEdit().length === 0) submitEdit();
        }, loading: editSubmitting }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setEditOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Concepto" value={editFields.concepto.value} onChange={editFields.concepto.onChange} error={editFields.concepto.error} autoComplete="off" />
            <Select
              label="Categoría"
              options={[{ label: 'Seleccionar...', value: '' }, ...categoriaFormOptions] as { label: string; value: string }[]}
              value={editFields.categoria.value}
              onChange={(v) => editFields.categoria.onChange(v as GastoCategoria)}
              error={editFields.categoria.error}
            />
            <TextField label="Monto (MXN)" type="number" value={editFields.monto.value} onChange={editFields.monto.onChange} error={editFields.monto.error} autoComplete="off" prefix="$" />
            <TextField label="Fecha" type="date" value={editFields.fecha.value} onChange={editFields.fecha.onChange} autoComplete="off" />
            <TextField label="Notas (opcional)" value={editFields.notas.value} onChange={editFields.notas.onChange} autoComplete="off" multiline={2} />
            <Checkbox label="¿Tiene comprobante/factura?" checked={editFields.comprobante.value} onChange={editFields.comprobante.onChange} />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar gastos"
        exportName="gastos"
        onExport={(format) => {
          const exportData = filteredGastos.map(g => ({
            "Fecha": i18n.formatDate(new Date(g.fecha)),
            "Concepto": g.concepto,
            "Categoría": categoriaBadge[g.categoria]?.label || g.categoria,
            "Monto": i18n.formatCurrency(g.monto, { currency: 'MXN' }),
            "Notas": g.notas || 'N/A',
            "Comprobante": g.comprobante ? 'Sí' : 'No'
          }));
          const filename = `Gastos_Kiosco_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Gastos', exportData as Record<string, unknown>[], `${filename}.pdf`);
          } else {
            const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
            const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
            downloadFile(csvContent, `${filename}.csv`, mime);
          }
        }}
      />
    </>
  );
}
