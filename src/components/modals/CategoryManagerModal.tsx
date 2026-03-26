'use client';

import { useState, useCallback } from 'react';
import {
  Modal,
  ResourceList,
  ResourceItem,
  Text,
  Button,
  TextField,
  InlineStack,
  BlockStack,
  Box,
  Divider,
  Icon,
} from '@shopify/polaris';
import {
  DeleteIcon,
  CollectionIcon,
  PlusIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';

interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function CategoryManagerModal({ open, onClose }: CategoryManagerModalProps) {
  const categories = useDashboardStore((s) => s.categories);
  const createCategory = useDashboardStore((s) => s.createCategory);
  const deleteCategory = useDashboardStore((s) => s.deleteCategory);
  const { showSuccess, showError } = useToast();

  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      const id = newName.toLowerCase().trim().replace(/\s+/g, '_');
      await createCategory({
        id,
        name: newName.trim(),
        description: null,
        icon: null,
      });
      setNewName('');
      showSuccess('Categoría creada correctamente');
    } catch (err) {
      showError('Error al crear la categoría');
    } finally {
      setIsSubmitting(false);
    }
  }, [newName, createCategory, showSuccess, showError]);

  const handleDelete = useCallback(async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta categoría?')) {
      try {
        await deleteCategory(id);
        showSuccess('Categoría eliminada');
      } catch (err) {
        showError('No se pudo eliminar la categoría');
      }
    }
  }, [deleteCategory, showSuccess, showError]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gestionar Categorías"
      secondaryActions={[{ content: 'Cerrar', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Box padding="400" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Nueva Categoría</Text>
              <InlineStack gap="200">
                <Box minWidth="300px">
                  <TextField
                    label="Nombre"
                    labelHidden
                    value={newName}
                    onChange={setNewName}
                    placeholder="Ej: Abarrotes, Limpieza..."
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </Box>
                <Button 
                  variant="primary" 
                  icon={PlusIcon} 
                  onClick={handleCreate}
                  loading={isSubmitting}
                  disabled={!newName.trim()}
                >
                  Agregar
                </Button>
              </InlineStack>
            </BlockStack>
          </Box>

          <Divider />

          <Text as="h3" variant="headingMd">Categorías existentes</Text>
          
          <Box borderStyle="solid" borderWidth="025" borderColor="border" borderRadius="200">
            <ResourceList
              resourceName={{ singular: 'categoría', plural: 'categorías' }}
              items={categories}
              renderItem={(category) => {
                const { id, name } = category;
                return (
                  <ResourceItem
                    id={id}
                    onClick={() => {}}
                    shortcutActions={[
                      {
                        content: 'Eliminar',
                        destructive: true,
                        onAction: () => handleDelete(id),
                      },
                    ]}
                    persistActions
                  >
                    <InlineStack align="start" gap="300" blockAlign="center">
                      <Box padding="100" background="bg-surface-secondary" borderRadius="100">
                        <Icon source={CollectionIcon} tone="subdued" />
                      </Box>
                      <Text variant="bodyMd" fontWeight="bold" as="span">
                        {name}
                      </Text>
                    </InlineStack>
                  </ResourceItem>
                );
              }}
            />
          </Box>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
