'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, FormLayout, TextField, Text, Badge, Banner } from '@shopify/polaris';
import type { RoleDefinition, UserRoleRecord } from '@/types';
import { PolarisOptionDropdown } from '../PolarisOptionDropdown';

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  selectedUser: UserRoleRecord | null;
  onSave: (data: { roleId: string; pinCode: string }) => Promise<void>;
  saving: boolean;
  roleSelectOptions: { label: string; value: string }[];
  roleMap: Map<string, RoleDefinition>;
}

export function EditUserModal({
  open,
  onClose,
  selectedUser,
  onSave,
  saving,
  roleSelectOptions,
  roleMap,
}: EditUserModalProps) {
  const [editRoleId, setEditRoleId] = useState('');
  const [editPinCode, setEditPinCode] = useState('');

  // Sync internal state when selectedUser changes
  /* eslint-disable react-hooks/set-state-in-effect -- prop-derived state sync */
  useEffect(() => {
    if (selectedUser) {
      setEditRoleId(selectedUser.roleId);
      setEditPinCode('');
    }
  }, [selectedUser]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pinError = useMemo(() => {
    if (!editPinCode) return undefined;
    return /^\d{4,6}$/.test(editPinCode) ? undefined : 'El PIN debe tener de 4 a 6 dígitos numéricos.';
  }, [editPinCode]);

  const handlePinChange = useCallback((value: string) => {
    setEditPinCode(value.replace(/\D/g, '').slice(0, 6));
  }, []);

  const handleSave = useCallback(() => {
    return onSave({ roleId: editRoleId, pinCode: editPinCode });
  }, [onSave, editRoleId, editPinCode]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cambiar rol de ${selectedUser?.displayName || selectedUser?.email || ''}`}
      primaryAction={{
        content: 'Guardar cambio',
        onAction: handleSave,
        loading: saving,
        disabled: !editRoleId || Boolean(pinError),
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: onClose }]}
    >
      <Modal.Section>
        <FormLayout>
          <Text as="p">
            Correo: <strong>{selectedUser?.email}</strong>
          </Text>
          <Text as="p">
            Rol actual: <Badge tone="info">{roleMap.get(selectedUser?.roleId ?? '')?.name || 'Sin rol'}</Badge>
          </Text>
          <PolarisOptionDropdown
            label="Nuevo rol"
            options={roleSelectOptions}
            value={editRoleId}
            onChange={setEditRoleId}
            placeholder="Seleccionar rol"
          />
          <TextField
            label="Cambiar o Establecer PIN de Aprobación"
            type="password"
            value={editPinCode}
            onChange={handlePinChange}
            autoComplete="off"
            maxLength={6}
            placeholder="Ej: 1234"
            helpText={selectedUser?.pinCode ? 'Déjalo vacío para conservar el PIN actual. Captura 4 a 6 dígitos si deseas reemplazarlo.' : 'Captura 4 a 6 dígitos si este usuario debe autorizar bloqueos, mermas o cortes.'}
            error={pinError}
          />
          {editRoleId && roleMap.get(editRoleId) && (
            <Banner tone="info">
              <p>
                <strong>{roleMap.get(editRoleId)!.name}:</strong> {roleMap.get(editRoleId)!.description}
              </p>
            </Banner>
          )}
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}
