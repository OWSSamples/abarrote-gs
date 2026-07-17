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
  Box,
  Icon,
  UnstyledButton,
} from '@shopify/polaris';
import { ProfileIcon, SettingsIcon, ExitIcon, SunIcon, MoonIcon, ChevronDownIcon } from '@shopify/polaris-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { useDashboardStore } from '@/store/dashboardStore';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { usePermissions } from '@/hooks/usePermissions';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const { roleName } = usePermissions();
  const [active, setActive] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  const toggleActive = useCallback(() => setActive((a) => !a), []);

  const handleToggleTheme = useCallback(() => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    document.documentElement.setAttribute('data-color-scheme', newMode);
    document.documentElement.setAttribute('data-theme', newMode);
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  if (!user) return null;

  const rawDisplayName = currentUserRole?.displayName || user.displayName || user.email?.split('@')[0] || 'Usuario';
  const displayName =
    rawDisplayName === 'ERROR'
      ? roleName === 'Propietario' || roleName === 'Administrador'
        ? 'Admin'
        : 'Usuario'
      : rawDisplayName;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarSource = currentUserRole?.avatarUrl || undefined;

  const getRoleBadgeTone = (): 'success' | 'info' | 'attention' => {
    if (roleName === 'Propietario' || roleName === 'Administrador') return 'success';
    if (roleName === 'Cajero') return 'info';
    return 'attention';
  };

  const roleLabel = roleName === 'Sin rol' ? 'Usuario' : roleName;

  const activator = (
    <UnstyledButton
      onClick={toggleActive}
      accessibilityLabel="Abrir menú de usuario"
      ariaExpanded={active}
      className="ctb-user-menu-trigger"
    >
      <Avatar initials={initials} size="sm" name={displayName} source={avatarSource} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            color: '#e3e5e7',
            fontSize: '13px',
            fontWeight: 500,
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </span>
        <Icon source={ChevronDownIcon} tone="inherit" />
      </div>
    </UnstyledButton>
  );

  return (
    <>
      <Popover
        active={active}
        activator={activator}
        autofocusTarget="first-node"
        onClose={toggleActive}
        preferredAlignment="right"
        zIndexOverride={200}
      >
        <div style={{ width: '280px' }}>
          {/* ── User Info Header ── */}
          <Box padding="400">
            <InlineStack gap="300" blockAlign="center">
              <Avatar initials={initials} size="lg" name={displayName} source={avatarSource} />
              <BlockStack gap="050">
                <Text as="h2" variant="headingSm" fontWeight="semibold">
                  {displayName}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {user.email}
                </Text>
                <Box paddingBlockStart="100">
                  <InlineStack gap="100">
                    <Badge tone={getRoleBadgeTone()} size="small">
                      {roleLabel}
                    </Badge>
                    {currentUserRole?.employeeNumber && (
                      <Badge tone="info" size="small">{`#${currentUserRole.employeeNumber}`}</Badge>
                    )}
                  </InlineStack>
                </Box>
              </BlockStack>
            </InlineStack>
          </Box>

          <Divider />

          {/* ── Menu Actions ── */}
          <ActionList
            actionRole="menuitem"
            sections={[
              {
                title: 'Cuenta',
                items: [
                  {
                    content: 'Mi perfil',
                    icon: ProfileIcon,
                    onAction: () => {
                      toggleActive();
                      setProfileModalOpen(true);
                    },
                  },
                  {
                    content: 'Configuración',
                    icon: SettingsIcon,
                    onAction: () => {
                      toggleActive();
                    },
                  },
                ],
              },
              {
                title: 'Preferencias',
                items: [
                  {
                    content: themeMode === 'light' ? 'Tema oscuro' : 'Tema claro',
                    icon: themeMode === 'light' ? MoonIcon : SunIcon,
                    onAction: handleToggleTheme,
                  },
                ],
              },
            ]}
          />

          <Divider />

          {/* ── Logout ── */}
          <ActionList
            actionRole="menuitem"
            items={[
              {
                content: 'Cerrar sesión',
                icon: ExitIcon,
                destructive: true,
                onAction: () => {
                  toggleActive();
                  signOut();
                },
              },
            ]}
          />
        </div>
      </Popover>

      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </>
  );
}
