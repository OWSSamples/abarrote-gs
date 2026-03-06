'use client';

import { useState, useCallback } from 'react';
import { 
  ActionList, 
  Popover, 
  Avatar, 
  Text, 
  InlineStack,
  BlockStack,
  Divider,
  Badge,
  Icon,
} from '@shopify/polaris';
import { 
  ProfileIcon,
  ImageIcon,
  PhoneIcon,
  LightbulbIcon,
  ExitIcon,
  EmailIcon,
  PersonIcon,
} from '@shopify/polaris-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { useDashboardStore } from '@/store/dashboardStore';
import { ProfileModal } from '@/components/modals/ProfileModal';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { currentUserRole } = useDashboardStore();
  const [active, setActive] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  const toggleActive = useCallback(() => setActive((a) => !a), []);

  const handleToggleTheme = useCallback(() => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    // Aquí puedes implementar el cambio de tema real
    document.documentElement.setAttribute('data-theme', newMode);
  }, [themeMode]);

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.charAt(0).toUpperCase() || 'U';

  // Detectar método de autenticación
  const getAuthProvider = () => {
    if (!user.providerData || user.providerData.length === 0) return 'Email';
    const providerId = user.providerData[0]?.providerId;
    if (providerId?.includes('google')) return 'Google';
    if (providerId?.includes('microsoft')) return 'Microsoft';
    if (providerId?.includes('password')) return 'Email';
    return 'Email';
  };

  const authProvider = getAuthProvider();

  const activator = (
    <button
      onClick={toggleActive}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 12px',
        borderRadius: '8px',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none';
      }}
    >
      <InlineStack gap="300" align="center" blockAlign="center">
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--p-color-bg-strong)',
            color: 'var(--p-color-text-on-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            fontSize: '16px',
          }}
        >
          {initials}
        </div>
        <div style={{ textAlign: 'left' }}>
          <Text as="p" variant="bodyMd" fontWeight="semibold" tone="inverse">
            {user.displayName || user.email?.split('@')[0] || 'Usuario'}
          </Text>
          {currentUserRole && (
            <Text as="p" variant="bodySm" tone="inverse">
              {currentUserRole.roleId === 'owner'
                ? 'Dueño'
                : currentUserRole.roleId === 'cashier'
                ? 'Cajero'
                : 'Usuario'}
            </Text>
          )}
        </div>
      </InlineStack>
    </button>
  );

  return (
    <>
      <Popover
        active={active}
        activator={activator}
        autofocusTarget="first-node"
        onClose={toggleActive}
        preferredAlignment="right"
      >
        <div style={{ width: '320px' }}>
          {/* Header del menú */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e1e3e5' }}>
            <InlineStack gap="300" align="start" blockAlign="center">
              <Avatar
                initials={initials}
                size="lg"
                name={user.displayName || user.email || 'User'}
                source={user.photoURL || undefined}
              />
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {user.displayName || 'Usuario'}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {user.email}
                </Text>
                <InlineStack gap="200">
                  <Badge tone="info">{authProvider}</Badge>
                  {currentUserRole && (
                    <Badge tone="success">
                      {currentUserRole.roleId === 'owner' ? 'Dueño' : 
                       currentUserRole.roleId === 'cashier' ? 'Cajero' : 'Usuario'}
                    </Badge>
                  )}
                </InlineStack>
              </BlockStack>
            </InlineStack>
          </div>

          {/* Opciones del menú */}
          <ActionList
            actionRole="menuitem"
            sections={[
              {
                items: [
                  {
                    content: 'Editar perfil',
                    icon: ProfileIcon,
                    onAction: () => {
                      toggleActive();
                      setProfileModalOpen(true);
                    },
                  },
                  {
                    content: 'Cambiar foto',
                    icon: ImageIcon,
                    onAction: () => {
                      toggleActive();
                      setProfileModalOpen(true);
                    },
                  },
                ],
              },
              {
                title: 'Información',
                items: [
                  {
                    content: user.email || 'Sin email',
                    icon: EmailIcon,
                    disabled: true,
                  },
                  {
                    content: currentUserRole?.employeeNumber || 'Sin número',
                    icon: PersonIcon,
                    disabled: true,
                    helpText: 'Número de empleado',
                  },
                  {
                    content: user.phoneNumber || 'Sin teléfono',
                    icon: PhoneIcon,
                    disabled: true,
                  },
                ],
              },
              {
                title: 'Preferencias',
                items: [
                  {
                    content: `Modo ${themeMode === 'light' ? 'oscuro' : 'claro'}`,
                    icon: LightbulbIcon,
                    onAction: handleToggleTheme,
                  },
                ],
              },
              {
                items: [
                  {
                    content: 'Cerrar sesión',
                    icon: ExitIcon,
                    destructive: true,
                    onAction: () => {
                      toggleActive();
                      signOut();
                    },
                  },
                ],
              },
            ]}
          />
        </div>
      </Popover>

      <ProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}