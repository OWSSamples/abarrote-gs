'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  ButtonGroup,
  InlineStack,
  BlockStack,
  Modal,
  TextField,
  Select,
  Banner,
  Spinner,
  Toast,
  Box,
  EmptyState,
  Tabs,
  Divider,
  Popover,
  ActionList,
  InlineGrid,
  ProgressBar,
  Tooltip,
  type IndexTableProps,
} from '@shopify/polaris';
import {
  SearchIcon,
  ExportIcon,
  ImportIcon,
  RefreshIcon,
  DeleteIcon,
  LockIcon,
  KeyIcon,
  PersonExitIcon,
  CheckCircleIcon,
  PersonIcon,
  ShieldCheckMarkIcon,
  ShieldNoneIcon,
} from '@shopify/polaris-icons';
import {
  listCognitoUsersAction,
  disableCognitoUserAction,
  enableCognitoUserAction,
  deleteCognitoUserAction,
  resetCognitoPasswordAction,
  setCognitoPasswordAction,
  updateCognitoUserAttributesAction,
  importCognitoUsersAction,
  globalSignOutAction,
  listGroupsAction,
  addUserToGroupAction,
  removeUserFromGroupAction,
  bulkDisableAction,
  bulkEnableAction,
  bulkGlobalSignOutAction,
  exportCognitoUsersCSV,
  getCognitoPoolStatsAction,
  reconcileUsersAction,
  purgeOrphanedUsersAction,
  setUserMfaAction,
  type CognitoUserEnriched,
  type CognitoPoolStats,
  type ReconciliationResult,
} from '@/app/actions/cognito-admin-actions';
import { fetchRoleDefinitions } from '@/app/actions/role-actions';
import type { CognitoGroup } from '@/lib/cognito-admin';
import type { RoleDefinition } from '@/types';

type ToastState = { content: string; error?: boolean } | null;

const STATUS_CONFIG: Record<string, { tone: 'success' | 'warning' | 'critical' | 'attention' | 'info'; label: string }> = {
  CONFIRMED: { tone: 'success', label: 'Confirmado' },
  FORCE_CHANGE_PASSWORD: { tone: 'warning', label: 'Cambio pendiente' },
  RESET_REQUIRED: { tone: 'attention', label: 'Reset requerido' },
  UNCONFIRMED: { tone: 'attention', label: 'Sin confirmar' },
  ARCHIVED: { tone: 'critical', label: 'Archivado' },
  COMPROMISED: { tone: 'critical', label: 'Comprometido' },
  UNKNOWN: { tone: 'info', label: 'Desconocido' },
};

// ══════════════════════════════════════════════════════════════
// AVATAR
// ══════════════════════════════════════════════════════════════

function UserAvatar({ name, enabled }: { name: string; enabled: boolean }) {
  const initials = name
    .split(/[\s@]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: 36,
        height: 36,
        minWidth: 36,
        borderRadius: '50%',
        background: enabled
          ? 'var(--p-color-bg-fill-info)'
          : 'var(--p-color-bg-fill-disabled)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 150ms ease',
      }}
    >
      <Text as="span" variant="bodySm" fontWeight="bold" tone={enabled ? undefined : 'subdued'}>
        {initials || '??'}
      </Text>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STAT CARD
// ══════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  tone,
  progress,
  detail,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'critical' | 'info' | 'primary';
  progress?: number;
  detail?: string;
}) {
  const progressTone = tone === 'info' || tone === 'primary' ? 'highlight' as const : tone === 'warning' ? 'highlight' as const : tone;
  return (
    <BlockStack gap="100">
      <Text as="p" variant="bodyXs" tone="subdued">{label}</Text>
      <Text as="p" variant="headingMd" fontWeight="bold">{value}</Text>
      {progress !== undefined && (
        <ProgressBar progress={progress} size="small" tone={progressTone} />
      )}
      {detail && (
        <Text as="p" variant="bodyXs" tone="subdued">{detail}</Text>
      )}
    </BlockStack>
  );
}

// ══════════════════════════════════════════════════════════════
// USER DETAIL MODAL
// ══════════════════════════════════════════════════════════════

function UserDetailModal({
  user,
  groups,
  onClose,
  onRefresh,
}: {
  user: CognitoUserEnriched | null;
  groups: CognitoGroup[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  if (!user) return null;

  const statusCfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.UNKNOWN;

  const handleGroupToggle = async (groupName: string, inGroup: boolean) => {
    setBusy(true);
    try {
      if (inGroup) {
        await removeUserFromGroupAction(user.username, groupName);
      } else {
        await addUserToGroupAction(user.username, groupName);
      }
      setToast({ content: inGroup ? `Removido de ${groupName}` : `Agregado a ${groupName}` });
      onRefresh();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Error', error: true });
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <>
      <Modal open onClose={onClose} title={user.displayName || user.email} size="large">
        <Modal.Section>
          <BlockStack gap="500">
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Identidad</Text>
              <Divider />
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
                <BlockStack gap="050">
                  <Text as="span" variant="bodyXs" tone="subdued">Cognito Sub</Text>
                  <Text as="span" variant="bodySm" fontWeight="medium" breakWord>{user.sub}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text as="span" variant="bodyXs" tone="subdued">Email</Text>
                  <Text as="span" variant="bodySm" fontWeight="medium">{user.email}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text as="span" variant="bodyXs" tone="subdued">Username</Text>
                  <Text as="span" variant="bodySm" fontWeight="medium" breakWord>{user.username}</Text>
                </BlockStack>
                {user.phoneNumber && (
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyXs" tone="subdued">Teléfono</Text>
                    <Text as="span" variant="bodySm" fontWeight="medium">{user.phoneNumber}</Text>
                  </BlockStack>
                )}
              </InlineGrid>
            </BlockStack>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Estado de la cuenta</Text>
              <Divider />
              <InlineStack gap="200" wrap>
                <Badge tone={statusCfg.tone}>{statusCfg.label}</Badge>
                <Badge tone={user.enabled ? 'success' : 'critical'}>
                  {user.enabled ? 'Acceso activo' : 'Bloqueado'}
                </Badge>
                <Badge tone={user.mfaEnabled ? 'success' : 'attention'}>
                  {user.mfaEnabled ? 'MFA habilitado' : 'Sin MFA'}
                </Badge>
                <Badge tone={user.emailVerified ? 'success' : 'warning'}>
                  {user.emailVerified ? 'Email verificado' : 'Email sin verificar'}
                </Badge>
                <Badge tone={user.hasDbRole ? 'success' : 'warning'}>
                  {user.hasDbRole ? 'Rol asignado' : 'Sin rol local'}
                </Badge>
              </InlineStack>
            </BlockStack>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Grupos Cognito</Text>
              <Divider />
              {groups.length === 0 ? (
                <Text as="p" tone="subdued" variant="bodySm">No hay grupos configurados en el User Pool.</Text>
              ) : (
                <InlineStack gap="200" wrap>
                  {groups.map((g) => {
                    const inGroup = user.groups.includes(g.name);
                    return (
                      <Button
                        key={g.name}
                        size="micro"
                        variant={inGroup ? 'primary' : 'secondary'}
                        loading={busy}
                        onClick={() => handleGroupToggle(g.name, inGroup)}
                      >
                        {inGroup ? `✓ ${g.name}` : g.name}
                      </Button>
                    );
                  })}
                </InlineStack>
              )}
            </BlockStack>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Actividad</Text>
              <Divider />
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <BlockStack gap="050">
                  <Text as="span" variant="bodyXs" tone="subdued">Registrado</Text>
                  <Text as="span" variant="bodySm">{fmt(user.createdAt)}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text as="span" variant="bodyXs" tone="subdued">Última modificación</Text>
                  <Text as="span" variant="bodySm">{fmt(user.updatedAt)}</Text>
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
      {toast && <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// RECONCILIATION PANEL
// ══════════════════════════════════════════════════════════════

function ReconciliationCard({
  reconciliation,
  reconcileLoading,
  selectedOrphans,
  setSelectedOrphans,
  onReconcile,
  onPurge,
}: {
  reconciliation: ReconciliationResult | null;
  reconcileLoading: boolean;
  selectedOrphans: string[];
  setSelectedOrphans: React.Dispatch<React.SetStateAction<string[]>>;
  onReconcile: () => void;
  onPurge: () => void;
}) {
  const hasOrphans = reconciliation && reconciliation.orphanedUsers.length > 0;
  const isClean = reconciliation && reconciliation.orphanedUsers.length === 0;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <BlockStack gap="050">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h3" variant="headingSm" fontWeight="bold">Integridad de datos</Text>
              {isClean && <Badge tone="success" size="small">Sincronizado</Badge>}
              {hasOrphans && (
                <Badge tone="warning" size="small">
                  {`${reconciliation!.orphanedUsers.length} huérfano(s)`}
                </Badge>
              )}
            </InlineStack>
            <Text as="p" variant="bodyXs" tone="subdued">
              Verifica que cada registro en la DB tenga una cuenta válida en Cognito
            </Text>
          </BlockStack>
          <Button
            onClick={onReconcile}
            loading={reconcileLoading}
            icon={RefreshIcon}
            variant={reconciliation ? 'secondary' : 'primary'}
            size="slim"
          >
            {reconciliation ? 'Re-analizar' : 'Verificar'}
          </Button>
        </InlineStack>

        {hasOrphans && (
          <>
            <Banner tone="warning" title={`${reconciliation!.orphanedUsers.length} registro(s) huérfano(s)`}>
              <p>
                Registros en la base de datos sin cuenta en AWS Cognito.
                Son restos de la migración desde Firebase y no pueden autenticarse.
              </p>
            </Banner>
            <IndexTable
              resourceName={{ singular: 'registro', plural: 'registros' }}
              itemCount={reconciliation!.orphanedUsers.length}
              headings={[
                { title: 'Email' },
                { title: 'Nombre' },
                { title: 'Estado' },
                { title: 'ID legacy' },
                { title: 'Creado' },
              ] as IndexTableProps['headings']}
              selectable
              selectedItemsCount={
                selectedOrphans.length === reconciliation!.orphanedUsers.length
                  ? 'All'
                  : selectedOrphans.length
              }
              onSelectionChange={(selType, toggledId) => {
                if (selType === 'all' || selType === 'page') {
                  setSelectedOrphans((prev) =>
                    prev.length === reconciliation!.orphanedUsers.length
                      ? []
                      : reconciliation!.orphanedUsers.map((u) => u.id),
                  );
                } else if (typeof toggledId === 'string') {
                  setSelectedOrphans((prev) =>
                    prev.includes(toggledId)
                      ? prev.filter((id) => id !== toggledId)
                      : [...prev, toggledId],
                  );
                }
              }}
              promotedBulkActions={[
                {
                  content: `Eliminar ${selectedOrphans.length} registro(s)`,
                  onAction: onPurge,
                },
              ]}
            >
              {reconciliation!.orphanedUsers.map((u, idx) => (
                <IndexTable.Row
                  id={u.id}
                  key={u.id}
                  position={idx}
                  selected={selectedOrphans.includes(u.id)}
                >
                  <IndexTable.Cell>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{u.email}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodySm">{u.displayName || '—'}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={u.status === 'activo' ? 'attention' : 'critical'} size="small">
                      {u.status}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Tooltip content={u.cognitoSub}>
                      <Text as="span" variant="bodyXs" tone="subdued">{u.cognitoSub.slice(0, 8)}…</Text>
                    </Tooltip>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodyXs" tone="subdued">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-MX') : '—'}
                    </Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </>
        )}

        {isClean && (
          <InlineStack gap="200" blockAlign="center">
            <div style={{ color: 'var(--p-color-icon-success)' }}>
              <CheckCircleIcon />
            </div>
            <Text as="p" variant="bodySm" tone="subdued">
              Todos los registros están correctamente vinculados a una cuenta Cognito.
            </Text>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export function CognitoUsersManager() {
  const [users, setUsers] = useState<CognitoUserEnriched[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [groups, setGroups] = useState<CognitoGroup[]>([]);
  const [stats, setStats] = useState<CognitoPoolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkMenuActive, setBulkMenuActive] = useState(false);

  // Modals
  const [pwUser, setPwUser] = useState<CognitoUserEnriched | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwPermanent, setPwPermanent] = useState(true);
  const [editUser, setEditUser] = useState<CognitoUserEnriched | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [deleteUser, setDeleteUser] = useState<CognitoUserEnriched | null>(null);
  const [detailUser, setDetailUser] = useState<CognitoUserEnriched | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRoleId, setImportRoleId] = useState('');

  // Reconciliation
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [selectedOrphans, setSelectedOrphans] = useState<string[]>([]);

  const showToast = (content: string, isError = false) => setToast({ content, error: isError });

  // ── Data loading ──

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await getCognitoPoolStatsAction());
    } catch { /* non-blocking */ }
    finally { setStatsLoading(false); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cognitoFilter = filter.trim() ? `email ^= "${filter.trim()}"` : undefined;
      const [usersRes, rolesRes, groupsRes] = await Promise.all([
        listCognitoUsersAction({ loadAll: true, filter: cognitoFilter }),
        fetchRoleDefinitions(),
        listGroupsAction(),
      ]);
      setUsers(usersRes.users);
      setRoles(rolesRes);
      setGroups(groupsRes);
      if (rolesRes.length && !importRoleId) {
        const lectura = rolesRes.find((r) => /lectura/i.test(r.name));
        setImportRoleId((lectura ?? rolesRes[0]).id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filter, importRoleId]);

  useEffect(() => { void load(); void loadStats(); }, [load, loadStats]);

  const runAction = async (key: string, fn: () => Promise<void>, successMsg: string) => {
    setBusyKey(key);
    try {
      await fn();
      showToast(successMsg);
      await load();
      await loadStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Operación fallida', true);
    } finally {
      setBusyKey(null);
    }
  };

  // ── Tab filtering ──

  const tabs = [
    { id: 'all', content: `Todos (${users.length})` },
    { id: 'confirmed', content: 'Confirmados' },
    { id: 'pending', content: 'Pendientes' },
    { id: 'disabled', content: 'Bloqueados' },
    { id: 'no-role', content: 'Sin rol' },
  ];

  const filteredUsers = useMemo(() => {
    const tabId = tabs[selectedTab]?.id ?? 'all';
    switch (tabId) {
      case 'confirmed': return users.filter((u) => u.status === 'CONFIRMED' && u.enabled);
      case 'pending': return users.filter((u) => u.status === 'FORCE_CHANGE_PASSWORD' || u.status === 'UNCONFIRMED');
      case 'disabled': return users.filter((u) => !u.enabled);
      case 'no-role': return users.filter((u) => !u.hasDbRole);
      default: return users;
    }
  }, [users, selectedTab]);

  // ── Handlers ──

  const handleExportCSV = async () => {
    setBusyKey('export');
    try {
      const csv = await exportCognitoUsersCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cognito-users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV descargado.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al exportar', true);
    } finally {
      setBusyKey(null);
    }
  };

  const handleBulkAction = async (action: 'disable' | 'enable' | 'signout') => {
    if (selectedUsers.length === 0) return;
    setBulkMenuActive(false);
    setBusyKey('bulk');
    try {
      const fns = { disable: bulkDisableAction, enable: bulkEnableAction, signout: bulkGlobalSignOutAction };
      const result = await fns[action](selectedUsers);
      showToast(`${result.success.length} exitoso(s), ${result.failed.length} fallido(s)`);
      setSelectedUsers([]);
      await load();
      await loadStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Operación fallida', true);
    } finally {
      setBusyKey(null);
    }
  };

  const handleSelectionChange = (selectionType: 'single' | 'page' | 'all', toggledId?: string) => {
    if (selectionType === 'all' || selectionType === 'page') {
      setSelectedUsers((prev) =>
        prev.length === filteredUsers.length ? [] : filteredUsers.map((u) => u.username),
      );
    } else if (toggledId) {
      setSelectedUsers((prev) =>
        prev.includes(toggledId) ? prev.filter((id) => id !== toggledId) : [...prev, toggledId],
      );
    }
  };

  const handleReconcile = async () => {
    setReconcileLoading(true);
    try {
      const result = await reconcileUsersAction();
      setReconciliation(result);
      if (result.orphanedUsers.length === 0) showToast('Base de datos sincronizada.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al reconciliar', true);
    } finally {
      setReconcileLoading(false);
    }
  };

  const handlePurgeOrphans = async () => {
    if (selectedOrphans.length === 0) return;
    setBusyKey('purge');
    try {
      const result = await purgeOrphanedUsersAction(selectedOrphans);
      showToast(`${result.purged} registro(s) eliminado(s)`);
      setSelectedOrphans([]);
      setReconciliation(null);
      await load();
      await loadStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al purgar', true);
    } finally {
      setBusyKey(null);
    }
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── Health score ──

  const healthScore = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    let score = 0;
    score += (stats.confirmed / stats.total) * 40;
    score += (stats.withDbRole / stats.total) * 30;
    score += ((stats.total - stats.disabled) / stats.total) * 20;
    score += (stats.mfaEnabled / stats.total) * 10;
    return Math.round(score);
  }, [stats]);

  // ── Row markup ──

  const rowMarkup = useMemo(
    () =>
      filteredUsers.map((u, index) => {
        const statusCfg = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.UNKNOWN;
        return (
          <IndexTable.Row
            id={u.username}
            key={u.sub}
            position={index}
            selected={selectedUsers.includes(u.username)}
            tone={!u.enabled ? 'subdued' : undefined}
          >
            <IndexTable.Cell>
              <InlineStack gap="300" blockAlign="center" wrap={false}>
                <UserAvatar name={u.displayName || u.email} enabled={u.enabled} />
                <BlockStack gap="050">
                  <Button variant="plain" onClick={() => setDetailUser(u)}>
                    {u.displayName || '(sin nombre)'}
                  </Button>
                  <Text as="span" variant="bodyXs" tone="subdued">{u.email}</Text>
                </BlockStack>
              </InlineStack>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="100" wrap>
                <Badge tone={statusCfg.tone} size="small">{statusCfg.label}</Badge>
                {!u.enabled && <Badge tone="critical" size="small">Bloqueado</Badge>}
              </InlineStack>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="100">
                <Tooltip content={u.mfaEnabled ? 'MFA habilitado' : 'Sin MFA — menos seguro'}>
                  <Badge tone={u.mfaEnabled ? 'success' : 'attention'} size="small">
                    {u.mfaEnabled ? 'MFA' : 'Sin MFA'}
                  </Badge>
                </Tooltip>
              </InlineStack>
            </IndexTable.Cell>
            <IndexTable.Cell>
              {u.hasDbRole ? (
                <Badge tone={u.dbStatus === 'baja' ? 'critical' : 'success'} size="small">
                  {u.dbStatus === 'baja' ? 'Baja' : 'Vinculado'}
                </Badge>
              ) : (
                <Badge tone="warning" size="small">Sin vincular</Badge>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell>
              {u.groups.length > 0 ? (
                <InlineStack gap="100" wrap>
                  {u.groups.map((g) => <Badge key={g} tone="info" size="small">{g}</Badge>)}
                </InlineStack>
              ) : (
                <Text as="span" tone="subdued" variant="bodyXs">—</Text>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" variant="bodyXs" tone="subdued">{fmtDate(u.createdAt)}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="100" wrap={false}>
                <Tooltip content="Ver detalle">
                  <Button size="micro" icon={PersonIcon} accessibilityLabel="Ver detalle" onClick={() => setDetailUser(u)} />
                </Tooltip>
                <Button size="micro" accessibilityLabel="Editar" onClick={() => { setEditUser(u); setEditName(u.displayName); setEditEmail(u.email); setEditPhone(u.phoneNumber ?? ''); }}>
                  Editar
                </Button>
                <Tooltip content="Contraseña">
                  <Button size="micro" icon={KeyIcon} accessibilityLabel="Contraseña" onClick={() => { setPwUser(u); setPwValue(''); setPwPermanent(true); }} />
                </Tooltip>
                <Tooltip content="Cerrar sesiones">
                  <Button size="micro" icon={PersonExitIcon} accessibilityLabel="Cerrar sesiones" loading={busyKey === `signout-${u.sub}`} onClick={() => runAction(`signout-${u.sub}`, () => globalSignOutAction(u.username), 'Sesiones cerradas.')} />
                </Tooltip>
                <Tooltip content={u.mfaEnabled ? 'Desactivar MFA' : 'Activar MFA (TOTP)'}>
                  <Button
                    size="micro"
                    icon={u.mfaEnabled ? ShieldCheckMarkIcon : ShieldNoneIcon}
                    accessibilityLabel={u.mfaEnabled ? 'Desactivar MFA' : 'Activar MFA'}
                    tone={u.mfaEnabled ? undefined : 'critical'}
                    loading={busyKey === `mfa-${u.sub}`}
                    onClick={() => runAction(`mfa-${u.sub}`, () => setUserMfaAction(u.username, !u.mfaEnabled), u.mfaEnabled ? 'MFA desactivado.' : 'MFA activado.')}
                  />
                </Tooltip>
                {u.enabled ? (
                  <Tooltip content="Bloquear acceso">
                    <Button size="micro" icon={LockIcon} tone="critical" accessibilityLabel="Bloquear" loading={busyKey === `disable-${u.sub}`} onClick={() => runAction(`disable-${u.sub}`, () => disableCognitoUserAction(u.username), 'Acceso bloqueado.')} />
                  </Tooltip>
                ) : (
                  <Button size="micro" accessibilityLabel="Desbloquear" loading={busyKey === `enable-${u.sub}`} onClick={() => runAction(`enable-${u.sub}`, () => enableCognitoUserAction(u.username), 'Acceso restaurado.')}>
                    Restaurar
                  </Button>
                )}
                <Tooltip content="Eliminar">
                  <Button size="micro" icon={DeleteIcon} tone="critical" accessibilityLabel="Eliminar" onClick={() => setDeleteUser(u)} />
                </Tooltip>
              </InlineStack>
            </IndexTable.Cell>
          </IndexTable.Row>
        );
      }),
    [filteredUsers, busyKey, selectedUsers],
  );

  const headings: IndexTableProps['headings'] = [
    { title: 'Usuario' },
    { title: 'Estado' },
    { title: 'Seguridad' },
    { title: 'Plataforma' },
    { title: 'Grupos' },
    { title: 'Registro' },
    { title: 'Acciones' },
  ];

  const promotedBulkActions = [
    { content: 'Cerrar sesiones', onAction: () => handleBulkAction('signout') },
  ];
  const bulkActions = [
    { content: 'Bloquear seleccionados', onAction: () => handleBulkAction('disable') },
    { content: 'Desbloquear seleccionados', onAction: () => handleBulkAction('enable') },
  ];

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <>
      <BlockStack gap="300">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
        )}

        {/* ── KPI Dashboard ── */}
        <Card padding="300">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingSm" fontWeight="bold">Panel de métricas</Text>
              {statsLoading && <Spinner accessibilityLabel="Cargando métricas" size="small" />}
            </InlineStack>
            {!statsLoading && stats && (
              <InlineGrid columns={{ xs: 2, sm: 3, lg: 6 }} gap="200">
                <StatCard label="Total usuarios" value={stats.total} tone="primary" progress={100} detail="Cognito User Pool" />
                <StatCard
                  label="Confirmados"
                  value={stats.confirmed}
                  tone="success"
                  progress={stats.total > 0 ? (stats.confirmed / stats.total) * 100 : 0}
                  detail={`${stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0}% del pool`}
                />
                <StatCard
                  label="Pendientes"
                  value={stats.forceChangePassword}
                  tone="warning"
                  progress={stats.total > 0 ? (stats.forceChangePassword / stats.total) * 100 : 0}
                  detail="Requieren acción"
                />
                <StatCard
                  label="Bloqueados"
                  value={stats.disabled}
                  tone="critical"
                  progress={stats.total > 0 ? (stats.disabled / stats.total) * 100 : 0}
                  detail="Sin acceso"
                />
                <StatCard
                  label="Con rol asignado"
                  value={stats.withDbRole}
                  tone="success"
                  progress={stats.total > 0 ? (stats.withDbRole / stats.total) * 100 : 0}
                  detail={`${stats.withoutDbRole} sin vincular`}
                />
                <BlockStack gap="100">
                  <Text as="p" variant="bodyXs" tone="subdued">Salud del pool</Text>
                  <Text as="p" variant="headingMd" fontWeight="bold">{healthScore}%</Text>
                  <ProgressBar
                    progress={healthScore}
                    size="small"
                    tone={healthScore >= 80 ? 'success' : healthScore >= 50 ? 'highlight' : 'critical'}
                  />
                  <Text as="p" variant="bodyXs" tone="subdued">
                    {healthScore >= 80 ? 'Excelente' : healthScore >= 50 ? 'Mejorable' : 'Atención requerida'}
                  </Text>
                </BlockStack>
              </InlineGrid>
            )}
          </BlockStack>
        </Card>

        {/* ── Reconciliation ── */}
        <ReconciliationCard
          reconciliation={reconciliation}
          reconcileLoading={reconcileLoading}
          selectedOrphans={selectedOrphans}
          setSelectedOrphans={setSelectedOrphans}
          onReconcile={handleReconcile}
          onPurge={handlePurgeOrphans}
        />

        {/* ── User Directory ── */}
        <Card padding="0">
          <BlockStack gap="0">
            <Box padding="300" paddingBlockEnd="0">
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    Directorio de usuarios
                  </Text>
                  <InlineStack gap="200">
                    <ButtonGroup>
                      <Tooltip content="Exportar CSV">
                        <Button icon={ExportIcon} onClick={handleExportCSV} loading={busyKey === 'export'} accessibilityLabel="Exportar CSV" size="slim" />
                      </Tooltip>
                      <Tooltip content="Vincular usuarios a la plataforma">
                        <Button icon={ImportIcon} onClick={() => setImportOpen(true)} accessibilityLabel="Importar" size="slim" />
                      </Tooltip>
                    </ButtonGroup>
                    {selectedUsers.length > 0 && (
                      <Popover
                        active={bulkMenuActive}
                        activator={<Button onClick={() => setBulkMenuActive((v) => !v)} size="slim" tone="critical">{`Acciones (${selectedUsers.length})`}</Button>}
                        onClose={() => setBulkMenuActive(false)}
                      >
                        <ActionList
                          actionRole="menuitem"
                          items={[
                            { content: 'Cerrar sesiones', icon: PersonExitIcon, onAction: () => handleBulkAction('signout') },
                            { content: 'Bloquear acceso', icon: LockIcon, destructive: true, onAction: () => handleBulkAction('disable') },
                            { content: 'Restaurar acceso', icon: CheckCircleIcon, onAction: () => handleBulkAction('enable') },
                          ]}
                        />
                      </Popover>
                    )}
                    <Button variant="primary" icon={RefreshIcon} onClick={() => { setFilter(''); void load(); void loadStats(); }} loading={loading} size="slim">
                      Actualizar
                    </Button>
                  </InlineStack>
                </InlineStack>
                <Box maxWidth="400px">
                  <TextField
                    label="Buscar usuario"
                    labelHidden
                    placeholder="Buscar por email..."
                    value={filter}
                    onChange={setFilter}
                    autoComplete="off"
                    prefix={<span><SearchIcon /></span>}
                    clearButton
                    onClearButtonClick={() => setFilter('')}
                    connectedRight={<Button onClick={() => void load()} size="slim">Buscar</Button>}
                  />
                </Box>
              </BlockStack>
            </Box>

            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {loading ? (
                <Box padding="400">
                  <BlockStack align="center" inlineAlign="center" gap="200">
                    <Spinner accessibilityLabel="Cargando usuarios" />
                    <Text as="p" variant="bodySm" tone="subdued">Consultando AWS Cognito...</Text>
                  </BlockStack>
                </Box>
              ) : filteredUsers.length === 0 ? (
                <Box padding="400">
                  <EmptyState heading="Sin usuarios" image="">
                    <p>No se encontraron usuarios con los filtros aplicados.</p>
                  </EmptyState>
                </Box>
              ) : (
                <IndexTable
                  resourceName={{ singular: 'usuario', plural: 'usuarios' }}
                  itemCount={filteredUsers.length}
                  headings={headings}
                  selectable
                  selectedItemsCount={selectedUsers.length === filteredUsers.length ? 'All' : selectedUsers.length}
                  onSelectionChange={handleSelectionChange as unknown as IndexTableProps['onSelectionChange']}
                  promotedBulkActions={promotedBulkActions}
                  bulkActions={bulkActions}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Tabs>
          </BlockStack>
        </Card>
      </BlockStack>

      {/* ══════ MODALS ══════ */}

      {detailUser && (
        <UserDetailModal user={detailUser} groups={groups} onClose={() => setDetailUser(null)} onRefresh={() => void load()} />
      )}

      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Editar atributos del usuario"
        primaryAction={{
          content: 'Guardar cambios',
          loading: busyKey === 'edit',
          onAction: async () => {
            if (!editUser) return;
            await runAction('edit', () => updateCognitoUserAttributesAction(editUser.username, {
              displayName: editName,
              email: editEmail !== editUser.email ? editEmail : undefined,
              phoneNumber: editPhone !== (editUser.phoneNumber ?? '') ? editPhone || undefined : undefined,
            }), 'Atributos actualizados.');
            setEditUser(null);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setEditUser(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField label="Nombre para mostrar" value={editName} onChange={setEditName} autoComplete="off" />
            <TextField label="Email" type="email" value={editEmail} onChange={setEditEmail} autoComplete="off" helpText="Si lo cambias, puede requerir reverificación." />
            <TextField label="Teléfono" type="tel" value={editPhone} onChange={setEditPhone} autoComplete="off" placeholder="+521234567890" helpText="Formato E.164 (incluir código de país)." />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={!!pwUser}
        onClose={() => setPwUser(null)}
        title="Gestión de contraseña"
        primaryAction={{
          content: pwPermanent ? 'Establecer permanente' : 'Establecer temporal',
          destructive: true,
          loading: busyKey === 'pw',
          disabled: pwValue.length < 8,
          onAction: async () => {
            if (!pwUser) return;
            await runAction('pw', () => setCognitoPasswordAction(pwUser.username, pwValue, pwPermanent), pwPermanent ? 'Contraseña permanente establecida.' : 'Contraseña temporal establecida.');
            setPwUser(null);
          },
        }}
        secondaryActions={[
          { content: 'Enviar email de recuperación', onAction: async () => { if (!pwUser) return; await runAction('reset-email', () => resetCognitoPasswordAction(pwUser.username), 'Email de recuperación enviado.'); setPwUser(null); } },
          { content: 'Cancelar', onAction: () => setPwUser(null) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {pwUser && (
              <InlineStack gap="200" blockAlign="center">
                <UserAvatar name={pwUser.displayName || pwUser.email} enabled={pwUser.enabled} />
                <BlockStack gap="050">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">{pwUser.displayName || pwUser.email}</Text>
                  <Text as="span" variant="bodyXs" tone="subdued">{pwUser.email}</Text>
                </BlockStack>
              </InlineStack>
            )}
            <Divider />
            <TextField label="Nueva contraseña" type="password" value={pwValue} onChange={setPwValue} autoComplete="new-password" helpText="Mínimo 8 caracteres. Mayúscula, número y símbolo." />
            <Select
              label="Tipo de contraseña"
              options={[
                { label: 'Permanente — se usa directamente', value: 'true' },
                { label: 'Temporal — fuerza cambio en próximo login', value: 'false' },
              ]}
              value={String(pwPermanent)}
              onChange={(v) => setPwPermanent(v === 'true')}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Eliminar usuario"
        primaryAction={{
          content: 'Eliminar permanentemente',
          destructive: true,
          loading: busyKey === 'delete',
          onAction: async () => {
            if (!deleteUser) return;
            await runAction('delete', () => deleteCognitoUserAction(deleteUser.username), 'Usuario eliminado.');
            setDeleteUser(null);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setDeleteUser(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {deleteUser && (
              <InlineStack gap="200" blockAlign="center">
                <UserAvatar name={deleteUser.displayName || deleteUser.email} enabled={false} />
                <BlockStack gap="050">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">{deleteUser.displayName || deleteUser.email}</Text>
                  <Text as="span" variant="bodyXs" tone="subdued">{deleteUser.email}</Text>
                </BlockStack>
              </InlineStack>
            )}
            <Banner tone="critical" title="Acción irreversible">
              <p>Se eliminará al usuario de AWS Cognito y de la base de datos local. Perderá acceso permanentemente.</p>
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Vincular usuarios de Cognito"
        primaryAction={{
          content: 'Vincular usuarios',
          loading: busyKey === 'import',
          disabled: !importRoleId,
          onAction: async () => {
            await runAction('import', async () => {
              const res = await importCognitoUsersAction(importRoleId);
              showToast(`Vinculados: ${res.imported} | Ya existían: ${res.skipped}`);
            }, 'Vinculación completada.');
            setImportOpen(false);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setImportOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodySm">
              Crea un registro en la plataforma para cada usuario de Cognito que aún no tenga uno, asignándole el rol seleccionado.
            </Text>
            <Select
              label="Rol por defecto"
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
              value={importRoleId}
              onChange={setImportRoleId}
            />
            <Banner tone="info">Solo se crean registros nuevos. Los usuarios ya vinculados se omiten.</Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {toast && <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />}
    </>
  );
}
