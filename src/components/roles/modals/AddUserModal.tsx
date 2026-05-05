'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, FormLayout, TextField, Select, Banner } from '@shopify/polaris';
import type { RoleDefinition } from '@/types';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    email: string;
    displayName: string;
    password: string;
    roleId: string;
    pinCode: string;
  }) => Promise<void>;
  saving: boolean;
  roleSelectOptions: { label: string; value: string }[];
  roleMap: Map<string, RoleDefinition>;
  defaultRoleId: string;
}

export function AddUserModal({
  open,
  onClose,
  onSave,
  saving,
  roleSelectOptions,
  roleMap,
  defaultRoleId,
}: AddUserModalProps) {
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoleId, setFormRoleId] = useState(defaultRoleId);
  const [formPinCode, setFormPinCode] = useState('');

  // Reset form when modal opens
  /* eslint-disable react-hooks/set-state-in-effect -- intentional form reset on open */
  useEffect(() => {
    if (open) {
      setFormEmail('');
      setFormDisplayName('');
      setFormPassword('');
      setFormRoleId(defaultRoleId);
      setFormPinCode('');
    }
  }, [open, defaultRoleId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSave = useCallback(() => {
    return onSave({
      email: formEmail,
      displayName: formDisplayName,
      password: formPassword,
      roleId: formRoleId,
      pinCode: formPinCode,
    });
  }, [onSave, formEmail, formDisplayName, formPassword, formRoleId, formPinCode]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Agregar usuario al sistema"
      primaryAction={{
        content: 'Asignar rol',
        onAction: handleSave,
        loading: saving,
        disabled: !formEmail.trim() || !formRoleId,
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: handleClose }]}
    >
      <Modal.Section>
        <FormLayout>
          <TextField
            label="Correo electronico"
            type="email"
            value={formEmail}
            onChange={setFormEmail}
            autoComplete="email"
            placeholder="cajero@mitienda.com"
            helpText="El correo con el que el usuario inicia sesión en Cognito"
          />
          <TextField
            label="Nombre (opcional)"
            value={formDisplayName}
            onChange={setFormDisplayName}
            autoComplete="name"
            placeholder="Juan Perez"
          />
          <TextField
            label="Contraseña"
            type="password"
            value={formPassword}
            onChange={setFormPassword}
            autoComplete="new-password"
            placeholder="Min. 6 caracteres"
            helpText="La contraseña inicial para que el usuario inicie sesión."
          />
          <Select label="Rol" options={roleSelectOptions} value={formRoleId} onChange={setFormRoleId} />
          <TextField
            label="PIN de Aprobación (Opcional)"
            type="password"
            value={formPinCode}
            onChange={setFormPinCode}
            autoComplete="off"
            maxLength={6}
            placeholder="Ej: 1234"
            helpText="PIN de 4 a 6 dígitos numéricos para autorizar anulaciones y mermas en mostrador."
          />
          {formRoleId && roleMap.get(formRoleId) && (
            <Banner tone="info">
              <p>
                <strong>{roleMap.get(formRoleId)!.name}:</strong> {roleMap.get(formRoleId)!.description}
              </p>
            </Banner>
          )}
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}
