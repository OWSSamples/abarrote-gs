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
  Frame,
  Box,
  EmptyState,
  Tabs,
  Divider,
  Popover,
  ActionList,
  type IndexTableProps,
} from '@shopify/polaris';
import {
  listCognitoUsersAction,
  getCognitoUserDetailAction,
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
  type CognitoUserEnriched,
  type CognitoPoolStats,
} from '@/app/actions/cognito-admin-actions';
import { fetchRoleDefinitions } from '@/app/actions/role-actions';
import type { CognitoGroup } from '@/lib/cognito-admin';
import type { RoleDefinition } from '@/types';

type ToastState = { content: string; error?: boolean } | null;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'critical' | 'attention' | 'info'> = {
  CONFIRMED: 'success',
  FORCE_CHANGE_PASSWORD: 'warning',
  RESET_REQUIRED: 'attention',
  UNCONFIRMED: 'attention',
  ARCHIVED: 'critical',
  COMPROMISED: 'critical',
  UNKNOWN: 'info',
};

// ══════════════════════════════════════════════════════════════
// STATS CARDS
// ══════════════════════════════════════════════════════════════

function StatsBar({ stats, loading }: { stats: CognitoPoolStats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <Card padding="400">
        <InlineStack align="center">
          <Spinner accessibilityLabel="Cargando estadísticas" size="small" />
        </InlineStack>
      </Card>
    );
  }

  const items = [
    { label: 'Total', value: stats.total, tone: undefined },
    { label: 'Confirmados', value: stats.confirmed, tone: 'success' as const },
    { label: 'Pendientes', value: stats.forceChangePassword, tone: 'warning' as const },
    { label: 'Deshabilitados', value: stats.disabled, tone: 'critical' as const },
    { label: 'MFA activo', value: stats.mfaEnabled, tone: 'success' as const },
    { label: 'Con rol', value: stats.withDbRole, tone: 'success' as const },
    { label: 'Sin rol', value: stats.withoutDbRole, tone: 'attention' as const },
  ];

  return (
    <Card padding="400">
      <InlineStack gap="600" align="start" wrap>
        {items.map((item) => (
          <BlockStack key={item.label} gap="100" inlineAlign="center">
            <Text as="span" variant="headingLg" fontWeight="bold">
              {item.value}
            </Text>
            <Badge tone={item.tone}>{item.label}</Badge>
          </BlockStack>
        ))}
      </InlineStack>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// USER DETAIL PANEL
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

  return (
    <>
      <Modal open onClose={onClose} title={`Detalle: ${user.displayName || user.email}`} size="large">
        <Modal.Section>
          <BlockStack gap="400">
            <InlineStack gap="400" wrap>
              <BlockStack gap="100">
                <Text as="span" variant="bodySm" tone="subdued">Sub (ID)</Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">{user.sub}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="span" variant="bodySm" tone="subdued">Email</Text>
                <Text as="span" variant="bodyMd">{user.email}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="span" variant="bodySm" tone="subdued">Username</Text>
                <Text as="span" variant="bodyMd">{user.username}</Text>
              </BlockStack>
              {user.phoneNumber && (
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">Teléfono</Text>
                  <Text as="span" variant="bodyMd">{user.phoneNumber}</Text>
                </BlockStack>
              )}
            </InlineStack>

            <Divider />

            <InlineStack gap="300" wrap>
              <Badge tone={STATUS_TONE[user.status] ?? 'info'}>{user.status}</Badge>
              <Badge tone={user.enabled ? 'success' : 'critical'}>{user.enabled ? 'Habilitado' : 'Deshabilitado'}</Badge>
              <Badge tone={user.mfaEnabled ? 'success' : 'attention'}>{user.mfaEnabled ? 'MFA activo' : 'Sin MFA'}</Badge>
              <Badge tone={user.emailVerified ? 'success' : 'warning'}>{user.emailVerified ? 'Email verificado' : 'No verificado'}</Badge>
              <Badge tone={user.hasDbRole ? 'success' : 'warning'}>{user.hasDbRole ? 'Rol asignado' : 'Sin rol local'}</Badge>
            </InlineStack>

            <Divider />

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Grupos Cognito</Text>
              {groups.length === 0 ? (
                <Text as="span" tone="subdued">No hay grupos configurados en el User Pool.</Text>
              ) : (
                <InlineStack gap="200" wrap>
                  {groups.map((g) => {
                    const inGroup = user.groups.includes(g.name);
                    return (
                      <Button
                        key={g.name}
                        size="micro"
                        variant={inGroup ? 'primary' : 'secondary'}
                        tone={inGroup ? undefined : undefined}
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

            <Divider />

            <InlineStack gap="200" wrap>
              <BlockStack gap="050">
                <Text as="span" variant="bodySm" tone="subdued">Creado</Text>
                <Text as="span" variant="bodySm">{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</Text>
              </BlockStack>
              <BlockStack gap="050">
                <Text as="span" variant="bodySm" tone="subdued">Modificado</Text>
                <Text as="span" variant="bodySm">{user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '—'}</Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
      {toast && <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />}
    </>
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

  const showToast = (content: string, isError = false) => setToast({ content, error: isError });

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await getCognitoPoolStatsAction();
      setStats(s);
    } catch {
      // Non-blocking
    } finally {
      setStatsLoading(false);
    }
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

  useEffect(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

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

  // Tab filtering
  const tabs = [
    { id: 'all', content: `Todos (${users.length})` },
    { id: 'confirmed', content: `Confirmados` },
    { id: 'pending', content: `Pendientes` },
    { id: 'disabled', content: `Deshabilitados` },
    { id: 'no-role', content: `Sin rol` },
  ];

  const filteredUsers = useMemo(() => {
    const tabId = tabs[selectedTab]?.id ?? 'all';
    switch (tabId) {
      case 'confirmed':
        return users.filter((u) => u.status === 'CONFIRMED' && u.enabled);
      case 'pending':
        return users.filter((u) => u.status === 'FORCE_CHANGE_PASSWORD' || u.status === 'UNCONFIRMED');
      case 'disabled':
        return users.filter((u) => !u.enabled);
      case 'no-role':
        return users.filter((u) => !u.hasDbRole);
      default:
        return users;
    }
  }, [users, selectedTab]);

  const handleExportCSV = async () => {
    setBusyKey('export');
    try {
      const csv = await exportCognitoUsersCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cognito-users-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('CSV exportado.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export fallido', true);
    } finally {
      setBusyKey(null);
    }
  };

  const handleBulkAction = async (action: 'disable' | 'enable' | 'signout') => {
    if (selectedUsers.length === 0) return;
    setBulkMenuActive(false);
    setBusyKey('bulk');
    try {
      let result;
      switch (action) {
        case 'disable':
          result = await bulkDisableAction(selectedUsers);
          break;
        case 'enable':
          result = await bulkEnableAction(selectedUsers);
          break;
        case 'signout':
          result = await bulkGlobalSignOutAction(selectedUsers);
          break;
      }
      showToast(`Éxito: ${result.success.length}, Fallidos: ${result.failed.length}`);
      setSelectedUsers([]);
      await load();
      await loadStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Operación bulk fallida', true);
    } finally {
      setBusyKey(null);
    }
  };

  const handleSelectionChange = (selectionType: 'single' | 'page' | 'all', toggledId?: string) => {
    if (selectionType === 'all' || selectionType === 'page') {
      if (selectedUsers.length === filteredUsers.length) {
        setSelectedUsers([]);
      } else {
        setSelectedUsers(filteredUsers.map((u) => u.username));
      }
    } else if (toggledId) {
      setSelectedUsers((prev) =>
        prev.includes(toggledId) ? prev.filter((id) => id !== toggledId) : [...prev, toggledId],
      );
    }
  };

  const rowMarkup = useMemo(
    () =>
      filteredUsers.map((u, index) => (
        <IndexTable.Row
          id={u.username}
          key={u.sub}
          position={index}
          selected={selectedUsers.includes(u.username)}
        >
          <IndexTable.Cell>
            <BlockStack gap="050">
              <Button variant="plain" onClick={() => setDetailUser(u)}>
                {u.displayName || '(sin nombre)'}
              </Button>
              <Text as="span" tone="subdued" variant="bodySm">
                {u.email}
              </Text>
            </BlockStack>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={STATUS_TONE[u.status] ?? 'info'}>{u.status}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={u.enabled ? 'success' : 'critical'}>
              {u.enabled ? 'Activo' : 'Bloqueado'}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={u.mfaEnabled ? 'success' : 'attention'}>
              {u.mfaEnabled ? 'MFA' : '—'}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            {u.groups.length > 0 ? (
              <InlineStack gap="100" wrap>
                {u.groups.map((g) => (
                  <Badge key={g} tone="info">{g}</Badge>
                ))}
              </InlineStack>
            ) : (
              <Text as="span" tone="subdued" variant="bodySm">—</Text>
            )}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={u.hasDbRole ? 'success' : 'warning'}>
              {u.hasDbRole ? (u.dbStatus === 'baja' ? 'Baja' : 'Con rol') : 'Sin rol'}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" variant="bodySm" tone="subdued">
              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <ButtonGroup>
              <Button size="micro" onClick={() => { setEditUser(u); setEditName(u.displayName); setEditEmail(u.email); setEditPhone(u.phoneNumber ?? ''); }}>
                Editar
              </Button>
              <Button size="micro" onClick={() => { setPwUser(u); setPwValue(''); setPwPermanent(true); }}>
                Contraseña
              </Button>
              <Button size="micro" loading={busyKey === `signout-${u.sub}`} onClick={() => runAction(`signout-${u.sub}`, () => globalSignOutAction(u.username), 'Sesiones cerradas globalmente.')}>
                Cerrar sesiones
              </Button>
              {u.enabled ? (
                <Button size="micro" tone="critical" variant="secondary" loading={busyKey === `disable-${u.sub}`} onClick={() => runAction(`disable-${u.sub}`, () => disableCognitoUserAction(u.username), 'Usuario deshabilitado.')}>
                  Bloquear
                </Button>
              ) : (
                <Button size="micro" loading={busyKey === `enable-${u.sub}`} onClick={() => runAction(`enable-${u.sub}`, () => enableCognitoUserAction(u.username), 'Usuario habilitado.')}>
                  Desbloquear
                </Button>
              )}
              <Button size="micro" tone="critical" onClick={() => setDeleteUser(u)}>
                Eliminar
              </Button>
            </ButtonGroup>
          </IndexTable.Cell>
        </IndexTable.Row>
      )),
    [filteredUsers, busyKey, selectedUsers],
  );

  const headings: IndexTableProps['headings'] = [
    { title: 'Usuario' },
    { title: 'Estado' },
    { title: 'Acceso' },
    { title: 'MFA' },
    { title: 'Grupos' },
    { title: 'Rol Local' },
    { title: 'Creado' },
    { title: 'Acciones' },
  ];

  const promotedBulkActions = [
    { content: 'Cerrar sesiones', onAction: () => handleBulkAction('signout') },
  ];

  const bulkActions = [
    { content: 'Bloquear seleccionados', onAction: () => handleBulkAction('disable') },
    { content: 'Desbloquear seleccionados', onAction: () => handleBulkAction('enable') },
  ];

  return (
    <Frame>
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {/* Stats Dashboard */}
        <StatsBar stats={stats} loading={statsLoading} />

        {/* Controls */}
        <Card padding="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <Text as="h2" variant="headingMd">
                Gestión de Usuarios — AWS Cognito
              </Text>
              <ButtonGroup>
                <Button onClick={handleExportCSV} loading={busyKey === 'export'}>
                  Exportar CSV
                </Button>
                <Button onClick={() => setImportOpen(true)}>Importar a roles</Button>
                <Popover
                  active={bulkMenuActive}
                  activator={
                    <Button onClick={() => setBulkMenuActive((v) => !v)} disabled={selectedUsers.length === 0}>
                      {`Bulk (${selectedUsers.length})`}
                    </Button>
                  }
                  onClose={() => setBulkMenuActive(false)}
                >
                  <ActionList
                    items={[
                      { content: 'Bloquear todos', onAction: () => handleBulkAction('disable') },
                      { content: 'Desbloquear todos', onAction: () => handleBulkAction('enable') },
                      { content: 'Cerrar sesiones todos', onAction: () => handleBulkAction('signout') },
                    ]}
                  />
                </Popover>
                <Button variant="primary" onClick={() => { setFilter(''); void load(); }} loading={loading}>
                  Recargar
                </Button>
              </ButtonGroup>
            </InlineStack>

            {/* Filter */}
            <InlineStack gap="200" blockAlign="end">
              <Box minWidth="300px">
                <TextField
                  label="Buscar"
                  labelHidden
                  placeholder="Filtrar por email (prefijo)..."
                  value={filter}
                  onChange={setFilter}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setFilter('')}
                />
              </Box>
              <Button onClick={() => void load()}>Buscar</Button>
            </InlineStack>

            {/* Tabs */}
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {loading ? (
                <Box padding="600">
                  <InlineStack align="center">
                    <Spinner accessibilityLabel="Cargando usuarios" />
                  </InlineStack>
                </Box>
              ) : filteredUsers.length === 0 ? (
                <Box padding="600">
                  <EmptyState heading="Sin resultados" image="/illustrations/empty-state.svg">
                    <p>No se encontraron usuarios con ese filtro.</p>
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

      {/* Detail modal */}
      {detailUser && (
        <UserDetailModal
          user={detailUser}
          groups={groups}
          onClose={() => setDetailUser(null)}
          onRefresh={() => void load()}
        />
      )}

      {/* Edit attributes modal */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Editar usuario Cognito"
        primaryAction={{
          content: 'Guardar',
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
          <BlockStack gap="300">
            <TextField label="Nombre para mostrar" value={editName} onChange={setEditName} autoComplete="off" />
            <TextField label="Email" type="email" value={editEmail} onChange={setEditEmail} autoComplete="off" helpText="Cambiar el email puede requerir reverificación." />
            <TextField label="Teléfono" type="tel" value={editPhone} onChange={setEditPhone} autoComplete="off" placeholder="+521234567890" helpText="Formato E.164 (e.g. +521234567890)" />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Set password modal */}
      <Modal
        open={!!pwUser}
        onClose={() => setPwUser(null)}
        title={`Contraseña — ${pwUser?.email ?? ''}`}
        primaryAction={{
          content: 'Aplicar',
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
          { content: 'Enviar reseteo por email', onAction: async () => { if (!pwUser) return; await runAction('reset-email', () => resetCognitoPasswordAction(pwUser.username), 'Email de recuperación enviado.'); setPwUser(null); } },
          { content: 'Cancelar', onAction: () => setPwUser(null) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone="warning">
              Establece una contraseña directamente o envía un correo de recuperación.
            </Banner>
            <TextField label="Nueva contraseña" type="password" value={pwValue} onChange={setPwValue} autoComplete="new-password" helpText="Mínimo 8 caracteres, mayúscula, número y símbolo." />
            <Select
              label="Tipo"
              options={[
                { label: 'Permanente (no fuerza cambio)', value: 'true' },
                { label: 'Temporal (forzar cambio en próximo login)', value: 'false' },
              ]}
              value={String(pwPermanent)}
              onChange={(v) => setPwPermanent(v === 'true')}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Eliminar usuario permanentemente"
        primaryAction={{
          content: 'Eliminar definitivamente',
          destructive: true,
          loading: busyKey === 'delete',
          onAction: async () => {
            if (!deleteUser) return;
            await runAction('delete', () => deleteCognitoUserAction(deleteUser.username), 'Usuario eliminado de Cognito y DB.');
            setDeleteUser(null);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setDeleteUser(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              Se eliminará a <strong>{deleteUser?.displayName || deleteUser?.email}</strong> ({deleteUser?.email}) del User Pool de AWS Cognito y de la base de datos local.
            </Text>
            <Banner tone="critical">
              Esta acción es completamente irreversible. El usuario perderá acceso permanentemente y todos sus datos de autenticación se destruirán.
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Import modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Sincronizar usuarios de Cognito → Base de datos"
        primaryAction={{
          content: 'Ejecutar importación',
          loading: busyKey === 'import',
          disabled: !importRoleId,
          onAction: async () => {
            await runAction('import', async () => {
              const res = await importCognitoUsersAction(importRoleId);
              showToast(`Importados: ${res.imported} | Ya existían: ${res.skipped}`);
            }, 'Importación completada.');
            setImportOpen(false);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setImportOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">
              Crea un registro en la tabla <code>user_roles</code> para cada usuario de Cognito que aún no tenga uno asignado, dándole el rol seleccionado.
            </Text>
            <Select
              label="Rol por defecto para nuevos"
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
              value={importRoleId}
              onChange={setImportRoleId}
            />
            <Banner tone="info">
              Los usuarios que ya tienen rol no se modifican. Solo se crean los nuevos.
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {toast && <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />}
    </Frame>
  );
}
