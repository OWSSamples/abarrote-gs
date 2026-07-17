'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  BlockStack,
  Button,
  Divider,
  InlineGrid,
  InlineStack,
  Modal,
  Text,
  TextField,
} from '@shopify/polaris';
import type { RoleDefinition } from '@/types';
import { PolarisOptionDropdown } from '../PolarisOptionDropdown';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { email: string; roleId: string }) => Promise<void>;
  saving: boolean;
  roleSelectOptions: { label: string; value: string }[];
  roleMap: Map<string, RoleDefinition>;
  defaultRoleId: string;
  onCreateRole: () => void;
}

export function AddUserModal({
  open,
  onClose,
  onSave,
  saving,
  roleSelectOptions,
  roleMap,
  defaultRoleId,
  onCreateRole,
}: AddUserModalProps) {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(defaultRoleId);
  const normalizedEmail = email.trim().toLowerCase();
  const emailError = useMemo(() => {
    if (!email.trim()) return undefined;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ? undefined
      : 'Ingresa un correo válido.';
  }, [email, normalizedEmail]);
  const selectedRole = roleId ? roleMap.get(roleId) : undefined;
  const hasAssignableRoles = roleSelectOptions.length > 0;
  const canSubmit = Boolean(hasAssignableRoles && normalizedEmail && roleId && !emailError);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRoleId(defaultRoleId);
  }, [defaultRoleId, open]);

  const handleSave = useCallback(() => {
    if (!canSubmit) return Promise.resolve();
    return onSave({ email: normalizedEmail, roleId });
  }, [canSubmit, normalizedEmail, onSave, roleId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invitar usuario al negocio"
      size="large"
      primaryAction={{
        content: hasAssignableRoles ? 'Enviar invitación' : 'Crea un rol primero',
        onAction: handleSave,
        loading: saving,
        disabled: !canSubmit,
      }}
      secondaryActions={[
        ...(hasAssignableRoles ? [] : [{ content: 'Crear rol', onAction: onCreateRole }]),
        { content: 'Cancelar', onAction: onClose },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="500">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd">Acceso mediante invitación</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              El destinatario conservará su cuenta y deberá aceptar el acceso con el mismo correo.
            </Text>
          </BlockStack>

          {!hasAssignableRoles && (
            <Banner tone="warning" title="No hay roles asignables">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Crea un rol con los permisos necesarios antes de invitar integrantes.
                </Text>
                <div>
                  <Button variant="primary" onClick={onCreateRole}>Crear rol</Button>
                </div>
              </BlockStack>
            </Banner>
          )}

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="500">
            <TextField
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="colaborador@empresa.com"
              helpText="La invitación vence en 48 horas y solo funciona con este correo."
              error={emailError}
              disabled={!hasAssignableRoles || saving}
            />

            <BlockStack gap="200">
              <PolarisOptionDropdown
                label="Rol dentro del negocio"
                options={hasAssignableRoles ? roleSelectOptions : []}
                value={roleId}
                onChange={setRoleId}
                disabled={!hasAssignableRoles || saving}
                placeholder="Seleccionar rol"
                helpText="Los permisos se aplicarán únicamente en este negocio."
              />
              {selectedRole && (
                <BlockStack gap="100">
                  <InlineStack align="space-between" gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">{selectedRole.name}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {selectedRole.permissions.length} permisos
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {selectedRole.description || 'Rol sin descripción.'}
                  </Text>
                </BlockStack>
              )}
            </BlockStack>
          </InlineGrid>

          <Divider />
          <Text as="p" variant="bodySm" tone="subdued">
            La invitación no modifica la contraseña, MFA ni los accesos que la persona tenga en otros negocios.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
