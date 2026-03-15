'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  BlockStack,
  InlineStack,
  Text,
  Box,
  DropZone,
  Thumbnail,
  Avatar,
  Badge,
  Banner,
  Divider,
  Button
} from '@shopify/polaris';
import { ImageIcon, EmailIcon, PersonIcon, PhoneIcon } from '@shopify/polaris-icons';
import { uploadFile, getUserAvatarPath } from '@/lib/storage';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePermissions } from '@/lib/usePermissions';
import { OAuthProvider, linkWithPopup } from 'firebase/auth';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth();
  const { currentUserRole, updateUserProfile } = useDashboardStore();
  const { roleName } = usePermissions();
  const { showSuccess, showError } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && currentUserRole) {
      const newDisplayName = currentUserRole.displayName || user?.displayName || '';
      const newAvatarUrl = currentUserRole.avatarUrl || user?.photoURL || '';
      setDisplayName(newDisplayName);
      setAvatarUrl(newAvatarUrl);
      setPhoneNumber(user?.phoneNumber || '');
    }
  }, [open, currentUserRole, user]);

  const handleSave = useCallback(async () => {
    if (!user || !currentUserRole) return;
    if (!displayName.trim()) {
      showError('El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (file) {
        const path = getUserAvatarPath(user.uid, file.name);
        finalAvatarUrl = await uploadFile(file, path);
      }

      await updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        avatarUrl: finalAvatarUrl.trim(),
      });
      showSuccess('Perfil actualizado correctamente');
      setFile(null);
      onClose();
    } catch {
      showError('Error al actualizar el perfil');
    }
    setSaving(false);
  }, [user, currentUserRole, displayName, avatarUrl, file, updateUserProfile, showSuccess, showError, onClose]);

  const handleLinkMicrosoft = useCallback(async () => {
    if (!user) return;
    try {
      const provider = new OAuthProvider('microsoft.com');
      const customParams: Record<string, string> = { prompt: 'select_account' };
      if (process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID) {
        customParams.tenant = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID;
      }
      provider.setCustomParameters(customParams);
      await linkWithPopup(user, provider);
      showSuccess('Cuenta de Microsoft vinculada correctamente');
    } catch (error: any) {
      console.error('Error linking Microsoft:', error);
      if (error?.code === 'auth/credential-already-in-use') {
        showError('Esta cuenta de Microsoft ya está ligada a otro usuario.');
      } else {
        showError('Error al vincular con Microsoft.');
      }
    }
  }, [user, showSuccess, showError]);

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) =>
      setFile(acceptedFiles[0]),
    [],
  );

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || 'U';

  // Detectar proveedor de autenticación
  const getAuthProvider = () => {
    if (!user?.providerData || user.providerData.length === 0) return 'Email';
    const providerId = user.providerData[0]?.providerId;
    if (providerId?.includes('google')) return 'Google';
    if (providerId?.includes('microsoft')) return 'Microsoft';
    if (providerId?.includes('password')) return 'Email';
    return 'Email';
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configuración de perfil"
      primaryAction={{
        content: 'Guardar cambios',
        onAction: handleSave,
        loading: saving,
        disabled: !displayName.trim(),
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: onClose }]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="600">
          {/* Header con avatar */}
          <InlineStack align="space-between" blockAlign="start">
            <InlineStack gap="400" blockAlign="center">
              <Avatar
                size="xl"
                name={displayName}
                initials={initials}
                source={file ? window.URL.createObjectURL(file) : avatarUrl}
              />
              <Box minWidth="250px">
                <DropZone
                  onDrop={handleDropZoneDrop}
                  variableHeight
                  label="Cambiar foto de perfil"
                  accept="image/*"
                  type="image"
                  disabled={saving}
                >
                  {!file && <DropZone.FileUpload actionTitle="Subir nueva foto" actionHint="JPG, PNG o GIF" />}
                  {file && (
                    <div style={{ padding: '8px' }}>
                      <InlineStack gap="200" blockAlign="center">
                        <Thumbnail size="small" alt={file.name} source={window.URL.createObjectURL(file)} />
                        <Text variant="bodySm" as="span">{file.name}</Text>
                      </InlineStack>
                    </div>
                  )}
                </DropZone>
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">{displayName || 'Sin nombre'}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{user?.email}</Text>
                <InlineStack gap="200">
                  <Badge tone="success" progress="complete">{roleName}</Badge>
                  <Badge tone="info">{getAuthProvider()}</Badge>
                </InlineStack>
              </BlockStack>
            </InlineStack>
          </InlineStack>

          <Divider />

          {/* Información personal */}
          <BlockStack gap="400">
            <Text as="h3" variant="headingMd">Información personal</Text>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Nombre completo"
                  value={displayName}
                  onChange={setDisplayName}
                  autoComplete="name"
                  placeholder="Ingresa tu nombre completo"
                  requiredIndicator
                />
                <TextField
                  label="Correo electrónico"
                  value={user?.email || ''}
                  disabled
                  autoComplete="email"
                  helpText="No se puede modificar"
                />
              </FormLayout.Group>

              <FormLayout.Group>
                <TextField
                  label="Número de empleado"
                  value={currentUserRole?.employeeNumber || 'Sin asignar'}
                  disabled
                  autoComplete="off"
                  helpText="Asignado por el administrador"
                />
                <TextField
                  label="Teléfono"
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  type="tel"
                  autoComplete="tel"
                  placeholder="+52 123 456 7890"
                  disabled
                  helpText="Contacta al administrador para actualizar"
                />
              </FormLayout.Group>
            </FormLayout>
          </BlockStack>

          <Divider />

          {/* Foto de perfil */}
          <BlockStack gap="400">
            <Text as="h3" variant="headingMd">Foto de perfil</Text>
            <TextField
              label="URL de la imagen"
              value={avatarUrl}
              onChange={setAvatarUrl}
              autoComplete="off"
              placeholder="https://ejemplo.com/foto.jpg"
              helpText="Puedes usar servicios como Gravatar, Imgur o subir tu imagen a cualquier hosting"
            />
            {avatarUrl && (
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <InlineStack gap="300" blockAlign="center">
                  <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden' }}>
                    <img
                      src={avatarUrl}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                      }}
                    />
                  </div>
                  <Text as="p" variant="bodySm" tone="subdued">Vista previa de tu foto</Text>
                </InlineStack>
              </Box>
            )}
          </BlockStack>

          <Divider />

          {/* Información de cuenta */}
          <BlockStack gap="400">
            <Text as="h3" variant="headingMd">Información de cuenta</Text>
            <Box padding="400" background="bg-surface-secondary" borderRadius="300">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodyMd" tone="subdued">Rol en el sistema</Text>
                  <Badge tone="success" size="large">{roleName}</Badge>
                </InlineStack>

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodyMd" tone="subdued">Método de autenticación</Text>
                  <InlineStack gap="200" align="center">
                    <Badge tone="info" size="large">{getAuthProvider()}</Badge>
                    {getAuthProvider() !== 'Microsoft' && (
                      <Button size="micro" onClick={handleLinkMicrosoft}>
                        Vincular Microsoft
                      </Button>
                    )}
                  </InlineStack>
                </InlineStack>

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodyMd" tone="subdued">Miembro desde</Text>
                  <Text as="span" variant="bodyMd" fontWeight="medium">
                    {currentUserRole
                      ? new Date(currentUserRole.createdAt).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                      : '—'}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Box>
          </BlockStack>

          {/* Banner informativo */}
          <Banner tone="info">
            <p>
              <strong>Cambiar contraseña:</strong> Cierra sesión y usa la opción "Olvidé mi contraseña"
              en la pantalla de inicio de sesión.
            </p>
          </Banner>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
