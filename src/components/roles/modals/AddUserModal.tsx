'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, FormLayout, TextField, Select, Banner, Text } from '@shopify/polaris';
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

  const normalizedEmail = formEmail.trim().toLowerCase();
  const emailError = useMemo(() => {
    if (!formEmail.trim()) return undefined;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? undefined : 'Ingresa un correo válido.';
  }, [formEmail, normalizedEmail]);
  const passwordError = useMemo(() => {
    const password = formPassword.trim();
    if (!password) return undefined;
    return password.length >= 8 ? undefined : 'La contraseña debe tener mínimo 8 caracteres.';
  }, [formPassword]);
  const pinError = useMemo(() => {
    if (!formPinCode) return undefined;
    return /^\d{4,6}$/.test(formPinCode) ? undefined : 'El PIN debe tener de 4 a 6 dígitos numéricos.';
  }, [formPinCode]);
  const canSubmit = Boolean(normalizedEmail && formPassword.trim().length >= 8 && formRoleId && !emailError && !pinError);

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
      email: normalizedEmail,
      displayName: formDisplayName,
      password: formPassword,
      roleId: formRoleId,
      pinCode: formPinCode,
    });
  }, [onSave, normalizedEmail, formDisplayName, formPassword, formRoleId, formPinCode]);

  const handlePinChange = useCallback((value: string) => {
    setFormPinCode(value.replace(/\D/g, '').slice(0, 6));
  }, []);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Agregar usuario al sistema"
      primaryAction={{
        content: 'Crear usuario y asignar rol',
        onAction: handleSave,
        loading: saving,
        disabled: !canSubmit,
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: handleClose }]}
    >
      <Modal.Section>
        <FormLayout>
          <TextField
            label="Correo electrónico"
            type="email"
            value={formEmail}
            onChange={setFormEmail}
            autoComplete="email"
            placeholder="cajero@mitienda.com"
            helpText="El correo con el que el usuario inicia sesión en Cognito"
            error={emailError}
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
            placeholder="Mínimo 8 caracteres"
            helpText="Debe cumplir la política mínima del servidor y AWS Cognito."
            error={passwordError}
          />
          <Select label="Rol" options={roleSelectOptions} value={formRoleId} onChange={setFormRoleId} />
          <TextField
            label="PIN de Aprobación (Opcional)"
            type="password"
            value={formPinCode}
            onChange={handlePinChange}
            autoComplete="off"
            maxLength={6}
            placeholder="Ej: 1234"
            helpText="PIN de 4 a 6 dígitos numéricos para autorizar anulaciones y mermas en mostrador."
            error={pinError}
          />
          {formRoleId && roleMap.get(formRoleId) && (
            <Banner tone="info">
              <Text as="p" variant="bodySm">
                <strong>{roleMap.get(formRoleId)!.name}:</strong> {roleMap.get(formRoleId)!.description}
              </Text>
            </Banner>
          )}
          <Banner tone="warning">
            <Text as="p" variant="bodySm">
              Este flujo crea primero la identidad en AWS Cognito y después vincula el rol en PostgreSQL. Si la vinculación falla, el sistema revierte la cuenta en Cognito para evitar usuarios sin acceso local.
            </Text>
          </Banner>
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}
