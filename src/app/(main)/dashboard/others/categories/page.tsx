'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Page,
  Card,
  Text,
  Button,
  TextField,
  InlineStack,
  BlockStack,
  Box,
  Icon,
  Badge,
  Banner,
  Modal,
  ProgressBar,
  IndexTable,
  EmptyState,
  Tabs,
  Thumbnail,
} from '@shopify/polaris';
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, ImageIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';

export default function CategoriesPage() {
  const categories = useDashboardStore((s) => s.categories);
  const products = useDashboardStore((s) => s.products);
  const createCategory = useDashboardStore((s) => s.createCategory);
  const updateCategory = useDashboardStore((s) => s.updateCategory);
  const deleteCategory = useDashboardStore((s) => s.deleteCategory);
  const { showSuccess, showError } = useToast();

  // ── State ──
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  // ── Computed ──
  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const cat = p.category || '';
      if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const uncategorizedCount = useMemo(() => products.filter((p) => !p.category).length, [products]);

  const totalCategorized = products.length - uncategorizedCount;
  const coveragePercent = products.length > 0 ? Math.round((totalCategorized / products.length) * 100) : 0;

  const tabs = useMemo(
    () => [
      { id: 'all', content: `Todas (${categories.length})`, panelID: 'all-panel' },
      {
        id: 'active',
        content: `Con productos (${categories.filter((c) => (productCounts.get(c.id) ?? productCounts.get(c.name) ?? 0) > 0).length})`,
        panelID: 'active-panel',
      },
      {
        id: 'empty',
        content: `Vacías (${categories.filter((c) => (productCounts.get(c.id) ?? productCounts.get(c.name) ?? 0) === 0).length})`,
        panelID: 'empty-panel',
      },
    ],
    [categories, productCounts],
  );

  const filteredCategories = useMemo(() => {
    let list = [...categories];

    // Tab filter
    if (selectedTab === 1) {
      list = list.filter((c) => (productCounts.get(c.id) ?? productCounts.get(c.name) ?? 0) > 0);
    } else if (selectedTab === 2) {
      list = list.filter((c) => (productCounts.get(c.id) ?? productCounts.get(c.name) ?? 0) === 0);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [categories, searchQuery, selectedTab, productCounts]);

  // ── Handlers ──
  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await createCategory({
        name: newName.trim(),
        description: newDescription.trim() || null,
        icon: null,
      });
      setNewName('');
      setNewDescription('');
      showSuccess('Categoría creada correctamente');
    } catch {
      showError('Error al crear la categoría');
    } finally {
      setIsSubmitting(false);
    }
  }, [newName, newDescription, createCategory, showSuccess, showError]);

  const openEditModal = useCallback((cat: { id: string; name: string; description?: string | null }) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description || '');
    setEditModalOpen(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editId || !editName.trim()) return;
    setIsUpdating(true);
    try {
      await updateCategory(editId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setEditModalOpen(false);
      showSuccess('Categoría actualizada');
    } catch {
      showError('Error al actualizar la categoría');
    } finally {
      setIsUpdating(false);
    }
  }, [editId, editName, editDescription, updateCategory, showSuccess, showError]);

  const openDeleteModal = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name });
    setDeleteModalOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const count = productCounts.get(deleteTarget.id) ?? productCounts.get(deleteTarget.name) ?? 0;
    if (count > 0) {
      showError(`No se puede eliminar "${deleteTarget.name}" porque tiene ${count} productos asignados`);
      setDeleteModalOpen(false);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteCategory(deleteTarget.id);
      showSuccess('Categoría eliminada');
      setDeleteModalOpen(false);
    } catch {
      showError('No se pudo eliminar la categoría');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, deleteCategory, showSuccess, showError, productCounts]);

  return (
    <Page
      title="Categorías"
      subtitle={`${totalCategorized} de ${products.length} productos organizados`}
      primaryAction={{
        content: 'Agregar categoría',
        icon: PlusIcon,
        onAction: () => setCreateModalOpen(true),
      }}
    >
      <BlockStack gap="400">
        {/* ── Coverage indicator ── */}
        {products.length > 0 && (
          <Card padding="400">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  {`${coveragePercent}% del inventario catalogado`}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {`${totalCategorized} / ${products.length}`}
                </Text>
              </InlineStack>
              <ProgressBar
                progress={coveragePercent}
                tone={coveragePercent >= 80 ? 'success' : coveragePercent >= 50 ? 'highlight' : 'critical'}
                size="small"
              />
            </BlockStack>
          </Card>
        )}

        {/* ── Warning ── */}
        {uncategorizedCount > 0 && categories.length > 0 && (
          <Banner
            title={`${uncategorizedCount} producto${uncategorizedCount === 1 ? '' : 's'} sin categoría`}
            tone="warning"
          >
            <Text as="p" variant="bodySm">
              Asigna categorías desde la página de productos para mejorar tus reportes.
            </Text>
          </Banner>
        )}

        {/* ── Main table ── */}
        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box padding="300" paddingBlockEnd="0">
              <TextField
                label=""
                labelHidden
                placeholder="Buscar categorías..."
                value={searchQuery}
                onChange={setSearchQuery}
                prefix={<Icon source={SearchIcon} />}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearchQuery('')}
              />
            </Box>

            <Box paddingBlockStart="200">
              {categories.length === 0 ? (
                <EmptyState
                  heading="Organiza tu inventario"
                  image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-inventory.svg"
                  action={{
                    content: 'Crear primera categoría',
                    onAction: () => setCreateModalOpen(true),
                  }}
                >
                  <Text as="p" tone="subdued">
                    Las categorías agrupan tus productos para facilitar búsquedas y generar reportes más claros.
                  </Text>
                </EmptyState>
              ) : filteredCategories.length === 0 ? (
                <EmptyState
                  heading="Sin resultados"
                  image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-inventory.svg"
                  action={{
                    content: 'Limpiar filtros',
                    onAction: () => {
                      setSearchQuery('');
                      setSelectedTab(0);
                    },
                  }}
                >
                  <Text as="p" tone="subdued">
                    {`No hay categorías que coincidan con "${searchQuery}"`}
                  </Text>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={{ singular: 'categoría', plural: 'categorías' }}
                  itemCount={filteredCategories.length}
                  selectable={false}
                  headings={[
                    { title: 'Categoría' },
                    { title: 'Productos', alignment: 'end' },
                    { title: 'Estado' },
                    { title: '' },
                  ]}
                >
                  {filteredCategories.map((cat, index) => {
                    const count = productCounts.get(cat.id) ?? productCounts.get(cat.name) ?? 0;
                    const initials =
                      cat.name.trim().split(/\s+/).length >= 2
                        ? (cat.name.trim().split(/\s+/)[0][0] + cat.name.trim().split(/\s+/)[1][0]).toUpperCase()
                        : cat.name.slice(0, 2).toUpperCase();

                    return (
                      <IndexTable.Row id={cat.id} key={cat.id} position={index}>
                        <IndexTable.Cell>
                          <InlineStack gap="300" blockAlign="center">
                            <Thumbnail source={ImageIcon} alt={cat.name} size="small" />
                            <BlockStack gap="050">
                              <Text variant="bodyMd" as="span" fontWeight="semibold">
                                {cat.name}
                              </Text>
                              {cat.description ? (
                                <Text variant="bodySm" as="span" tone="subdued">
                                  {cat.description}
                                </Text>
                              ) : (
                                <Text variant="bodySm" as="span" tone="subdued">
                                  {`${initials} · Sin descripción`}
                                </Text>
                              )}
                            </BlockStack>
                          </InlineStack>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text
                            as="span"
                            variant="bodyMd"
                            alignment="end"
                            fontWeight={count > 0 ? 'semibold' : 'regular'}
                          >
                            {String(count)}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {count > 0 ? <Badge tone="success">Activa</Badge> : <Badge>Vacía</Badge>}
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <InlineStack gap="100" align="end">
                            <Button
                              size="micro"
                              icon={EditIcon}
                              variant="tertiary"
                              onClick={() => openEditModal(cat)}
                              accessibilityLabel={`Editar ${cat.name}`}
                            />
                            <Button
                              size="micro"
                              icon={DeleteIcon}
                              variant="tertiary"
                              tone="critical"
                              disabled={count > 0}
                              onClick={() => openDeleteModal(cat.id, cat.name)}
                              accessibilityLabel={`Eliminar ${cat.name}`}
                            />
                          </InlineStack>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    );
                  })}
                </IndexTable>
              )}
            </Box>
          </Tabs>
        </Card>
      </BlockStack>

      {/* Create Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Agregar categoría"
        primaryAction={{
          content: 'Agregar',
          onAction: async () => {
            await handleCreate();
            setCreateModalOpen(false);
          },
          loading: isSubmitting,
          disabled: !newName.trim(),
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setCreateModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Nombre"
              value={newName}
              onChange={setNewName}
              placeholder="Ej: Abarrotes, Limpieza, Lácteos..."
              autoComplete="off"
              disabled={isSubmitting}
              maxLength={100}
              showCharacterCount
            />
            <TextField
              label="Descripción (opcional)"
              value={newDescription}
              onChange={setNewDescription}
              placeholder="Breve descripción de esta categoría"
              autoComplete="off"
              multiline={2}
              disabled={isSubmitting}
              maxLength={255}
              showCharacterCount
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar categoría"
        primaryAction={{
          content: 'Guardar',
          onAction: handleUpdate,
          loading: isUpdating,
          disabled: !editName.trim(),
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setEditModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Nombre"
              value={editName}
              onChange={setEditName}
              autoComplete="off"
              maxLength={100}
              showCharacterCount
            />
            <TextField
              label="Descripción (opcional)"
              value={editDescription}
              onChange={setEditDescription}
              autoComplete="off"
              multiline={2}
              maxLength={255}
              showCharacterCount
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Eliminar categoría"
        primaryAction={{
          content: 'Eliminar',
          onAction: handleDelete,
          loading: isDeleting,
          destructive: true,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setDeleteModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">{`¿Estás seguro de eliminar la categoría "${deleteTarget?.name}"?`}</Text>
            <Text as="p" tone="subdued" variant="bodySm">
              Esta acción no se puede deshacer. Los productos asignados quedarán sin categoría.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
