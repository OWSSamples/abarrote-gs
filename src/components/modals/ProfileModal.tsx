'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
  Button,
  Icon,
} from '@shopify/polaris';
import {
  PersonIcon,
  LockIcon,
  LinkIcon,
  ClockIcon,
  HashtagIcon,
  CameraIcon,
  ChevronRightIcon,
} from '@shopify/polaris-icons';
import { uploadFile, getUserAvatarPath } from '@/lib/storage';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { signInWithRedirect } from '@/lib/cognito';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

type ProfileView = 'overview' | 'edit-name' | 'edit-photo' | 'link-accounts';

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth();
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const updateUserProfile = useDashboardStore((s) => s.updateUserProfile);
  const { roleName } = usePermissions();
  const { showSuccess, showError } = useToast();

  const [view, setView] = useState<ProfileView>('overview');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkingMicrosoft, setLinkingMicrosoft] = useState(false);

  useEffect(() => {
    if (open && currentUserRole) {
      setDisplayName(currentUserRole.displayName || user?.displayName || '');
      setAvatarUrl(currentUserRole.avatarUrl || '');
      setFile(null);
      setView('overview');
    }
  }, [open, currentUserRole, user]);

  const handleSaveName = useCallback(async () => {
    if (!user || !currentUserRole || !displayName.trim()) return;
    setSaving(true);
    try {
      await updateUserProfile(user.userId, { displayName: displayName.trim() });
      showSuccess('Nombre actualizado');
      setView('overview');
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }, [user, currentUserRole, displayName, updateUserProfile, showSuccess, showError]);

  const handleSavePhoto = useCallback(async () => {
    if (!user || !currentUserRole) return;
    setSaving(true);
    try {
      let newUrl = avatarUrl;
      if (file) {
        const path = getUserAvatarPath(user.userId, file.name);
        newUrl = await uploadFile(file, path);
      }
      await updateUserProfile(user.userId, {
        displayName: currentUserRole.displayName || displayName.trim(),
        avatarUrl: newUrl,
      });
      showSuccess('Foto actualizada');
      setFile(null);
      setView('overview');
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Error al subir la foto');
    } finally {
      setSaving(false);
    }
  }, [user, currentUserRole, displayName, avatarUrl, file, updateUserProfile, showSuccess, showError]);

  const handleLinkMicrosoft = useCallback(async () => {
    if (!user) return;
    setLinkingMicrosoft(true);
    try {
      // Cognito handles account linking via the Hosted UI OAuth flow.
      // If the user already exists, Cognito's Pre-Sign-Up Lambda trigger
      // can auto-link the federated identity.
      await signInWithRedirect({ provider: { custom: 'Microsoft' } });
    } catch (error: unknown) {
      console.error('Microsoft link error:', error);
      showError('Error al vincular con Microsoft.');
    } finally {
      setLinkingMicrosoft(false);
    }
  }, [user, showError]);

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => setFile(acceptedFiles[0]),
    [],
  );

  const initials = useMemo(() => {
    if (displayName) {
      return displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  }, [displayName, user?.email]);

  const authProvider = useMemo(() => {
    // Cognito doesn't expose providerData on the client.
    // We infer from the username format (Cognito federated users
    // have usernames like "Microsoft_<sub>").
    if (user?.username?.startsWith('Microsoft')) return 'Microsoft';
    if (user?.username?.startsWith('Google')) return 'Google';
    return 'Email';
  }, [user?.username]);

  const memberSince = useMemo(() => {
    if (!currentUserRole) return '—';
    return new Date(currentUserRole.createdAt).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [currentUserRole]);

  const previewSource = useMemo(() => {
    if (file) return window.URL.createObjectURL(file);
    return avatarUrl || undefined;
  }, [file, avatarUrl]);

  const getRoleTone = (): 'success' | 'info' | 'attention' => {
    if (currentUserRole?.roleId === 'owner') return 'success';
    if (currentUserRole?.roleId === 'cashier') return 'info';
    return 'attention';
  };

  const handleClose = useCallback(() => {
    setView('overview');
    onClose();
  }, [onClose]);

  // ─── Sub-view: Edit Name ───
  if (view === 'edit-name') {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Editar nombre"
        primaryAction={{
          content: 'Guardar',
          onAction: handleSaveName,
          loading: saving,
          disabled: !displayName.trim(),
        }}
        secondaryActions={[{ content: 'Regresar', onAction: () => setView('overview') }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Nombre completo"
              value={displayName}
              onChange={setDisplayName}
              autoComplete="name"
              placeholder="Tu nombre completo"
              requiredIndicator
              maxLength={100}
              showCharacterCount
              disabled={saving}
              autoFocus
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    );
  }

  // ─── Sub-view: Edit Photo ───
  if (view === 'edit-photo') {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Cambiar foto de perfil"
        primaryAction={{
          content: 'Guardar foto',
          onAction: handleSavePhoto,
          loading: saving,
          disabled: !file,
        }}
        secondaryActions={[
          {
            content: 'Regresar',
            onAction: () => {
              setFile(null);
              setView('overview');
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <InlineStack align="center">
              <Avatar size="xl" name={displayName} initials={initials} source={previewSource} />
            </InlineStack>
            <DropZone onDrop={handleDropZoneDrop} variableHeight accept="image/*" type="image" disabled={saving}>
              {file ? (
                <Box padding="300">
                  <InlineStack gap="300" blockAlign="center">
                    <Thumbnail size="small" alt={file.name} source={window.URL.createObjectURL(file)} />
                    <BlockStack gap="050">
                      <Text as="span" variant="bodySm" fontWeight="medium">
                        {file.name}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {`${(file.size / 1024).toFixed(0)} KB`}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              ) : (
                <DropZone.FileUpload actionTitle="Seleccionar imagen" actionHint="JPG, PNG o GIF — máximo 2 MB" />
              )}
            </DropZone>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // ─── Sub-view: Link Accounts ───
  if (view === 'link-accounts') {
    const hasMicrosoft = authProvider === 'Microsoft';
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Cuentas vinculadas"
        secondaryActions={[{ content: 'Regresar', onAction: () => setView('overview') }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodySm" tone="subdued">
              Vincula proveedores de autenticación adicionales a tu cuenta. Podrás iniciar sesión con cualquiera de
              ellos.
            </Text>

            <Box borderStyle="solid" borderWidth="025" borderColor="border" borderRadius="300">
              {/* Email provider */}
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Box padding="200" background="bg-fill-success-secondary" borderRadius="200">
                      <Icon source={LockIcon} tone="success" />
                    </Box>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        Correo electrónico
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {user?.email}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Badge tone="success">Principal</Badge>
                </InlineStack>
              </Box>

              <Divider />

              {/* Microsoft provider */}
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Box
                      padding="200"
                      background={hasMicrosoft ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                      borderRadius="200"
                    >
                      <Icon source={LinkIcon} tone={hasMicrosoft ? 'success' : 'subdued'} />
                    </Box>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        Microsoft
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {hasMicrosoft ? 'Cuenta vinculada' : 'No vinculada'}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  {hasMicrosoft ? (
                    <Badge tone="success">Vinculada</Badge>
                  ) : (
                    <Button size="slim" onClick={handleLinkMicrosoft} loading={linkingMicrosoft}>
                      Vincular
                    </Button>
                  )}
                </InlineStack>
              </Box>
            </Box>
          </BlockStack>
        </Modal.Section>

        <Modal.Section>
          <Banner tone="info" title="Cambiar contraseña">
            <p>
              Cierra sesión y selecciona &quot;Olvidé mi contraseña&quot; en la pantalla de inicio para restablecerla.
            </p>
          </Banner>
        </Modal.Section>
      </Modal>
    );
  }

  // ─── Main overview view ───
  return (
    <Modal open={open} onClose={handleClose} title="Mi perfil">
      {/* ── Hero: Avatar + Identity ── */}
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            <div
              style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => setView('edit-photo')}
            >
              <Avatar size="xl" name={displayName} initials={initials} source={previewSource} />
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--p-color-bg-fill-emphasis)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--p-color-bg-surface)',
                }}
              >
                <div style={{ display: 'flex', color: 'var(--p-color-text-inverse)' }}>
                  <Icon source={CameraIcon} tone="inherit" />
                </div>
              </div>
            </div>

            <BlockStack gap="100">
              <Text as="h2" variant="headingLg" fontWeight="bold">
                {displayName || 'Sin nombre'}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {user?.email || ''}
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Badge tone={getRoleTone()}>{roleName}</Badge>
                {currentUserRole?.employeeNumber && <Badge tone="info">{currentUserRole.employeeNumber}</Badge>}
              </InlineStack>
            </BlockStack>
          </InlineStack>
        </BlockStack>
      </Modal.Section>

      {/* ── Personal Information ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text variant="headingSm" as="h3">
            Información personal
          </Text>

          <Box borderStyle="solid" borderWidth="025" borderColor="border" borderRadius="300">
            {/* Name row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setView('edit-name')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setView('edit-name');
              }}
              style={{ cursor: 'pointer' }}
            >
              <Box padding="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Box padding="200" background="bg-fill-success-secondary" borderRadius="200">
                      <Icon source={PersonIcon} tone="success" />
                    </Box>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Nombre completo
                      </Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {displayName || '—'}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Icon source={ChevronRightIcon} tone="subdued" />
                </InlineStack>
              </Box>
            </div>

            <Divider />

            {/* Email row */}
            <Box padding="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Box padding="200" background="bg-fill-success-secondary" borderRadius="200">
                    <Icon source={LockIcon} tone="success" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Correo electrónico
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {user?.email || '—'}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Badge tone="info">Verificado</Badge>
              </InlineStack>
            </Box>

            <Divider />

            {/* Employee number */}
            <Box padding="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Box
                    padding="200"
                    background={currentUserRole?.employeeNumber ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                    borderRadius="200"
                  >
                    <Icon source={HashtagIcon} tone={currentUserRole?.employeeNumber ? 'success' : 'subdued'} />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Número de empleado
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {currentUserRole?.employeeNumber || 'Sin asignar'}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </InlineStack>
            </Box>
          </Box>
        </BlockStack>
      </Modal.Section>

      {/* ── Account & Security ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text variant="headingSm" as="h3">
            Cuenta y seguridad
          </Text>

          <Box borderStyle="solid" borderWidth="025" borderColor="border" borderRadius="300">
            {/* Role */}
            <Box padding="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Box padding="200" background="bg-fill-success-secondary" borderRadius="200">
                    <Icon source={PersonIcon} tone="success" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Rol en el sistema
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {roleName}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Badge tone={getRoleTone()}>{roleName}</Badge>
              </InlineStack>
            </Box>

            <Divider />

            {/* Auth / Linked accounts */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setView('link-accounts')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setView('link-accounts');
              }}
              style={{ cursor: 'pointer' }}
            >
              <Box padding="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Box
                      padding="200"
                      background={authProvider !== 'Email' ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                      borderRadius="200"
                    >
                      <Icon source={LinkIcon} tone={authProvider !== 'Email' ? 'success' : 'subdued'} />
                    </Box>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Cuentas vinculadas
                      </Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {authProvider}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="info">{authProvider}</Badge>
                    <Icon source={ChevronRightIcon} tone="subdued" />
                  </InlineStack>
                </InlineStack>
              </Box>
            </div>

            <Divider />

            {/* Member since */}
            <Box padding="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Box padding="200" background="bg-fill-success-secondary" borderRadius="200">
                    <Icon source={ClockIcon} tone="success" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Miembro desde
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {memberSince}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </InlineStack>
            </Box>
          </Box>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
