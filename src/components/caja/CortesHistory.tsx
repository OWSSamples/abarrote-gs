'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  IndexTable,
  Badge,
  Button,
  Modal,
  useIndexResourceState,
} from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';

export function CortesHistory() {
  const cortesHistory  = useDashboardStore((s) => s.cortesHistory);
  const deleteCortes   = useDashboardStore((s) => s.deleteCortes);
  const { showSuccess, showError } = useToast();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting,        setDeleting]        = useState(false);

  const sorted = [...cortesHistory].reverse();

  const {
    selectedResources: selectedIds,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(sorted as { id: string }[]);

  const handleDeleteSelected = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteCortes(selectedIds);
      showSuccess(`${selectedIds.length} corte${selectedIds.length !== 1 ? 's' : ''} eliminado${selectedIds.length !== 1 ? 's' : ''}`);
      clearSelection();
      setDeleteModalOpen(false);
    } catch {
      showError('Error al eliminar los cortes');
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, deleteCortes, clearSelection, showSuccess, showError]);

  if (cortesHistory.length === 0) return null;

  const selectedCount = selectedIds.length;

  return (
    <>
      <Card padding="0">
        <BlockStack gap="0">
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--p-color-border)' }}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">Historial de Cortes</Text>
              {selectedCount > 0 && (
                <Button
                  icon={DeleteIcon}
                  tone="critical"
                  onClick={() => setDeleteModalOpen(true)}
                >
                  {`Eliminar (${selectedCount})`}
                </Button>
              )}
            </InlineStack>
          </div>

          <IndexTable
            resourceName={{ singular: 'corte', plural: 'cortes' }}
            itemCount={sorted.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedIds.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Fecha' },
              { title: 'Cajero' },
              { title: 'Total Ventas' },
              { title: 'Esperado' },
              { title: 'Contado' },
              { title: 'Diferencia' },
            ]}
          >
            {sorted.map((c, idx) => (
              <IndexTable.Row
                id={c.id}
                key={c.id}
                position={idx}
                selected={selectedIds.includes(c.id)}
              >
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">{new Date(c.fecha).toLocaleDateString('es-MX')}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{c.cajero}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" fontWeight="semibold">{formatCurrency(c.totalVentas)}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{formatCurrency(c.efectivoEsperado)}</IndexTable.Cell>
                <IndexTable.Cell>{formatCurrency(c.efectivoContado)}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={Math.abs(c.diferencia) <= 10 ? 'success' : 'critical'}>
                    {`${c.diferencia >= 0 ? '+' : ''}${formatCurrency(c.diferencia)}`}
                  </Badge>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </Card>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={`Eliminar ${selectedCount} corte${selectedCount !== 1 ? 's' : ''} de caja`}
        primaryAction={{
          content: 'Eliminar',
          destructive: true,
          loading: deleting,
          onAction: handleDeleteSelected,
        }}
        secondaryActions={[{
          content: 'Cancelar',
          onAction: () => setDeleteModalOpen(false),
        }]}
      >
        <Modal.Section>
          <Text as="p">
            Esta acción eliminará permanentemente {selectedCount === 1 ? 'el corte seleccionado' : `los ${selectedCount} cortes seleccionados`}. No se puede deshacer.
          </Text>
        </Modal.Section>
      </Modal>
    </>
  );
}
