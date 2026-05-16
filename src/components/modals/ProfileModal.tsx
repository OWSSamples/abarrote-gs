'use client';

import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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
  Card,
  Icon,
} from '@shopify/polaris';
import {
  PersonIcon,
  LockIcon,
  ShieldCheckMarkIcon,
  LinkIcon,
  ClockIcon,
  HashtagIcon,
  CameraIcon,
} from '@shopify/polaris-icons';
import { uploadFile, getUserAvatarPath } from '@/lib/storage';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
// Note: signInWithRedirect is imported dynamically inside handleLinkMicrosoft
// to avoid evaluating aws-amplify at module load time.

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

type ProfileView = 'overview' | 'edit-name' | 'edit-photo' | 'link-accounts';

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const router = useRouter();
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
      // Dynamic import keeps aws-amplify out of the initial bundle.
      const { signInWithRedirect } = await import('@/lib/cognito');
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

  const handleOpenSecuritySettings = useCallback(() => {
    handleClose();
    router.push('/dashboard/profile/security');
  }, [handleClose, router]);

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
            <Text as="p" variant="bodySm">
              Cierra sesión y selecciona &quot;Olvidé mi contraseña&quot; en la pantalla de inicio para restablecerla.
            </Text>
          </Banner>
        </Modal.Section>
      </Modal>
    );
  }

  // ─── Main overview view ───
  return (
    <Modal open={open} onClose={handleClose} title="Mi perfil">
      <Modal.Section>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
                <InlineStack gap="300" blockAlign="center" wrap={false}>
                  <Box
                    padding="150"
                    background="bg-fill-info-secondary"
                    borderRadius="300"
                    borderColor="border-info"
                    borderWidth="025"
                  >
                    <Avatar size="lg" name={displayName} initials={initials} source={previewSource} />
                  </Box>
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd" fontWeight="bold">
                      {displayName || 'Sin nombre'}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued" breakWord>
                      {user?.email || 'Correo no disponible'}
                    </Text>
                    <InlineStack gap="100" wrap>
                      <Badge tone={getRoleTone()}>{roleName}</Badge>
                      <Badge tone="success">Correo verificado</Badge>
                      {currentUserRole?.employeeNumber && <Badge tone="info">{currentUserRole.employeeNumber}</Badge>}
                    </InlineStack>
                  </BlockStack>
                </InlineStack>
                <InlineStack gap="200" wrap>
                  <Button icon={CameraIcon} onClick={() => setView('edit-photo')}>
                    Foto
                  </Button>
                  <Button variant="primary" icon={ShieldCheckMarkIcon} onClick={handleOpenSecuritySettings}>
                    Seguridad
                  </Button>
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3">
                  Información personal
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Datos visibles para auditoría, turnos y permisos internos.
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <ProfileInfoRow
                  icon={PersonIcon}
                  iconTone="success"
                  title="Nombre completo"
                  value={displayName || 'Sin nombre'}
                  action={{ content: 'Editar', onAction: () => setView('edit-name') }}
                />
                <ProfileInfoRow
                  icon={LockIcon}
                  iconTone="success"
                  title="Correo electrónico"
                  value={user?.email || '—'}
                  badge={{ content: 'Verificado', tone: 'success' }}
                />
                <ProfileInfoRow
                  icon={HashtagIcon}
                  iconTone={currentUserRole?.employeeNumber ? 'success' : 'subdued'}
                  title="Número de empleado"
                  value={currentUserRole?.employeeNumber || 'Sin asignar'}
                />
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3">
                  Cuenta y seguridad
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Controles personales de acceso, 2FA/MFA y proveedores vinculados.
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <ProfileInfoRow
                  icon={ShieldCheckMarkIcon}
                  iconTone="success"
                  title="Seguridad del perfil"
                  value="2FA/MFA y recovery codes"
                  badge={{ content: 'Personal', tone: 'info' }}
                  action={{ content: 'Configurar', onAction: handleOpenSecuritySettings, primary: true }}
                />
                <ProfileInfoRow
                  icon={LinkIcon}
                  iconTone={authProvider !== 'Email' ? 'success' : 'subdued'}
                  title="Cuentas vinculadas"
                  value={authProvider}
                  badge={{ content: authProvider, tone: authProvider !== 'Email' ? 'success' : 'info' }}
                  action={{ content: 'Administrar', onAction: () => setView('link-accounts') }}
                />
                <ProfileInfoRow
                  icon={ClockIcon}
                  iconTone="success"
                  title="Miembro desde"
                  value={memberSince}
                />
              </BlockStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

type ProfileIconSource = typeof PersonIcon;
type ProfileBadgeTone = 'success' | 'info' | 'attention' | 'warning' | 'critical';
type ProfileIconTone = 'success' | 'info' | 'subdued' | 'base' | 'critical';

function ProfileInfoRow({
  icon,
  iconTone,
  title,
  value,
  badge,
  action,
}: {
  icon: ProfileIconSource;
  iconTone: ProfileIconTone;
  title: string;
  value: ReactNode;
  badge?: { content: string; tone: ProfileBadgeTone };
  action?: { content: string; onAction: () => void; primary?: boolean };
}) {
  return (
    <Box background="bg-surface-secondary" borderColor="border" borderRadius="300" borderWidth="025" padding="300">
      <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Box
            padding="200"
            background={iconTone === 'success' ? 'bg-fill-success-secondary' : 'bg-surface'}
            borderRadius="200"
            borderColor="border"
            borderWidth="025"
          >
            <Icon source={icon} tone={iconTone} />
          </Box>
          <BlockStack gap="050">
            <Text as="span" variant="bodySm" tone="subdued">
              {title}
            </Text>
            <Text as="span" variant="bodyMd" fontWeight="semibold" breakWord>
              {value}
            </Text>
          </BlockStack>
        </InlineStack>

        <InlineStack gap="200" blockAlign="center" wrap>
          {badge && <Badge tone={badge.tone}>{badge.content}</Badge>}
          {action && (
            <Button size="slim" variant={action.primary ? 'primary' : undefined} onClick={action.onAction}>
              {action.content}
            </Button>
          )}
        </InlineStack>
      </InlineStack>
    </Box>
  );
}
