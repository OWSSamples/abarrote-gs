'use client';

import { Modal, Text, BlockStack, Banner } from '@shopify/polaris';
import type { UserRoleRecord } from '@/types';

interface DeactivateUserModalProps {
  open: boolean;
  onClose: () => void;
  selectedUser: UserRoleRecord | null;
  onDeactivate: () => Promise<void>;
  saving: boolean;
}

export function DeactivateUserModal({ open, onClose, selectedUser, onDeactivate, saving }: DeactivateUserModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dar de baja al usuario"
      primaryAction={{
        content: 'Dar de baja',
        destructive: true,
        onAction: onDeactivate,
        loading: saving,
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Banner tone="warning">
            <p>
              Al dar de baja a <strong>{selectedUser?.displayName || selectedUser?.email}</strong>, se bloqueará su inicio de sesión en AWS Cognito y su estado local quedará como baja en PostgreSQL.
            </p>
          </Banner>
          {selectedUser?.globalId && (
            <Banner tone="info">
              <p>
                El Global ID <strong>{selectedUser.globalId}</strong> quedará reservado permanentemente y no podrá ser
                reutilizado por nadie más.
              </p>
            </Banner>
          )}
          <Text as="p" tone="subdued">
            El usuario no será eliminado del sistema. Su registro permanecerá para auditoría y su Global ID nunca podrá
            ser reasignado. Si necesitas reincorporarlo, podrás usar la opción &quot;Reactivar&quot;, que vuelve a habilitar AWS Cognito y la base local.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
