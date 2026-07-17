'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner, BlockStack, Modal, Text } from '@shopify/polaris';
import type { RoleDefinition, UserRoleRecord } from '@/types';
import { PolarisOptionDropdown } from '../PolarisOptionDropdown';

interface TransferOwnershipModalProps {
  open: boolean;
  onClose: () => void;
  onTransfer: (data: { targetCognitoSub: string; previousOwnerRoleId: string }) => Promise<void>;
  saving: boolean;
  currentUserId: string;
  users: UserRoleRecord[];
  roles: RoleDefinition[];
}

export function TransferOwnershipModal({
  open,
  onClose,
  onTransfer,
  saving,
  currentUserId,
  users,
  roles,
}: TransferOwnershipModalProps) {
  const [targetCognitoSub, setTargetCognitoSub] = useState('');
  const [previousOwnerRoleId, setPreviousOwnerRoleId] = useState('');

  const targetOptions = useMemo(
    () => users
      .filter((member) => member.status === 'activo' && member.cognitoSub !== currentUserId)
      .map((member) => ({
        label: `${member.displayName || member.email} (${member.email})`,
        value: member.cognitoSub,
      })),
    [currentUserId, users],
  );
  const fallbackOptions = useMemo(
    () => roles
      .filter((role) => role.name !== 'Propietario')
      .map((role) => ({ label: role.name, value: role.id, helpText: role.description || undefined })),
    [roles],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- reset modal form on open */
  useEffect(() => {
    if (!open) return;
    setTargetCognitoSub('');
    setPreviousOwnerRoleId(
      fallbackOptions.find((role) => role.label === 'Administrador')?.value
        ?? fallbackOptions[0]?.value
        ?? '',
    );
  }, [fallbackOptions, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transferir propiedad del negocio"
      primaryAction={{
        content: 'Transferir propiedad',
        destructive: true,
        loading: saving,
        disabled: !targetCognitoSub || !previousOwnerRoleId,
        onAction: () => onTransfer({ targetCognitoSub, previousOwnerRoleId }),
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner tone="warning" title="Este cambio modifica el control principal">
            <p>
              El nuevo propietario tendrá control total. Tu cuenta conservará únicamente el rol que selecciones abajo.
            </p>
          </Banner>
          <PolarisOptionDropdown
            label="Nuevo propietario"
            options={targetOptions}
            value={targetCognitoSub}
            onChange={setTargetCognitoSub}
            placeholder="Seleccionar miembro activo"
            helpText="Solo aparecen miembros activos de este negocio."
          />
          <PolarisOptionDropdown
            label="Tu rol después de la transferencia"
            options={fallbackOptions}
            value={previousOwnerRoleId}
            onChange={setPreviousOwnerRoleId}
            placeholder="Seleccionar rol"
          />
          {targetOptions.length === 0 && (
            <Text as="p" tone="critical">
              Agrega y confirma al menos otro miembro activo antes de transferir la propiedad.
            </Text>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
