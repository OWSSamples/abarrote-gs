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
  Box,
  useIndexResourceState,
} from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';

export function CortesHistory() {
  const cortesHistory = useDashboardStore((s) => s.cortesHistory);
  const deleteCortes = useDashboardStore((s) => s.deleteCortes);
  const { showSuccess, showError } = useToast();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      showSuccess(
        `${selectedIds.length} corte${selectedIds.length !== 1 ? 's' : ''} eliminado${selectedIds.length !== 1 ? 's' : ''}`,
      );
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
          {/* Header with bulk actions */}
          {selectedCount > 0 && (
            <Box padding="300" borderBlockEndWidth="025" borderColor="border">
              <InlineStack align="end">
                <Button icon={DeleteIcon} tone="critical" size="slim" onClick={() => setDeleteModalOpen(true)}>
                  {`Eliminar ${selectedCount} seleccionado${selectedCount !== 1 ? 's' : ''}`}
                </Button>
              </InlineStack>
            </Box>
          )}

          <IndexTable
            resourceName={{ singular: 'corte', plural: 'cortes' }}
            itemCount={sorted.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedIds.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Fecha' },
              { title: 'Cajero' },
              { title: 'Total Ventas', alignment: 'end' },
              { title: 'Esperado', alignment: 'end' },
              { title: 'Contado', alignment: 'end' },
              { title: 'Diferencia', alignment: 'end' },
            ]}
          >
            {sorted.map((c, idx) => (
              <IndexTable.Row id={c.id} key={c.id} position={idx} selected={selectedIds.includes(c.id)}>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {new Date(c.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {new Date(c.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">{c.cajero}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="bold" alignment="end">
                    {formatCurrency(c.totalVentas)}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm" alignment="end">
                    {formatCurrency(c.efectivoEsperado)}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm" alignment="end">
                    {formatCurrency(c.efectivoContado)}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack align="end">
                    <Badge tone={Math.abs(c.diferencia) <= 10 ? 'success' : 'critical'} size="small">
                      {`${c.diferencia >= 0 ? '+' : ''}${formatCurrency(c.diferencia)}`}
                    </Badge>
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>

          {/* Footer */}
          <Box padding="300" borderBlockStartWidth="025" borderColor="border">
            <Text as="span" variant="bodySm" tone="subdued">
              {sorted.length} corte{sorted.length !== 1 ? 's' : ''} registrado{sorted.length !== 1 ? 's' : ''}
            </Text>
          </Box>
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
        secondaryActions={[
          {
            content: 'Cancelar',
            onAction: () => setDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Esta acción eliminará permanentemente{' '}
            {selectedCount === 1 ? 'el corte seleccionado' : `los ${selectedCount} cortes seleccionados`}. No se puede
            deshacer.
          </Text>
        </Modal.Section>
      </Modal>
    </>
  );
}
