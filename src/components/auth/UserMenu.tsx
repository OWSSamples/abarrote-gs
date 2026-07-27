'use client';

import { useCallback, useMemo, useState } from 'react';
import { Icon, Popover, UnstyledButton } from '@shopify/polaris';
import {
  ChevronDownIcon,
  CodeIcon,
  ExitIcon,
  PlusCircleIcon,
  QuestionCircleIcon,
} from '@shopify/polaris-icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { HelpDrawer } from '@/components/support/HelpDrawer';
import { useDashboardStore } from '@/store/dashboardStore';

function getStoreInitials(storeName: string): string {
  const initials = storeName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/^\d+$/.test(word) ? word : word[0]))
    .join('')
    .toUpperCase()
    .slice(0, 3);

  return initials || 'TN';
}

export function UserMenu() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const activeStoreId = useDashboardStore((state) => state.activeStoreId);
  const stores = useDashboardStore((state) => state.stores);
  const configuredStoreName = useDashboardStore((state) => state.storeConfig.storeName);
  const [active, setActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const storeName = useMemo(
    () => stores.find((store) => store.id === activeStoreId)?.name || configuredStoreName || 'Mi tienda',
    [activeStoreId, configuredStoreName, stores],
  );
  const storeInitials = useMemo(() => getStoreInitials(storeName), [storeName]);

  const toggleActive = useCallback(() => setActive((isActive) => !isActive), []);
  const closeMenu = useCallback(() => setActive(false), []);

  if (!user) return null;

  const handleCreateStore = () => {
    closeMenu();
    router.push('/auth/register?mode=additional');
  };

  const handleOpenHelp = () => {
    closeMenu();
    setHelpOpen(true);
  };

  const handleSignOut = () => {
    closeMenu();
    void signOut();
  };

  const activator = (
    <UnstyledButton
      onClick={toggleActive}
      accessibilityLabel="Abrir menú del negocio"
      ariaExpanded={active}
      className="ctb-workspace-menu-trigger"
    >
      <span className="ctb-workspace-initials" aria-hidden="true">
        {storeInitials}
      </span>
      <span className="ctb-workspace-trigger-label">{storeName}</span>
      <Icon source={ChevronDownIcon} tone="inherit" />
    </UnstyledButton>
  );

  return (
    <>
      <Popover
        active={active}
        activator={activator}
        autofocusTarget="first-node"
        onClose={closeMenu}
        preferredAlignment="right"
        zIndexOverride={200}
      >
        <div className="ctb-workspace-menu">
          <div className="ctb-workspace-store-row" aria-current="true">
            <span className="ctb-workspace-initials ctb-workspace-initials--large" aria-hidden="true">
              {storeInitials}
            </span>
            <span className="ctb-workspace-store-name">{storeName}</span>
            <span className="ctb-workspace-code" aria-label="Negocio actual">
              <Icon source={CodeIcon} tone="subdued" />
            </span>
          </div>

          <button type="button" className="ctb-workspace-row" onClick={handleCreateStore}>
            <span className="ctb-workspace-row-content">
              <Icon source={PlusCircleIcon} tone="subdued" />
              <span>Crear tienda</span>
            </span>
          </button>

          <div className="ctb-workspace-divider" />

          <div className="ctb-workspace-account" title={user.email}>
            <span className="ctb-workspace-account-mark" aria-hidden="true">
              <img src="/login-brand.svg" alt="" />
            </span>
            <span className="ctb-workspace-account-email">{user.email || user.username}</span>
          </div>

          <button type="button" className="ctb-workspace-row" onClick={handleOpenHelp}>
            <span className="ctb-workspace-row-content">
              <Icon source={QuestionCircleIcon} tone="subdued" />
              <span>Centro de ayuda</span>
            </span>
          </button>

          <button type="button" className="ctb-workspace-row" onClick={handleSignOut}>
            <span className="ctb-workspace-row-content">
              <Icon source={ExitIcon} tone="subdued" />
              <span>Cerrar sesión</span>
            </span>
          </button>
        </div>
      </Popover>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
