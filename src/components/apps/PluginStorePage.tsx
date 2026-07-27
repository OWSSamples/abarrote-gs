'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Button, LinkButton } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Tabs } from '@cloudflare/kumo/components/tabs';
import {
  ArrowClockwise24Regular,
  ArrowRight24Regular,
  BoxMultiple24Filled,
  CheckmarkCircle24Filled,
  DismissCircle24Filled,
  PlugConnected24Filled,
  Search24Regular,
  ShieldCheckmark24Filled,
} from '@fluentui/react-icons';
import {
  fetchPluginStoreAction,
  installPluginAction,
  uninstallPluginAction,
  type PluginStoreItem,
} from '@/app/actions/plugin-actions';
import { usePermissions } from '@/hooks/usePermissions';
import './PluginStorePage.css';

type PluginCategoryFilter = 'all' | PluginStoreItem['category'];
type KumoBadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>;

const CATEGORY_LABEL: Record<PluginStoreItem['category'], string> = {
  delivery: 'Delivery',
  services: 'Servicios',
  payments: 'Pagos',
  operations: 'Operación',
};

const CATEGORY_DESCRIPTION: Record<PluginStoreItem['category'], string> = {
  delivery: 'Canales de entrega y operación logística.',
  services: 'Servicios externos disponibles para instalar.',
  payments: 'Proveedores y métodos de cobro.',
  operations: 'Herramientas operativas del negocio.',
};

const CATEGORY_MARK: Record<PluginStoreItem['category'], string> = {
  delivery: 'DL',
  services: 'SV',
  payments: 'PG',
  operations: 'OP',
};

const CATEGORY_BADGE: Record<PluginStoreItem['category'], KumoBadgeVariant> = {
  delivery: 'teal-subtle',
  services: 'info',
  payments: 'success',
  operations: 'secondary',
};

function statusLabel(plugin: PluginStoreItem): string {
  if (plugin.connected) return 'Instalado';
  if (plugin.status === 'configuring') return 'Configuración pendiente';
  if (plugin.status === 'disabled') return 'Desinstalado';
  return 'Disponible';
}

function statusVariant(plugin: PluginStoreItem): KumoBadgeVariant {
  if (plugin.connected) return 'success';
  if (plugin.status === 'configuring') return 'warning';
  if (plugin.status === 'disabled') return 'error';
  return 'secondary';
}

function installActionLabel(plugin: PluginStoreItem): string {
  if (plugin.installMode === 'oauth') return 'Conectar';
  if (plugin.installMode === 'manual') return 'Instalar';
  return 'Activar';
}

function limitList(items: string[], maxItems: number): string[] {
  if (items.length <= maxItems) return items;
  return [...items.slice(0, maxItems), `+${items.length - maxItems}`];
}

export function PluginStorePage({ initialPlugins }: { initialPlugins: PluginStoreItem[] }) {
  const { hasAnyPermission, isLoaded } = usePermissions();
  const [plugins, setPlugins] = useState(initialPlugins);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PluginCategoryFilter>('all');
  const [busyPlugin, setBusyPlugin] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'critical'; text: string } | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(initialPlugins.map((plugin) => plugin.category))),
    [initialPlugins],
  );

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'Todos' },
      ...categories.map((item) => ({ value: item, label: CATEGORY_LABEL[item] })),
    ],
    [categories],
  );

  const filteredPlugins = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-MX');
    return plugins.filter((plugin) => {
      if (category !== 'all' && plugin.category !== category) return false;
      if (!normalizedQuery) return true;

      return `${plugin.name} ${plugin.vendor} ${plugin.summary} ${plugin.description}`
        .toLocaleLowerCase('es-MX')
        .includes(normalizedQuery);
    });
  }, [category, plugins, query]);

  const installedCount = useMemo(
    () => plugins.filter((plugin) => plugin.connected || plugin.status === 'configuring').length,
    [plugins],
  );

  const refreshPlugins = useCallback(async () => {
    setPlugins(await fetchPluginStoreAction());
  }, []);

  const canManagePlugins = !isLoaded || hasAnyPermission('settings.edit');

  const installPlugin = useCallback(
    async (plugin: PluginStoreItem) => {
      setBusyPlugin(plugin.id);
      setMessage(null);
      try {
        const result = await installPluginAction(plugin.id);
        if (result.authorizeUrl) {
          window.location.href = result.authorizeUrl;
          return;
        }
        await refreshPlugins();
        setMessage({ tone: 'success', text: `${plugin.name} quedó instalado para este negocio.` });
      } catch (error) {
        setMessage({
          tone: 'critical',
          text: error instanceof Error ? error.message : 'No fue posible instalar el plugin.',
        });
      } finally {
        setBusyPlugin(null);
      }
    },
    [refreshPlugins],
  );

  const uninstallPlugin = useCallback(
    async (plugin: PluginStoreItem) => {
      setBusyPlugin(plugin.id);
      setMessage(null);
      try {
        await uninstallPluginAction(plugin.id);
        await refreshPlugins();
        setMessage({ tone: 'success', text: `${plugin.name} se desinstaló de este negocio.` });
      } catch (error) {
        setMessage({
          tone: 'critical',
          text: error instanceof Error ? error.message : 'No fue posible desinstalar el plugin.',
        });
      } finally {
        setBusyPlugin(null);
      }
    },
    [refreshPlugins],
  );

  return (
    <main className="plugin-store-page" aria-labelledby="plugin-store-title">
      <div className="plugin-store-frame">
        {message ? (
          <div
            className={`plugin-store-alert plugin-store-alert--${message.tone}`}
            role={message.tone === 'critical' ? 'alert' : 'status'}
          >
            {message.tone === 'success' ? (
              <CheckmarkCircle24Filled aria-hidden="true" />
            ) : (
              <DismissCircle24Filled aria-hidden="true" />
            )}
            <span>{message.text}</span>
          </div>
        ) : null}

        <LayerCard className="plugin-store-console">
          <LayerCard.Secondary className="plugin-store-console__top">
            <div className="plugin-store-title-lockup">
              <span className="plugin-store-title-lockup__icon" aria-hidden="true">
                <BoxMultiple24Filled />
              </span>
              <div>
                <p className="plugin-store-eyebrow">Plugins por negocio</p>
                <h1 id="plugin-store-title">Tienda de plugins</h1>
              </div>
            </div>

            <div className="plugin-store-metrics" aria-label="Resumen de plugins">
              <Badge variant="success" appearance="dot">
                {installedCount} instalados
              </Badge>
              <Badge variant="secondary">{plugins.length} disponibles</Badge>
            </div>
          </LayerCard.Secondary>

          <LayerCard.Primary className="plugin-store-console__body">
            <div className="plugin-store-intro">
              <p>
                Instala capacidades externas por negocio sin mezclar ajustes internos. Cada plugin
                conserva sus permisos, estado y flujo de conexión independiente del tenant activo.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<ArrowClockwise24Regular />}
                onClick={refreshPlugins}
              >
                Actualizar
              </Button>
            </div>

            <div className="plugin-store-toolbar">
              <label className="plugin-store-search">
                <span className="plugin-store-search__icon" aria-hidden="true">
                  <Search24Regular />
                </span>
                <Input
                  aria-label="Buscar plugins"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  autoComplete="off"
                  placeholder="Buscar por nombre, proveedor o capacidad"
                  className="plugin-store-search__input"
                />
              </label>

              <Tabs
                variant="segmented"
                size="sm"
                value={category}
                tabs={tabs}
                onValueChange={(value) => setCategory(value as PluginCategoryFilter)}
                className="plugin-store-tabs"
              />
            </div>
          </LayerCard.Primary>
        </LayerCard>

        {filteredPlugins.length === 0 ? (
          <LayerCard className="plugin-store-empty">
            <div className="plugin-store-empty__icon" aria-hidden="true">
              <PlugConnected24Filled />
            </div>
            <h2>No hay plugins que coincidan</h2>
            <p>Ajusta la búsqueda o cambia el filtro de categoría.</p>
          </LayerCard>
        ) : (
          <div className="plugin-store-grid">
            {filteredPlugins.map((plugin) => {
              const installed = plugin.connected || plugin.status === 'configuring';
              const disabled = !plugin.available || !canManagePlugins || busyPlugin === plugin.id;
              const permissions = limitList(plugin.permissions, 3);
              const capabilities = limitList(plugin.capabilities, 4);

              return (
                <LayerCard
                  key={plugin.id}
                  className={`plugin-store-card ${installed ? 'plugin-store-card--installed' : ''}`}
                >
                  <LayerCard.Secondary className="plugin-store-card__header">
                    <div className="plugin-store-card__category">
                      <span className="plugin-store-card__mark" aria-hidden="true">
                        {CATEGORY_MARK[plugin.category]}
                      </span>
                      <div>
                        <span>{CATEGORY_LABEL[plugin.category]}</span>
                        <small>{CATEGORY_DESCRIPTION[plugin.category]}</small>
                      </div>
                    </div>
                    <Badge variant={statusVariant(plugin)} appearance={installed ? 'dot' : 'filled'}>
                      {statusLabel(plugin)}
                    </Badge>
                  </LayerCard.Secondary>

                  <LayerCard.Primary className="plugin-store-card__body">
                    <div className="plugin-store-card__title">
                      <div>
                        <h2>{plugin.name}</h2>
                        <p>{plugin.vendor}</p>
                      </div>
                      <ShieldCheckmark24Filled aria-hidden="true" />
                    </div>

                    <p className="plugin-store-card__summary">{plugin.summary}</p>

                    <div className="plugin-store-card__badges" aria-label="Capacidades">
                      {capabilities.map((capability) => (
                        <Badge key={capability} variant={CATEGORY_BADGE[plugin.category]}>
                          {capability}
                        </Badge>
                      ))}
                    </div>

                    <div className="plugin-store-card__permissions">
                      <span>Permisos solicitados</span>
                      <ul>
                        {permissions.map((permission) => (
                          <li key={permission}>{permission}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="plugin-store-card__actions">
                      {installed ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary-destructive"
                          loading={busyPlugin === plugin.id}
                          disabled={!canManagePlugins}
                          onClick={() => uninstallPlugin(plugin)}
                        >
                          Desinstalar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          icon={<PlugConnected24Filled />}
                          loading={busyPlugin === plugin.id}
                          disabled={disabled}
                          onClick={() => installPlugin(plugin)}
                        >
                          {installActionLabel(plugin)}
                        </Button>
                      )}

                      {plugin.docsUrl ? (
                        <LinkButton
                          href={plugin.docsUrl}
                          external
                          size="sm"
                          variant="ghost"
                          icon={<ArrowRight24Regular />}
                        >
                          Docs
                        </LinkButton>
                      ) : null}
                    </div>
                  </LayerCard.Primary>
                </LayerCard>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
