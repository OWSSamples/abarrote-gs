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
} from '@shopify/polaris';
import {
  SettingsIcon,
  ExitIcon,
  LightbulbIcon,
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

    // Shopify Polaris Theme Variable (CSS vars approach)
    document.documentElement.setAttribute('data-color-scheme', newMode);
    document.documentElement.setAttribute('data-theme', newMode);

    // Tailwind / Shadcn UI Dark Mode
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  if (!user) return null;

  const displayName = user.displayName || user.email?.split('@')[0] || 'Usuario';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const getRoleBadgeTone = () => {
    if (currentUserRole?.roleId === 'owner') return 'success';
    if (currentUserRole?.roleId === 'cashier') return 'info';
    return 'new'; // 'new' is usually purple in Polaris, looks professional
  };

  const roleLabel = currentUserRole?.roleId === 'owner' ? 'Administrador' :
    currentUserRole?.roleId === 'cashier' ? 'Cajero' : 'Usuario';

  const activator = (
    <button
      onClick={toggleActive}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 12px',
        borderRadius: '24px',
        transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
        display: 'flex',
        alignItems: 'center',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none';
      }}
      aria-label="Abrir menú de usuario"
    >
      <InlineStack gap="200" align="center" blockAlign="center">
        <div style={{
          backgroundColor: '#008080',
          borderRadius: '4px',
          padding: '2px 8px',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '24px',
          minWidth: '32px'
        }}>
          {initials}
        </div>
        <Text as="span" variant="bodyMd" fontWeight="semibold" tone="text-inverse">
          {displayName.toUpperCase()}
        </Text>
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
        zIndexOverride={100}
      >
        <div style={{ width: '320px' }}>
          {/* Header Card Aspect */}
          <Box padding="400" background="bg-surface-secondary">
            <BlockStack gap="400">
              <InlineStack gap="300" align="start" blockAlign="center">
                <Avatar
                  initials={initials}
                  size="lg"
                  name={displayName}
                  source={user.photoURL || undefined}
                />
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    {displayName}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {user.email}
                  </Text>
                  <Box paddingBlockStart="100">
                    <InlineStack gap="200">
                      <Badge tone={getRoleBadgeTone()}>{roleLabel}</Badge>
                      {currentUserRole?.employeeNumber && (
                        <Badge tone="info">{`#${currentUserRole.employeeNumber}`}</Badge>
                      )}
                    </InlineStack>
                  </Box>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Box>

          <Divider />

          {/* Quick Actions / Navigation */}
          <Box padding="200">
            <ActionList
              actionRole="menuitem"
              sections={[
                {
                  items: [
                    {
                      content: 'Configuración de perfil',
                      icon: SettingsIcon,
                      onAction: () => {
                        toggleActive();
                        setProfileModalOpen(true);
                      },
                    },
                    {
                      content: `Tema ${themeMode === 'light' ? 'oscuro' : 'claro'}`,
                      icon: LightbulbIcon,
                      onAction: handleToggleTheme,
                      helpText: 'Cambia el aspecto visual al instante',
                    },
                  ],
                },
              ]}
            />
          </Box>

          <Divider />

          <Box padding="200">
            <ActionList
              actionRole="menuitem"
              sections={[
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
          </Box>
        </div>
      </Popover>

      <ProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}