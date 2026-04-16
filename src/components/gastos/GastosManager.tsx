'use client';

import { useState, useCallback, useMemo } from 'react';
import { useForm, useField, type SubmitResult } from '@shopify/react-form';
import { useI18n } from '@shopify/react-i18n';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  InlineGrid,
  TextField,
  Select,
  Button,
  Modal,
  Box,
  Checkbox,
  Banner,
  DropZone,
  Divider,
  ProgressBar,
  Popover,
  DatePicker,
  Icon,
  OptionList,
} from '@shopify/polaris';
import { PlusIcon, ExportIcon, CalendarIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
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

const categoriaBadge: Record<
  GastoCategoria,
  { tone: 'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new'; label: string }
> = {
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
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [uploadedComprobanteUrl, setUploadedComprobanteUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<Array<{ nombre: string; cantidad: number; precioUnitario: number }>>([]);

  // ── DatePicker state (Add / Edit modals) ──
  const [addDatePickerOpen, setAddDatePickerOpen] = useState(false);
  const [addMonthYear, setAddMonthYear] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [editDatePickerOpen, setEditDatePickerOpen] = useState(false);
  const [editMonthYear, setEditMonthYear] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });

  // ── Category Popover state ──
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);

  const uploadComprobante = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', `receipts/gasto-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Error al subir comprobante');
    const data = await res.json();
    return data.url;
  };
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
      categoria: useField<GastoCategoria | ''>({
        value: '',
        validates: [(v) => (v ? undefined : 'Selecciona una categoría')],
      }),
      monto: useField({
        value: '',
        validates: [(v) => (v && parseFloat(v) > 0 ? undefined : 'Ingresa un monto válido')],
      }),
      fecha: useField(new Date().toISOString().split('T')[0]),
      notas: useField(''),
      comprobante: useField(false),
    },
    onSubmit: async (f): Promise<SubmitResult> => {
      setIsUploading(true);
      try {
        let url = uploadedComprobanteUrl;
        if (f.comprobante && comprobanteFile && !url) {
          url = await uploadComprobante(comprobanteFile);
        }

        await registerGasto({
          concepto: f.concepto.trim(),
          categoria: f.categoria as GastoCategoria,
          monto: parseFloat(f.monto),
          fecha: f.fecha,
          notas: f.notas,
          comprobante: f.comprobante,
          comprobanteUrl: url,
        });
        showSuccess(`Gasto "${f.concepto}" registrado`);
        setAddOpen(false);
        resetAddForm();
        setComprobanteFile(null);
        setUploadedComprobanteUrl(null);
        setExtractedItems([]);
        return { status: 'success' };
      } catch (_err) {
        showError('Error al guardar gasto o subir comprobante');
        return { status: 'fail', errors: [{ message: 'Error al subir', field: ['comprobante'] }] };
      } finally {
        setIsUploading(false);
      }
    },
  });

  // ── Form State (Edit Gasto) ──
  const [editId, setEditId] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editOriginalUrl, setEditOriginalUrl] = useState<string | null>(null);
  const {
    fields: editFields,
    reset: _resetEditForm,
    validate: validateEdit,
    submitting: editSubmitting,
    makeClean: makeEditClean,
    submit: submitEdit,
  } = useForm({
    fields: {
      concepto: useField({ value: '', validates: [(v) => (v.trim() ? undefined : 'Ingresa el concepto')] }),
      categoria: useField<GastoCategoria | ''>({
        value: '',
        validates: [(v) => (v ? undefined : 'Selecciona una categoría')],
      }),
      monto: useField({
        value: '',
        validates: [(v) => (v && parseFloat(v) > 0 ? undefined : 'Ingresa un monto válido')],
      }),
      fecha: useField(''),
      notas: useField(''),
      comprobante: useField(false),
    },
    onSubmit: async (f): Promise<SubmitResult> => {
      setIsUploading(true);
      try {
        let url = uploadedComprobanteUrl || editOriginalUrl;
        if (f.comprobante && comprobanteFile && !uploadedComprobanteUrl) {
          url = await uploadComprobante(comprobanteFile);
        } else if (!f.comprobante) {
          url = null;
        }

        await updateGasto(editId, {
          concepto: f.concepto.trim(),
          categoria: f.categoria as GastoCategoria,
          monto: parseFloat(f.monto),
          fecha: f.fecha,
          notas: f.notas,
          comprobante: f.comprobante,
          comprobanteUrl: url,
        });
        showSuccess('Gasto actualizado');
        setEditOpen(false);
        setComprobanteFile(null);
        setUploadedComprobanteUrl(null);
        return { status: 'success' };
      } catch (_err) {
        showError('Error al guardar gasto o subir comprobante');
        return { status: 'fail', errors: [{ message: 'Error al subir', field: ['comprobante'] }] };
      } finally {
        setIsUploading(false);
      }
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
    return Object.entries(map).sort(([, a], [, b]) => (b as number) - (a as number)) as [GastoCategoria, number][];
  }, [filteredGastos]);

  const handleStartEdit = useCallback(
    (g: (typeof gastos)[0]) => {
      setEditId(g.id);
      editFields.concepto.onChange(g.concepto);
      editFields.categoria.onChange(g.categoria);
      editFields.monto.onChange(String(g.monto));
      editFields.fecha.onChange(g.fecha);
      editFields.notas.onChange(g.notas || '');
      editFields.comprobante.onChange(g.comprobante);
      setEditOriginalUrl(g.comprobanteUrl || null);
      setComprobanteFile(null);
      setUploadedComprobanteUrl(null);
      makeEditClean();
      setEditOpen(true);
    },
    [editFields, makeEditClean],
  );

  // ── AI Extraction ──
  const analyzeReceipt = async (file: File, fields: typeof addFields) => {
    setIsAnalyzing(true);
    setExtractedItems([]);
    try {
      const url = await uploadComprobante(file);
      setUploadedComprobanteUrl(url);

      const res = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al analizar');
      }
      const { data } = await res.json();

      if (data) {
        if (data.concepto) fields.concepto.onChange(data.concepto);
        if (data.monto) fields.monto.onChange(String(data.monto));
        if (data.fecha) fields.fecha.onChange(data.fecha);
        if (data.categoria) fields.categoria.onChange(data.categoria);
        if (data.items && data.items.length > 0) {
          setExtractedItems(data.items);
        }
        showSuccess(`Datos extraídos — ${data.items?.length || 0} líneas detectadas`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      if (message.includes('no configurada')) {
        showError(message);
      } else {
        showError('Error al analizar con IA. Rellena los campos manualmente.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setComprobanteFile(acceptedFiles[0]);
        setUploadedComprobanteUrl(null);
        analyzeReceipt(acceptedFiles[0], addFields);
      }
    },
    [addFields],
  );

  const handleEditDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setComprobanteFile(acceptedFiles[0]);
        setUploadedComprobanteUrl(null);
        analyzeReceipt(acceptedFiles[0], editFields);
      }
    },
    [editFields],
  );

  // edit logic moved to useForm onSubmit

  const handleDeleteGasto = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        await deleteGasto(id);
        showSuccess('Gasto eliminado');
        setDeleteConfirmId(null);
      } catch {
        showError('Error al eliminar');
      }
      setDeleting(false);
    },
    [deleteGasto, showSuccess, showError],
  );

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

  const expenseRatio = totalVentas > 0 ? (totalGastos / totalVentas) * 100 : 0;

  return (
    <>
      <BlockStack gap="600">
        {/* ═══ CHAPTER 1: PANORAMA FINANCIERO ═══ */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          <StatCard
            label="Total Gastos"
            value={totalGastos}
            format="currency"
            tone="critical"
            badge={{ content: `${filteredGastos.length} registros`, tone: 'info' }}
          />
          <StatCard label="Ingresos del Período" value={totalVentas} format="currency" />
          <StatCard
            label="Resultado Neto"
            value={gananciaEstimada}
            format="currency"
            tone={gananciaEstimada >= 0 ? 'success' : 'critical'}
          />
          <StatCard
            label="Eficiencia Operativa"
            value={totalVentas > 0 ? `${expenseRatio.toFixed(1)}%` : '—'}
            format="text"
            badge={{
              content: totalVentas > 0
                ? expenseRatio <= 30 ? 'Eficiente' : expenseRatio <= 50 ? 'Moderado' : 'Alto'
                : 'Sin datos',
              tone: totalVentas > 0
                ? expenseRatio <= 30 ? 'success' : expenseRatio <= 50 ? 'warning' : 'critical'
                : 'info',
            }}
          />
        </InlineGrid>

        {/* ═══ CHAPTER 2: DISTRIBUCIÓN DE EGRESOS ═══ */}
        {gastosByCategory.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingMd" fontWeight="bold">
                    Distribución de Gastos
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Desglose proporcional por categoría — identifica dónde se concentra el gasto
                  </Text>
                </BlockStack>
                <Badge>{`${gastosByCategory.length} categorías`}</Badge>
              </InlineStack>
              <Divider />
              <BlockStack gap="400">
                {gastosByCategory.map(([cat, amount]) => {
                  const pct = totalGastos > 0 ? (amount / totalGastos) * 100 : 0;
                  return (
                    <BlockStack key={cat} gap="150">
                      <InlineStack align="space-between" blockAlign="center">
                        <Badge tone={categoriaBadge[cat].tone}>{categoriaBadge[cat].label}</Badge>
                        <InlineStack gap="300" blockAlign="center">
                          <Text as="span" variant="bodySm" tone="subdued">
                            {pct.toFixed(1)}%
                          </Text>
                          <Text as="span" variant="bodySm" fontWeight="bold">
                            {formatCurrency(amount)}
                          </Text>
                        </InlineStack>
                      </InlineStack>
                      <ProgressBar
                        progress={pct}
                        tone={pct >= 40 ? 'critical' : 'primary'}
                        size="small"
                      />
                    </BlockStack>
                  );
                })}
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {/* ═══ CHAPTER 3: REGISTRO DE TRANSACCIONES ═══ */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Registro de Gastos
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Detalle individual de cada egreso operativo
                </Text>
              </BlockStack>
              <InlineStack gap="200">
                <Button icon={ExportIcon} onClick={() => setIsExportOpen(true)} variant="secondary">
                  Exportar
                </Button>
                <Button
                  icon={PlusIcon}
                  variant="primary"
                  onClick={() => {
                    setAddOpen(true);
                    setComprobanteFile(null);
                    setUploadedComprobanteUrl(null);
                    resetAddForm();
                  }}
                >
                  Nuevo Gasto
                </Button>
              </InlineStack>
            </InlineStack>
            <Divider />
            <InlineStack gap="300" align="start" blockAlign="end">
              <Box minWidth="220px">
                <Select
                  label="Categoría"
                  options={categoriaOptions as { label: string; value: string }[]}
                  value={filterCategoria}
                  onChange={setFilterCategoria}
                />
              </Box>
              <Box minWidth="220px">
                <Select label="Mes" options={monthOptions} value={filterMonth} onChange={setFilterMonth} />
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Gastos list */}
        {filteredGastos.length === 0 ? (
          <EmptyStateCard
            heading="Sin gastos registrados"
            description="Agrega tus gastos para llevar control de tus finanzas."
          />
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
                    <Text as="span" variant="bodySm">
                      {new Date(gasto.fecha).toLocaleDateString('es-MX')}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">
                        {gasto.concepto}
                      </Text>
                      {gasto.notas && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          {gasto.notas}
                        </Text>
                      )}
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={categoriaBadge[gasto.categoria].tone}>{categoriaBadge[gasto.categoria].label}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" fontWeight="bold" tone="critical">
                      {formatCurrency(gasto.monto)}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <BlockStack gap="100">
                      <Badge tone={gasto.comprobante ? 'success' : 'attention'}>
                        {gasto.comprobante ? 'Sí' : 'No'}
                      </Badge>
                      {gasto.comprobanteUrl && (
                        <Button
                          variant="plain"
                          size="micro"
                          onClick={() => window.open(gasto.comprobanteUrl!, '_blank')}
                        >
                          Ver Ticket
                        </Button>
                      )}
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="100">
                      <Button variant="plain" onClick={() => handleStartEdit(gasto)}>
                        Editar
                      </Button>
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
        title="Registrar Nuevo Gasto"
        primaryAction={{
          content: 'Guardar Gasto',
          onAction: () => {
            if (validateAdd().length === 0) submitAdd();
          },
          loading: addSubmitting || isUploading || isAnalyzing,
        }}
        secondaryActions={[
          { content: 'Cancelar', onAction: () => setAddOpen(false), disabled: isUploading || isAnalyzing },
        ]}
      >
        {/* ── SECTION 1: AI Receipt Upload (fastest path) ── */}
        <Modal.Section>
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm" fontWeight="bold">
                Escaneo Inteligente
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Sube un ticket o factura y la IA rellenará los campos automáticamente
              </Text>
            </BlockStack>
            <DropZone
              accept="image/*,application/pdf"
              type="file"
              allowMultiple={false}
              onDrop={handleAddDropZoneDrop}
            >
              <DropZone.FileUpload
                actionHint={
                  isAnalyzing
                    ? 'Analizando con IA...'
                    : comprobanteFile
                      ? comprobanteFile.name
                      : 'Arrastra o selecciona: JPG, PNG, PDF'
                }
              />
            </DropZone>
            {isAnalyzing && (
              <ProgressBar size="small" tone="highlight" />
            )}
            {isAnalyzing && (
              <Banner tone="info">Analizando el ticket con IA — los campos se llenarán automáticamente...</Banner>
            )}
            {comprobanteFile && !isAnalyzing && (
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="success">Archivo adjuntado</Badge>
                <Text as="span" variant="bodySm" tone="subdued">
                  {comprobanteFile.name}
                </Text>
              </InlineStack>
            )}
            {extractedItems.length > 0 && !isAnalyzing && (
              <Card padding="0">
                <BlockStack gap="0">
                  <Box padding="300" paddingBlockEnd="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h4" variant="headingSm">
                        Líneas detectadas
                      </Text>
                      <Badge tone="info">{`${extractedItems.length} artículos`}</Badge>
                    </InlineStack>
                  </Box>
                  <IndexTable
                    resourceName={{ singular: 'artículo', plural: 'artículos' }}
                    itemCount={extractedItems.length}
                    headings={[
                      { title: 'Producto' },
                      { title: 'Cant.', alignment: 'end' },
                      { title: 'P. Unit.', alignment: 'end' },
                      { title: 'Subtotal', alignment: 'end' },
                    ]}
                    selectable={false}
                  >
                    {extractedItems.map((item, idx) => (
                      <IndexTable.Row id={`item-${idx}`} key={idx} position={idx}>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodySm">{item.nombre}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodySm" alignment="end">
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.cantidad}</span>
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodySm" alignment="end">
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.precioUnitario)}</span>
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodySm" alignment="end">
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.cantidad * item.precioUnitario)}</span>
                          </Text>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Modal.Section>

        {/* ── SECTION 2: Core expense data ── */}
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm" fontWeight="bold">
              Datos del Gasto
            </Text>
            <TextField
              label="Concepto"
              placeholder="Ej: Pago de renta mensual"
              value={addFields.concepto.value}
              onChange={addFields.concepto.onChange}
              error={addFields.concepto.error}
              autoComplete="off"
            />
            <Popover
              active={addCategoryOpen}
              activator={
                <TextField
                  label="Categoría"
                  value={
                    addFields.categoria.value
                      ? (categoriaFormOptions.find((o) => o.value === addFields.categoria.value)?.label ?? '')
                      : ''
                  }
                  onFocus={() => setAddCategoryOpen(true)}
                  onChange={() => {}}
                  placeholder="Seleccionar categoría..."
                  autoComplete="off"
                  error={addFields.categoria.error}
                  readOnly
                />
              }
              onClose={() => setAddCategoryOpen(false)}
              fullWidth
              preferredAlignment="left"
            >
              <OptionList
                onChange={(selected) => {
                  addFields.categoria.onChange(selected[0] as GastoCategoria);
                  setAddCategoryOpen(false);
                }}
                options={categoriaFormOptions.map((o) => ({ value: o.value as string, label: o.label }))}
                selected={addFields.categoria.value ? [addFields.categoria.value] : []}
              />
            </Popover>
            <InlineGrid columns={2} gap="300">
              <TextField
                label="Monto"
                type="number"
                value={addFields.monto.value}
                onChange={addFields.monto.onChange}
                error={addFields.monto.error}
                autoComplete="off"
                prefix="$"
                suffix="MXN"
              />
              <Popover
                active={addDatePickerOpen}
                activator={
                  <TextField
                    label="Fecha"
                    value={
                      addFields.fecha.value
                        ? new Date(addFields.fecha.value + 'T12:00:00').toLocaleDateString('es-MX')
                        : ''
                    }
                    onFocus={() => setAddDatePickerOpen(true)}
                    onChange={() => {}}
                    placeholder="Seleccionar fecha"
                    autoComplete="off"
                    prefix={<Icon source={CalendarIcon} />}
                    readOnly
                  />
                }
                onClose={() => setAddDatePickerOpen(false)}
                preferredAlignment="left"
              >
                <div style={{ padding: '8px', width: '260px' }}>
                  <DatePicker
                    month={addMonthYear.month}
                    year={addMonthYear.year}
                    selected={
                      addFields.fecha.value
                        ? { start: new Date(addFields.fecha.value + 'T12:00:00'), end: new Date(addFields.fecha.value + 'T12:00:00') }
                        : undefined
                    }
                    onMonthChange={(m, y) => setAddMonthYear({ month: m, year: y })}
                    onChange={({ start }) => {
                      const d = start as Date;
                      addFields.fecha.onChange(d.toISOString().split('T')[0]);
                      setAddDatePickerOpen(false);
                    }}
                  />
                </div>
              </Popover>
            </InlineGrid>
          </BlockStack>
        </Modal.Section>

        {/* ── SECTION 3: Additional context ── */}
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="h3" variant="headingSm" fontWeight="bold">
              Información Adicional
            </Text>
            <TextField
              label="Notas"
              placeholder="Detalles o referencias adicionales..."
              value={addFields.notas.value}
              onChange={addFields.notas.onChange}
              autoComplete="off"
              multiline={2}
            />
            <Checkbox
              label="Registrar comprobante/factura adjunta"
              helpText="Marca si ya subiste un archivo arriba o si cuentas con comprobante digital"
              checked={addFields.comprobante.value}
              onChange={addFields.comprobante.onChange}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Modal: Editar Gasto */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar Gasto"
        primaryAction={{
          content: 'Guardar Cambios',
          onAction: () => {
            if (validateEdit().length === 0) submitEdit();
          },
          loading: editSubmitting || isUploading || isAnalyzing,
        }}
        secondaryActions={[
          { content: 'Cancelar', onAction: () => setEditOpen(false), disabled: isUploading || isAnalyzing },
        ]}
      >
        {/* ── SECTION 1: Receipt / AI Upload ── */}
        <Modal.Section>
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm" fontWeight="bold">
                Comprobante
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {editOriginalUrl
                  ? 'Ya tiene un archivo adjunto. Sube otro para reemplazar y re-escanear con IA.'
                  : 'Sube un ticket o factura para extraer datos automáticamente'}
              </Text>
            </BlockStack>
            <DropZone
              accept="image/*,application/pdf"
              type="file"
              allowMultiple={false}
              onDrop={handleEditDropZoneDrop}
            >
              <DropZone.FileUpload
                actionHint={
                  isAnalyzing
                    ? 'Analizando con IA...'
                    : comprobanteFile
                      ? comprobanteFile.name
                      : 'Arrastra o selecciona: JPG, PNG, PDF'
                }
              />
            </DropZone>
            {isAnalyzing && (
              <Banner tone="info">Analizando el ticket con IA — los campos se actualizarán automáticamente...</Banner>
            )}
            {(comprobanteFile || editOriginalUrl) && !isAnalyzing && (
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="success">{comprobanteFile ? 'Nuevo archivo' : 'Archivo existente'}</Badge>
                <Text as="span" variant="bodySm" tone="subdued">
                  {comprobanteFile ? comprobanteFile.name : 'Comprobante original'}
                </Text>
              </InlineStack>
            )}
          </BlockStack>
        </Modal.Section>

        {/* ── SECTION 2: Core expense data ── */}
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm" fontWeight="bold">
              Datos del Gasto
            </Text>
            <TextField
              label="Concepto"
              value={editFields.concepto.value}
              onChange={editFields.concepto.onChange}
              error={editFields.concepto.error}
              autoComplete="off"
            />
            <Popover
              active={editCategoryOpen}
              activator={
                <TextField
                  label="Categoría"
                  value={
                    editFields.categoria.value
                      ? (categoriaFormOptions.find((o) => o.value === editFields.categoria.value)?.label ?? '')
                      : ''
                  }
                  onFocus={() => setEditCategoryOpen(true)}
                  onChange={() => {}}
                  placeholder="Seleccionar categoría..."
                  autoComplete="off"
                  error={editFields.categoria.error}
                  readOnly
                />
              }
              onClose={() => setEditCategoryOpen(false)}
              fullWidth
              preferredAlignment="left"
            >
              <OptionList
                onChange={(selected) => {
                  editFields.categoria.onChange(selected[0] as GastoCategoria);
                  setEditCategoryOpen(false);
                }}
                options={categoriaFormOptions.map((o) => ({ value: o.value as string, label: o.label }))}
                selected={editFields.categoria.value ? [editFields.categoria.value] : []}
              />
            </Popover>
            <InlineGrid columns={2} gap="300">
              <TextField
                label="Monto"
                type="number"
                value={editFields.monto.value}
                onChange={editFields.monto.onChange}
                error={editFields.monto.error}
                autoComplete="off"
                prefix="$"
                suffix="MXN"
              />
              <Popover
                active={editDatePickerOpen}
                activator={
                  <TextField
                    label="Fecha"
                    value={
                      editFields.fecha.value
                        ? new Date(editFields.fecha.value + 'T12:00:00').toLocaleDateString('es-MX')
                        : ''
                    }
                    onFocus={() => setEditDatePickerOpen(true)}
                    onChange={() => {}}
                    placeholder="Seleccionar fecha"
                    autoComplete="off"
                    prefix={<Icon source={CalendarIcon} />}
                    readOnly
                  />
                }
                onClose={() => setEditDatePickerOpen(false)}
                preferredAlignment="left"
              >
                <div style={{ padding: '8px', width: '260px' }}>
                  <DatePicker
                    month={editMonthYear.month}
                    year={editMonthYear.year}
                    selected={
                      editFields.fecha.value
                        ? { start: new Date(editFields.fecha.value + 'T12:00:00'), end: new Date(editFields.fecha.value + 'T12:00:00') }
                        : undefined
                    }
                    onMonthChange={(m, y) => setEditMonthYear({ month: m, year: y })}
                    onChange={({ start }) => {
                      const d = start as Date;
                      editFields.fecha.onChange(d.toISOString().split('T')[0]);
                      setEditDatePickerOpen(false);
                    }}
                  />
                </div>
              </Popover>
            </InlineGrid>
          </BlockStack>
        </Modal.Section>

        {/* ── SECTION 3: Additional context ── */}
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="h3" variant="headingSm" fontWeight="bold">
              Información Adicional
            </Text>
            <TextField
              label="Notas"
              placeholder="Detalles o referencias adicionales..."
              value={editFields.notas.value}
              onChange={editFields.notas.onChange}
              autoComplete="off"
              multiline={2}
            />
            <Checkbox
              label="Registrar comprobante/factura adjunta"
              helpText="Marca si ya subiste un archivo arriba o si cuentas con comprobante digital"
              checked={editFields.comprobante.value}
              onChange={editFields.comprobante.onChange}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar gastos"
        exportName="gastos"
        onExport={(format) => {
          const exportData = filteredGastos.map((g) => ({
            Fecha: i18n.formatDate(new Date(g.fecha)),
            Concepto: g.concepto,
            Categoría: categoriaBadge[g.categoria]?.label || g.categoria,
            Monto: i18n.formatCurrency(g.monto, { currency: 'MXN' }),
            Notas: g.notas || 'N/A',
            Comprobante: g.comprobante ? 'Sí' : 'No',
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
