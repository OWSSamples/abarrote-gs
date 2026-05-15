'use client';

import { Modal, Text, BlockStack, Banner } from '@shopify/polaris';

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Title of the confirmation */
  title: string;
  /** Description / body message */
  message: string;
  /** Confirm button label (default: "Confirmar") */
  confirmLabel?: string;
  /** Cancel button label (default: "Cancelar") */
  cancelLabel?: string;
  /** Whether the confirm action is destructive (red button) */
  destructive?: boolean;
  /** Loading state for the confirm button */
  loading?: boolean;
  /** Called when user confirms */
  onConfirm: () => void;
  /** Called when user cancels or closes */
  onClose: () => void;
  /** Optional warning banner */
  warning?: string;
}

/**
 * ConfirmDialog — Reusable confirmation modal.
 *
 * @example
 * <ConfirmDialog
 *   open={showDelete}
 *   title="Eliminar producto"
 *   message="Esta acción no se puede deshacer."
 *   destructive
 *   onConfirm={handleDelete}
 *   onClose={() => setShowDelete(false)}
 * />
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
  warning,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: confirmLabel,
        onAction: onConfirm,
        destructive,
        loading,
      }}
      secondaryActions={[
        {
          content: cancelLabel,
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {warning && (
            <Banner tone="warning">
              <p>{warning}</p>
            </Banner>
          )}
          <Text as="p" variant="bodyMd">
            {message}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
