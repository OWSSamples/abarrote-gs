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
  InlineGrid,
  Banner,
  Spinner,
  Checkbox,
  ChoiceList,
  Divider,
  Tag,
  Icon,
  Scrollable,
  ProgressBar,
  EmptyState,
} from '@shopify/polaris';
import { PlusIcon, DeleteIcon, EditIcon, SearchIcon } from '@shopify/polaris-icons';
import {
  fetchPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotionActive,
} from '@/app/actions/promotion-actions';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Promotion, PromotionType, ApplicableTo, Product, ProductCategory } from '@/types';
import { PROMOTION_TYPE_LABELS } from '@/types';

function getStatusBadge(promo: Promotion) {
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate);
  if (!promo.active) return <Badge tone="critical">Inactiva</Badge>;
  if (now < start) return <Badge tone="info">Programada</Badge>;
  if (now > end) return <Badge>Expirada</Badge>;
  if (promo.usageLimit != null && promo.usageCount >= promo.usageLimit)
    return <Badge tone="warning">Límite alcanzado</Badge>;
  return <Badge tone="success">Activa</Badge>;
}

function getApplicableBadge(promo: Promotion, products: Product[], categories: ProductCategory[]) {
  if (promo.applicableTo === 'all') return <Badge>Todo el catálogo</Badge>;
  if (promo.applicableTo === 'category') {
    const count = promo.applicableIds.length;
    const names = promo.applicableIds
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2);
    const label = names.length > 0 ? names.join(', ') + (count > 2 ? ` +${count - 2}` : '') : `${count} categorías`;
    return <Badge tone="info">{label}</Badge>;
  }
  const count = promo.applicableIds.length;
  const names = promo.applicableIds
    .map((id) => products.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .slice(0, 2);
  const label = names.length > 0 ? names.join(', ') + (count > 2 ? ` +${count - 2}` : '') : `${count} productos`;
  return <Badge tone="warning">{label}</Badge>;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const { showSuccess, showError } = useToast();
  const products = useDashboardStore((s) => s.products);
  const categories = useDashboardStore((s) => s.categories);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPromotions();
      setPromotions(data);
    } catch {
      showError('Error al cargar promociones');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la promoción "${name}"?`)) return;
    try {
      await deletePromotion(id);
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      showSuccess('Promoción eliminada');
    } catch {
      showError('Error al eliminar');
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await togglePromotionActive(id, !active);
      setPromotions((prev) => prev.map((p) => (p.id === id ? { ...p, active: !active } : p)));
    } catch {
      showError('Error al cambiar estado');
    }
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingPromo(null);
    setModalOpen(true);
  };

  const activePromos = promotions.filter((p) => {
    const now = new Date();
    return p.active && new Date(p.startDate) <= now && new Date(p.endDate) >= now;
  });

  const totalUsage = promotions.reduce((s, p) => s + p.usageCount, 0);

  if (modalOpen) {
    return (
      <PromotionFormView
        onClose={() => {
          setModalOpen(false);
          setEditingPromo(null);
        }}
        editing={editingPromo}
        onSave={load}
        products={products}
        categories={categories}
      />
    );
  }

  return (
    <Page
      title="Promociones"
      subtitle={`${promotions.length} promociones — ${activePromos.length} activas ahora`}
      backAction={{ content: 'Dashboard', url: '/dashboard' }}
      primaryAction={{ content: 'Nueva promoción', icon: PlusIcon, onAction: handleNew }}
    >
      <Layout>
        {/* KPI cards */}
        <Layout.Section>
          <InlineGrid columns={3} gap="400">
            <Card>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p" tone="subdued">
                  Total promociones
                </Text>
                <Text variant="headingLg" as="p">
                  {String(promotions.length)}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p" tone="subdued">
                  Activas ahora
                </Text>
                <Text variant="headingLg" as="p" tone="success">
                  {String(activePromos.length)}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p" tone="subdued">
                  Usos totales
                </Text>
                <Text variant="headingLg" as="p">
                  {String(totalUsage)}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Table */}
        <Layout.Section>
          <Card padding="0">
            {loading ? (
              <Box padding="800">
                <InlineStack align="center">
                  <Spinner />
                </InlineStack>
              </Box>
            ) : promotions.length === 0 ? (
              <Box paddingBlockStart="200">
                <EmptyState
                  heading="Sin promociones"
                  image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-inventory.svg"
                >
                  <Text as="p" tone="subdued">
                    Crea tu primera promoción para atraer más ventas.
                  </Text>
                </EmptyState>
              </Box>
            ) : (
              <IndexTable
                resourceName={{ singular: 'promoción', plural: 'promociones' }}
                itemCount={promotions.length}
                selectable={false}
                headings={[
                  { title: 'Promoción' },
                  { title: 'Tipo' },
                  { title: 'Descuento' },
                  { title: 'Aplica a' },
                  { title: 'Vigencia' },
                  { title: 'Usos' },
                  { title: 'Estado' },
                  { title: 'Acciones' },
                ]}
              >
                {promotions.map((promo, i) => (
                  <IndexTable.Row id={promo.id} key={promo.id} position={i}>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text variant="bodyMd" as="span" fontWeight="semibold">
                          {promo.name}
                        </Text>
                        {promo.description && (
                          <Text variant="bodySm" as="span" tone="subdued">
                            {promo.description}
                          </Text>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge>{PROMOTION_TYPE_LABELS[promo.type]}</Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="bold">
                        {promo.type === 'percentage' ? `${promo.value}%` : formatCurrency(promo.value)}
                      </Text>
                      {promo.minPurchase > 0 && (
                        <Text variant="bodySm" as="p" tone="subdued">
                          {`Min: ${formatCurrency(promo.minPurchase)}`}
                        </Text>
                      )}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{getApplicableBadge(promo, products, categories)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" as="span">
                        {new Date(promo.startDate).toLocaleDateString('es-MX')}
                      </Text>
                      <Text variant="bodySm" as="span" tone="subdued">
                        {' '}
                        →{' '}
                      </Text>
                      <Text variant="bodySm" as="span">
                        {new Date(promo.endDate).toLocaleDateString('es-MX')}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span">
                          {promo.usageLimit ? `${promo.usageCount}/${promo.usageLimit}` : `${promo.usageCount}`}
                        </Text>
                        {promo.usageLimit != null && (
                          <ProgressBar
                            progress={Math.min(100, (promo.usageCount / promo.usageLimit) * 100)}
                            size="small"
                            tone={promo.usageCount >= promo.usageLimit ? 'critical' : 'primary'}
                          />
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{getStatusBadge(promo)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="100">
                        <Button size="micro" onClick={() => handleToggle(promo.id, promo.active)}>
                          {promo.active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button size="micro" icon={EditIcon} onClick={() => handleEdit(promo)} />
                        <Button
                          size="micro"
                          icon={DeleteIcon}
                          tone="critical"
                          onClick={() => handleDelete(promo.id, promo.name)}
                        />
                      </InlineStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ==================== FORM MODAL ====================

interface PromotionFormModalProps {
  open: boolean;
  onClose: () => void;
  editing: Promotion | null;
  onSave: () => void;
  products: Product[];
  categories: ProductCategory[];
}

function PromotionFormView({ onClose, editing, onSave, products, categories }: Omit<PromotionFormModalProps, 'open'>) {
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PromotionType>('percentage');
  const [value, setValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('0');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [applicableTo, setApplicableTo] = useState<ApplicableTo>('all');
  const [applicableIds, setApplicableIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [usageLimit, setUsageLimit] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Product/category search
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description);
      setType(editing.type);
      setValue(String(editing.value));
      setMinPurchase(String(editing.minPurchase));
      setMaxDiscount(editing.maxDiscount != null ? String(editing.maxDiscount) : '');
      setApplicableTo(editing.applicableTo);
      setApplicableIds(editing.applicableIds || []);
      setActive(editing.active);
      setUsageLimit(editing.usageLimit != null ? String(editing.usageLimit) : '');
      setStartDate(editing.startDate.split('T')[0]);
      setEndDate(editing.endDate.split('T')[0]);
    } else {
      setName('');
      setDescription('');
      setType('percentage');
      setValue('');
      setMinPurchase('0');
      setMaxDiscount('');
      setApplicableTo('all');
      setApplicableIds([]);
      setActive(true);
      setUsageLimit('');
      setStartDate(new Date().toISOString().split('T')[0]);
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setEndDate(d.toISOString().split('T')[0]);
    }
    setSearchQuery('');
  }, [editing, open]);

  // Clear selected IDs when switching applicable type
  const handleApplicableToChange = useCallback((val: string[]) => {
    setApplicableTo(val[0] as ApplicableTo);
    setApplicableIds([]);
    setSearchQuery('');
  }, []);

  // Filtered search results for product/category picker
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (applicableTo === 'product') {
      return products
        .filter(
          (p) =>
            !applicableIds.includes(p.id) &&
            (query === '' ||
              p.name.toLowerCase().includes(query) ||
              p.sku.toLowerCase().includes(query) ||
              p.barcode.includes(query)),
        )
        .slice(0, 20);
    }
    if (applicableTo === 'category') {
      return categories
        .filter((c) => !applicableIds.includes(c.id) && (query === '' || c.name.toLowerCase().includes(query)))
        .slice(0, 20);
    }
    return [];
  }, [searchQuery, applicableTo, products, categories, applicableIds]);

  const addItem = useCallback((id: string) => {
    setApplicableIds((prev) => [...prev, id]);
    setSearchQuery('');
  }, []);

  const removeItem = useCallback((id: string) => {
    setApplicableIds((prev) => prev.filter((i) => i !== id));
  }, []);

  // Resolve names for selected tags
  const selectedItems = useMemo(() => {
    if (applicableTo === 'product') {
      return applicableIds.map((id) => {
        const p = products.find((prod) => prod.id === id);
        return { id, name: p ? `${p.name} (${p.sku})` : id };
      });
    }
    if (applicableTo === 'category') {
      return applicableIds.map((id) => {
        const c = categories.find((cat) => cat.id === id);
        return { id, name: c?.name ?? id };
      });
    }
    return [];
  }, [applicableIds, applicableTo, products, categories]);

  // Validation
  const canSave = useMemo(() => {
    if (!name.trim() || !value) return false;
    if (applicableTo !== 'all' && applicableIds.length === 0) return false;
    return true;
  }, [name, value, applicableTo, applicableIds]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        name,
        description,
        type,
        value: parseFloat(value) || 0,
        minPurchase: parseFloat(minPurchase) || 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        applicableTo,
        applicableIds: applicableTo === 'all' ? [] : applicableIds,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        active,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
      };

      if (editing) {
        await updatePromotion(editing.id, data);
        showSuccess('Promoción actualizada');
      } else {
        await createPromotion(data);
        showSuccess('Promoción creada');
      }

      onSave();
      onClose();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      backAction={{ content: 'Promociones', onAction: onClose }}
      title={editing ? 'Editar promoción' : 'Nueva promoción'}
      primaryAction={{
        content: editing ? 'Guardar' : 'Crear promoción',
        onAction: handleSave,
        loading: saving,
        disabled: !canSave,
      }}
    >
      <Layout>
        {/* Main Column */}
        <Layout.Section>
          <BlockStack gap="400">
            {/* Información básica */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Información general
                </Text>
                <TextField
                  label="Nombre de la promoción"
                  value={name}
                  onChange={setName}
                  placeholder="Ej: 2x1 en lácteos, 20% Fin de Semana..."
                  autoComplete="off"
                />
                <TextField
                  label="Descripción (opcional)"
                  value={description}
                  onChange={setDescription}
                  placeholder="Detalles de la promoción para uso interno"
                  multiline={3}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* Descuento */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Valor del descuento
                </Text>
                <ChoiceList
                  title="Tipo"
                  titleHidden
                  choices={[
                    {
                      label: 'Porcentaje de descuento',
                      value: 'percentage',
                      renderChildren: (isSelected) =>
                        isSelected && (
                          <Box paddingBlockStart="200" paddingInlineStart="400">
                            <TextField
                              label="Porcentaje (%)"
                              type="number"
                              value={value}
                              onChange={setValue}
                              placeholder="15"
                              autoComplete="off"
                              suffix="%"
                            />
                          </Box>
                        ),
                    },
                    {
                      label: 'Descuento fijo ($)',
                      value: 'fixed',
                      renderChildren: (isSelected) =>
                        isSelected && (
                          <Box paddingBlockStart="200" paddingInlineStart="400">
                            <TextField
                              label="Monto ($)"
                              type="number"
                              value={value}
                              onChange={setValue}
                              placeholder="50"
                              autoComplete="off"
                              suffix="MXN"
                            />
                          </Box>
                        ),
                    },
                    { label: 'Compra X lleva Y (BOGO)', value: 'bogo' },
                    { label: 'Paquete / combo', value: 'bundle' },
                  ]}
                  selected={[type]}
                  onChange={(v) => setType(v[0] as PromotionType)}
                />

                <Box paddingBlockStart="200">
                  <Divider />
                </Box>

                <Text variant="headingSm" as="h3">
                  Requisitos mínimos
                </Text>
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  <TextField
                    label="Compra mínima ($)"
                    type="number"
                    value={minPurchase}
                    onChange={setMinPurchase}
                    autoComplete="off"
                    prefix="$"
                  />
                  {type === 'percentage' && (
                    <TextField
                      label="Descuento máximo ($)"
                      type="number"
                      value={maxDiscount}
                      onChange={setMaxDiscount}
                      placeholder="Sin límite"
                      autoComplete="off"
                      prefix="$"
                      helpText="Tope máximo de descuento"
                    />
                  )}
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Productos Aplicables */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Aplica a
                </Text>
                <ChoiceList
                  title="Aplicable a"
                  titleHidden
                  choices={[
                    { label: 'Todos los productos', value: 'all' },
                    { label: 'Categorías específicas', value: 'category' },
                    { label: 'Productos específicos', value: 'product' },
                  ]}
                  selected={[applicableTo]}
                  onChange={handleApplicableToChange}
                />

                {applicableTo === 'all' && (
                  <Box paddingBlockStart="200">
                    <Banner tone="info">
                      <Text as="span" variant="bodySm">
                        Esta promoción se aplicará automáticamente a todos los productos del catálogo.
                      </Text>
                    </Banner>
                  </Box>
                )}

                {applicableTo !== 'all' && (
                  <BlockStack gap="300">
                    {/* Selected items as tags */}
                    {selectedItems.length > 0 && (
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <Text variant="bodySm" as="p" tone="subdued">
                            {applicableTo === 'product'
                              ? `${selectedItems.length} producto${selectedItems.length === 1 ? '' : 's'} seleccionado${selectedItems.length === 1 ? '' : 's'}`
                              : `${selectedItems.length} categoría${selectedItems.length === 1 ? '' : 's'} seleccionada${selectedItems.length === 1 ? '' : 's'}`}
                          </Text>
                          <InlineStack gap="100" wrap>
                            {selectedItems.map((item) => (
                              <Tag key={item.id} onRemove={() => removeItem(item.id)}>
                                {item.name}
                              </Tag>
                            ))}
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    )}

                    {/* Search and add */}
                    <TextField
                      label={applicableTo === 'product' ? 'Buscar producto' : 'Buscar categoría'}
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder={
                        applicableTo === 'product'
                          ? 'Buscar por nombre, SKU o código...'
                          : 'Buscar por nombre de categoría...'
                      }
                      prefix={<Icon source={SearchIcon} />}
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => setSearchQuery('')}
                    />

                    {/* Search results list */}
                    {searchResults.length > 0 && (
                      <Box
                        borderWidth="025"
                        borderColor="border"
                        borderRadius="200"
                        overflowX="hidden"
                        overflowY="hidden"
                      >
                        <Scrollable style={{ maxHeight: '200px' }}>
                          <BlockStack>
                            {searchResults.map((item, idx) => {
                              const isProduct = applicableTo === 'product';
                              const product = isProduct ? (item as Product) : null;
                              const category = !isProduct ? (item as ProductCategory) : null;
                              return (
                                <Box key={item.id} padding="0">
                                  <button
                                    type="button"
                                    onClick={() => addItem(item.id)}
                                    style={{
                                      width: '100%',
                                      padding: '12px 16px',
                                      background: idx % 2 === 0 ? 'transparent' : 'var(--p-color-bg-surface-secondary)',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <BlockStack gap="0">
                                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                                        {product ? product.name : (category?.name ?? '')}
                                      </Text>
                                      {product && (
                                        <Text as="span" variant="bodySm" tone="subdued">
                                          {`SKU: ${product.sku || 'N/A'} • ${formatCurrency(product.unitPrice)}`}
                                        </Text>
                                      )}
                                    </BlockStack>
                                    <Box>
                                      <Icon source={PlusIcon} tone="interactive" />
                                    </Box>
                                  </button>
                                </Box>
                              );
                            })}
                          </BlockStack>
                        </Scrollable>
                      </Box>
                    )}

                    {searchQuery.trim() && searchResults.length === 0 && (
                      <Box padding="300">
                        <Text as="p" tone="subdued" alignment="center">
                          {applicableTo === 'product' ? 'No se encontraron productos' : 'No se encontraron categorías'}
                        </Text>
                      </Box>
                    )}

                    {applicableIds.length === 0 && (
                      <Banner tone="warning">
                        <Text as="span" variant="bodySm">
                          {applicableTo === 'product'
                            ? 'Selecciona al menos un producto.'
                            : 'Selecciona al menos una categoría.'}
                        </Text>
                      </Banner>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Sidebar Column */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Status */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Estado
                </Text>
                <Checkbox
                  label="Promoción activa"
                  helpText="Si está inactiva, no se aplicará en punto de venta"
                  checked={active}
                  onChange={setActive}
                />
              </BlockStack>
            </Card>

            {/* Vigencia */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Fechas de vigencia
                </Text>
                <BlockStack gap="300">
                  <TextField
                    label="Fecha de inicio"
                    type="date"
                    value={startDate}
                    onChange={setStartDate}
                    autoComplete="off"
                  />
                  <TextField
                    label="Fecha de fin (opcional)"
                    type="date"
                    value={endDate}
                    onChange={setEndDate}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setEndDate('')}
                  />
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Limits */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Límites de uso
                </Text>
                <TextField
                  label="Total de usos"
                  type="number"
                  value={usageLimit}
                  onChange={setUsageLimit}
                  placeholder="Ilimitado"
                  autoComplete="off"
                  helpText="Dejar vacío para uso ilimitado"
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
