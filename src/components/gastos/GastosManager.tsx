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
  Select,
  Button,
  Modal,
  FormLayout,
  EmptyState,
  Box,
  Divider,
  Checkbox,
  Banner,
} from '@shopify/polaris';
import { PlusIcon, ExportIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';
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
  const { storeConfig, gastos, registerGasto, updateGasto, deleteGasto, saleRecords } = useDashboardStore();
  const { showSuccess, showError } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Form state
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState<GastoCategoria | ''>('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notasGasto, setNotasGasto] = useState('');
  const [comprobante, setComprobante] = useState(false);

  // Edit gasto state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editConcepto, setEditConcepto] = useState('');
  const [editCategoria, setEditCategoria] = useState<GastoCategoria | ''>('');
  const [editMonto, setEditMonto] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editComprobante, setEditComprobante] = useState(false);
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

  const handleSubmit = useCallback(async () => {
    if (!concepto.trim()) { showError('Ingresa el concepto'); return; }
    if (!categoria) { showError('Selecciona una categoría'); return; }
    if (!monto || parseFloat(monto) <= 0) { showError('Ingresa un monto válido'); return; }

    await registerGasto({
      concepto: concepto.trim(),
      categoria: categoria as GastoCategoria,
      monto: parseFloat(monto),
      fecha,
      notas: notasGasto,
      comprobante,
    });

    showSuccess(`Gasto "${concepto}" por ${formatCurrency(parseFloat(monto))} registrado`);
    setConcepto(''); setCategoria(''); setMonto(''); setNotasGasto(''); setComprobante(false);
    setFecha(new Date().toISOString().split('T')[0]);
    setAddOpen(false);
  }, [concepto, categoria, monto, fecha, notasGasto, comprobante, registerGasto, showSuccess, showError]);

  const handleStartEdit = useCallback((gasto: typeof gastos[0]) => {
    setEditId(gasto.id);
    setEditConcepto(gasto.concepto);
    setEditCategoria(gasto.categoria);
    setEditMonto(String(gasto.monto));
    setEditFecha(gasto.fecha);
    setEditNotas(gasto.notas || '');
    setEditComprobante(gasto.comprobante);
    setEditOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editConcepto.trim()) { showError('Ingresa el concepto'); return; }
    if (!editCategoria) { showError('Selecciona una categoría'); return; }
    if (!editMonto || parseFloat(editMonto) <= 0) { showError('Ingresa un monto válido'); return; }
    try {
      await updateGasto(editId, {
        concepto: editConcepto.trim(),
        categoria: editCategoria as GastoCategoria,
        monto: parseFloat(editMonto),
        fecha: editFecha,
        notas: editNotas,
        comprobante: editComprobante,
      });
      showSuccess('Gasto actualizado');
      setEditOpen(false);
    } catch { showError('Error al actualizar gasto'); }
  }, [editId, editConcepto, editCategoria, editMonto, editFecha, editNotas, editComprobante, updateGasto, showSuccess, showError]);

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
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Total Gastos</Text>
                <Text as="p" variant="headingLg" fontWeight="bold" tone="critical">{formatCurrency(totalGastos)}</Text>
              </BlockStack>
            </Card>
          </Box>
          <Box minWidth="200px">
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Total Ventas</Text>
                <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(totalVentas)}</Text>
              </BlockStack>
            </Card>
          </Box>
          <Box minWidth="200px">
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Ganancia Estimada</Text>
                <Text as="p" variant="headingLg" fontWeight="bold" tone={gananciaEstimada >= 0 ? 'success' : 'critical'}>
                  {formatCurrency(gananciaEstimada)}
                </Text>
              </BlockStack>
            </Card>
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
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">Registro de Gastos</Text>
              <InlineStack gap="200">
                <Button icon={ExportIcon} onClick={() => setIsExportOpen(true)}>
                  Exportar
                </Button>
                <Button icon={PlusIcon} variant="primary" onClick={() => setAddOpen(true)}>
                  Nuevo Gasto
                </Button>
              </InlineStack>
            </InlineStack>

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
          <Card>
            <EmptyState heading="Sin gastos registrados" image="">
              <p>Agrega tus gastos para llevar control de tus finanzas.</p>
            </EmptyState>
          </Card>
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
                      {deleteConfirmId === gasto.id ? (
                        <InlineStack gap="100">
                          <Button variant="plain" tone="critical" onClick={() => handleDeleteGasto(gasto.id)} loading={deleting}>Confirmar</Button>
                          <Button variant="plain" onClick={() => setDeleteConfirmId(null)}>No</Button>
                        </InlineStack>
                      ) : (
                        <Button variant="plain" tone="critical" onClick={() => setDeleteConfirmId(gasto.id)}>Eliminar</Button>
                      )}
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
        primaryAction={{ content: 'Guardar Gasto', onAction: handleSubmit, disabled: !concepto.trim() || !categoria || !monto }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setAddOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Concepto"
              value={concepto}
              onChange={setConcepto}
              autoComplete="off"
              placeholder="Ej: Pago de luz bimestral"
            />
            <Select
              label="Categoría"
              options={[{ label: 'Seleccionar...', value: '' }, ...categoriaFormOptions] as { label: string; value: string }[]}
              value={categoria}
              onChange={(v) => setCategoria(v as GastoCategoria)}
            />
            <TextField
              label="Monto (MXN)"
              type="number"
              value={monto}
              onChange={setMonto}
              autoComplete="off"
              prefix="$"
              placeholder="0.00"
            />
            <TextField
              label="Fecha"
              type="date"
              value={fecha}
              onChange={setFecha}
              autoComplete="off"
            />
            <TextField
              label="Notas (opcional)"
              value={notasGasto}
              onChange={setNotasGasto}
              autoComplete="off"
              multiline={2}
              placeholder="Detalles adicionales..."
            />
            <Checkbox
              label="¿Tiene comprobante/factura?"
              checked={comprobante}
              onChange={setComprobante}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal: Editar Gasto */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar Gasto"
        primaryAction={{ content: 'Guardar Cambios', onAction: handleSaveEdit, disabled: !editConcepto.trim() || !editCategoria || !editMonto }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setEditOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Concepto" value={editConcepto} onChange={setEditConcepto} autoComplete="off" />
            <Select
              label="Categoría"
              options={[{ label: 'Seleccionar...', value: '' }, ...categoriaFormOptions] as { label: string; value: string }[]}
              value={editCategoria}
              onChange={(v) => setEditCategoria(v as GastoCategoria)}
            />
            <TextField label="Monto (MXN)" type="number" value={editMonto} onChange={setEditMonto} autoComplete="off" prefix="$" />
            <TextField label="Fecha" type="date" value={editFecha} onChange={setEditFecha} autoComplete="off" />
            <TextField label="Notas (opcional)" value={editNotas} onChange={setEditNotas} autoComplete="off" multiline={2} />
            <Checkbox label="¿Tiene comprobante/factura?" checked={editComprobante} onChange={setEditComprobante} />
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
            "Fecha": new Date(g.fecha).toLocaleDateString('es-MX'),
            "Concepto": g.concepto,
            "Categoría": categoriaBadge[g.categoria]?.label || g.categoria,
            "Monto": g.monto,
            "Notas": g.notas || 'N/A',
            "Comprobante": g.comprobante ? 'Sí' : 'No'
          }));
          const filename = `Gastos_Kiosco_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Gastos', exportData as Record<string, unknown>[], `${filename}.pdf`, storeConfig);
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
