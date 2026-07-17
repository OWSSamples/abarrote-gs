'use client';

import { useState, useCallback } from 'react';
import { Popover, ActionList, Icon, Spinner, UnstyledButton } from '@shopify/polaris';
import { StoreIcon, CheckSmallIcon, ChevronDownIcon, PlusIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { selectActiveStore } from '@/app/actions/store-scope-actions';

export interface StoreInfo {
  id: string;
  name: string;
}

export function StoreSelector() {
  const [active, setActive] = useState(false);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const activeStoreId = useDashboardStore((s) => s.activeStoreId);
  const stores = useDashboardStore((s) => s.stores);
  const [changing, setChanging] = useState(false);

  const toggleActive = useCallback(() => setActive((p) => !p), []);

  const handleSelect = useCallback(
    async (storeId: string) => {
      if (changing || storeId === activeStoreId) return;
      setChanging(true);
      try {
        await selectActiveStore(storeId);
        // A full reload clears every tenant-bound slice and any in-flight response.
        window.location.reload();
      } catch {
        setChanging(false);
        const { sileo } = await import('sileo');
        sileo.error({
          title: 'No se pudo cambiar de negocio',
          description: 'Verifica tu acceso e inténtalo nuevamente.',
        });
      }
    },
    [activeStoreId, changing],
  );

  const currentStoreName = stores.find((s) => s.id === activeStoreId)?.name || storeConfig.storeName;

  const activator = (
    <UnstyledButton
      className="ctb-store-selector"
      onClick={toggleActive}
      accessibilityLabel={`Negocio activo: ${currentStoreName}`}
      ariaExpanded={active}
      disabled={changing}
    >
      <Icon source={StoreIcon} tone="inherit" />
      <span>{currentStoreName}</span>
      {changing ? <Spinner size="small" /> : <Icon source={ChevronDownIcon} tone="inherit" />}
    </UnstyledButton>
  );

  return (
    <Popover active={active} activator={activator} onClose={() => setActive(false)} preferredAlignment="left">
      <ActionList
        items={[
          ...stores.map((store) => ({
            content: store.name,
            prefix: store.id === activeStoreId ? <Icon source={CheckSmallIcon} tone="success" /> : undefined,
            onAction: () => handleSelect(store.id),
            active: store.id === activeStoreId,
            disabled: changing,
          })),
          {
            content: 'Crear otro negocio',
            prefix: <Icon source={PlusIcon} />,
            onAction: () => window.location.assign('/auth/register?mode=additional'),
            disabled: changing,
          },
        ]}
      />
    </Popover>
  );
}
