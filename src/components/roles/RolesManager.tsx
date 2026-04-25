'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Button,
  EmptyState,
  Box,
  Banner,
  Spinner,
  Tabs,
  InlineGrid,
  ProgressBar,
  TextField,
  Divider,
} from '@shopify/polaris';
import { PersonAddIcon, DeleteIcon, EditIcon, PlusIcon, SearchIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import type { RoleDefinition, UserRoleRecord, PermissionKey } from '@/types';
import { PERMISSION_GROUPS } from '@/types';

import { RoleDefinitionFormModal } from './modals/RoleDefinitionFormModal';
import { DeleteRoleDefinitionModal } from './modals/DeleteRoleDefinitionModal';
import { AddUserModal } from './modals/AddUserModal';
import { EditUserModal } from './modals/EditUserModal';
import { DeactivateUserModal } from './modals/DeactivateUserModal';
import { PermissionsDetailModal } from './modals/PermissionsDetailModal';

// Color tones cycled for badges
const BADGE_TONES: Array<'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new'> = [
  'critical',
  'warning',
  'info',
  'success',
  'new',
  'attention',
];

function getBadgeTone(index: number) {
  return BADGE_TONES[index % BADGE_TONES.length];
}

// Avatar component — shows real profile image when available, initials as fallback
function UserAvatar({ name, status, avatarUrl }: { name: string; status: string; avatarUrl?: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const isBaja = status === 'baja';
  const size = 36;

  if (avatarUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          border: `2px solid ${isBaja ? 'var(--p-color-border-disabled)' : 'var(--p-color-border-info)'}`,
          opacity: isBaja ? 0.5 : 1,
        }}
      >
        <img
          src={avatarUrl}
          alt={name}
          width={size}
          height={size}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        background: isBaja ? 'var(--p-color-bg-fill-disabled)' : 'var(--p-color-bg-fill-info)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Text as="span" variant="bodySm" fontWeight="bold" tone={isBaja ? 'subdued' : undefined}>
        {initials || '??'}
      </Text>
    </div>
  );
}

export function RolesManager() {
  const { user } = useAuth();
  const roleDefinitions = useDashboardStore((s) => s.roleDefinitions);
  const userRoles = useDashboardStore((s) => s.userRoles);
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const fetchRoleDefinitions = useDashboardStore((s) => s.fetchRoleDefinitions);
  const createRoleDefinition = useDashboardStore((s) => s.createRoleDefinition);
  const updateRoleDefinition = useDashboardStore((s) => s.updateRoleDefinition);
  const deleteRoleDefinition = useDashboardStore((s) => s.deleteRoleDefinition);
  const fetchRoles = useDashboardStore((s) => s.fetchRoles);
  const createUserWithRole = useDashboardStore((s) => s.createUserWithRole);
  const updateRole = useDashboardStore((s) => s.updateRole);
  const updateUserPin = useDashboardStore((s) => s.updateUserPin);
  const _removeRole = useDashboardStore((s) => s.removeRole);
  const ensureOwnerRole = useDashboardStore((s) => s.ensureOwnerRole);
  const generateGlobalId = useDashboardStore((s) => s.generateGlobalId);
  const deactivateUser = useDashboardStore((s) => s.deactivateUser);
  const reactivateUser = useDashboardStore((s) => s.reactivateUser);
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [userSearch, setUserSearch] = useState('');

  // Role definition modal flags
  const [roleDefOpen, setRoleDefOpen] = useState(false);
  const [editingRoleDef, setEditingRoleDef] = useState<RoleDefinition | null>(null);
  const [deleteRoleDefOpen, setDeleteRoleDefOpen] = useState(false);
  const [deletingRoleDef, setDeletingRoleDef] = useState<RoleDefinition | null>(null);

  // User modal flags
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRoleRecord | null>(null);

  // Permissions detail modal
  const [permDetailOpen, setPermDetailOpen] = useState(false);
  const [permDetailRole, setPermDetailRole] = useState<RoleDefinition | null>(null);

  // Build role lookup map
  const roleMap = useMemo(() => {
    const m = new Map<string, RoleDefinition>();
    roleDefinitions.forEach((d) => m.set(d.id, d));
    return m;
  }, [roleDefinitions]);

  // Current user's role definition (to check permissions)
  const currentRoleDef = useMemo(() => {
    if (!currentUserRole) return null;
    return roleMap.get(currentUserRole.roleId) ?? null;
  }, [currentUserRole, roleMap]);

  const canManageRoles = useMemo(() => {
    if (!currentRoleDef) return false;
    return currentRoleDef.permissions.includes('roles.manage');
  }, [currentRoleDef]);

  // Build role select options for user assignment (exclude owner for non-owners)
  const roleSelectOptions = useMemo(() => {
    return roleDefinitions
      .filter((d) => {
        if (currentRoleDef?.name === 'Propietario') return true;
        return d.name !== 'Propietario';
      })
      .map((d) => ({ label: d.name, value: d.id }));
  }, [roleDefinitions, currentRoleDef]);

  // Default role ID for new user form
  const defaultRoleId = useMemo(() => {
    const defaultRole = roleDefinitions.find((d) => d.name === 'Cajero') ?? roleDefinitions[0];
    return defaultRole?.id ?? '';
  }, [roleDefinitions]);

  // KPI stats
  const stats = useMemo(() => {
    const active = userRoles.filter((u) => u.status !== 'baja').length;
    const baja = userRoles.filter((u) => u.status === 'baja').length;
    const withPin = userRoles.filter((u) => u.pinCode).length;
    const withGlobalId = userRoles.filter((u) => u.globalId).length;
    return { total: userRoles.length, active, baja, roles: roleDefinitions.length, withPin, withGlobalId };
  }, [userRoles, roleDefinitions]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return userRoles;
    const q = userSearch.toLowerCase();
    return userRoles.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.globalId && u.globalId.toLowerCase().includes(q)) ||
        roleMap.get(u.roleId)?.name.toLowerCase().includes(q),
    );
  }, [userRoles, userSearch, roleMap]);

  useEffect(() => {
    const init = async () => {
      try {
        if (user) {
          await ensureOwnerRole(user.uid, user.email || '', user.displayName || '');
        }
        await Promise.all([fetchRoleDefinitions(), fetchRoles()]);
      } catch (err) {
        console.error('Error initializing roles:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, ensureOwnerRole, fetchRoleDefinitions, fetchRoles]);

  // ---- Role Definition handlers ----
  const openNewRoleDef = () => {
    setEditingRoleDef(null);
    setRoleDefOpen(true);
  };

  const openEditRoleDef = (def: RoleDefinition) => {
    setEditingRoleDef(def);
    setRoleDefOpen(true);
  };

  const openDeleteRoleDef = (def: RoleDefinition) => {
    setDeletingRoleDef(def);
    setDeleteRoleDefOpen(true);
  };

  const handleSaveRoleDef = useCallback(
    async (data: { name: string; description: string; permissions: PermissionKey[] }) => {
      if (!data.name.trim()) {
        showError('El nombre del rol es obligatorio');
        return;
      }
      if (data.permissions.length === 0) {
        showError('Selecciona al menos un permiso');
        return;
      }
      if (!user) return;
      setSaving(true);
      try {
        if (editingRoleDef) {
          await updateRoleDefinition(editingRoleDef.id, {
            name: data.name.trim(),
            description: data.description.trim(),
            permissions: data.permissions,
          });
          showSuccess(`Rol "${data.name.trim()}" actualizado`);
        } else {
          await createRoleDefinition(
            { name: data.name.trim(), description: data.description.trim(), permissions: data.permissions },
            user.uid,
          );
          showSuccess(`Rol "${data.name.trim()}" creado`);
        }
        setRoleDefOpen(false);
      } catch {
        showError('Error al guardar el rol');
      } finally {
        setSaving(false);
      }
    },
    [editingRoleDef, user, createRoleDefinition, updateRoleDefinition, showSuccess, showError],
  );

  const handleDeleteRoleDef = useCallback(async () => {
    if (!deletingRoleDef) return;
    setSaving(true);
    try {
      await deleteRoleDefinition(deletingRoleDef.id);
      showSuccess(`Rol "${deletingRoleDef.name}" eliminado`);
      setDeleteRoleDefOpen(false);
      setDeletingRoleDef(null);
    } catch {
      showError('Error al eliminar el rol');
    } finally {
      setSaving(false);
    }
  }, [deletingRoleDef, deleteRoleDefinition, showSuccess, showError]);

  // ---- User handlers ----
  const handleAddUser = useCallback(
    async (data: { email: string; displayName: string; password: string; roleId: string; pinCode: string }) => {
      if (!data.email.trim() || !data.password.trim()) {
        showError('El correo y la contraseña son obligatorios');
        return;
      }
      if (data.password.trim().length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres');
        return;
      }
      if (!user || !data.roleId) return;
      setSaving(true);
      try {
        await createUserWithRole(
          {
            email: data.email.trim(),
            password: data.password.trim(),
            displayName: data.displayName.trim(),
            roleId: data.roleId,
            pinCode: data.pinCode.trim() || undefined,
          },
          user.uid,
        );

        const roleName = roleMap.get(data.roleId)?.name ?? '';
        showSuccess(`Usuario creado y Rol ${roleName} asignado a ${data.email}`);
        setAddOpen(false);
      } catch (error: unknown) {
        console.error(error);
        const err = error as { message?: string; errorInfo?: { code?: string } };
        if (err.message?.includes('FirebaseAuthError') || err.errorInfo?.code === 'auth/email-already-exists') {
          showError('Error: El correo electrónico ya está registrado en la base de datos.');
        } else {
          showError('Error al crear el usuario y asignar el rol');
        }
      } finally {
        setSaving(false);
      }
    },
    [user, createUserWithRole, roleMap, showSuccess, showError],
  );

  const handleEditUser = useCallback(
    async (data: { roleId: string; pinCode: string }) => {
      if (!selectedUser || !user) return;
      setSaving(true);
      try {
        await updateRole(selectedUser.firebaseUid, data.roleId, user.uid);
        if (data.pinCode.trim()) {
          await updateUserPin(selectedUser.firebaseUid, data.pinCode.trim());
        }
        const roleName = roleMap.get(data.roleId)?.name ?? '';
        showSuccess(`Rol y accesos actualizados a ${roleName}`);
        setEditOpen(false);
        setSelectedUser(null);
      } catch {
        showError('Error al actualizar rol');
      } finally {
        setSaving(false);
      }
    },
    [selectedUser, user, updateRole, updateUserPin, roleMap, showSuccess, showError],
  );

  const handleDeactivateUser = useCallback(async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await deactivateUser(selectedUser.firebaseUid);
      showSuccess(
        `${selectedUser.displayName || selectedUser.email} ha sido dado de baja. Su Global ID queda reservado permanentemente.`,
      );
      setDeleteOpen(false);
      setSelectedUser(null);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Error al dar de baja');
    } finally {
      setSaving(false);
    }
  }, [selectedUser, deactivateUser, showSuccess, showError]);

  const openEditUser = (record: UserRoleRecord) => {
    setSelectedUser(record);
    setEditOpen(true);
  };

  const openDeleteUser = (record: UserRoleRecord) => {
    setSelectedUser(record);
    setDeleteOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card>
        <BlockStack align="center" inlineAlign="center">
          <Box padding="800">
            <BlockStack align="center" inlineAlign="center" gap="400">
              <Spinner size="large" />
              <Text as="p" variant="bodyMd" tone="subdued">
                Cargando equipo y roles...
              </Text>
            </BlockStack>
          </Box>
        </BlockStack>
      </Card>
    );
  }

  if (!canManageRoles) {
    return (
      <Card>
        <Banner tone="warning" title="Acceso restringido">
          <p>Solo usuarios con el permiso de gestión de roles pueden acceder a esta sección.</p>
        </Banner>
      </Card>
    );
  }

  // ── KPI Summary Cards ──
  const kpiSection = (
    <InlineGrid columns={{ xs: 2, sm: 4 }} gap="300">
      <Card>
        <BlockStack gap="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Total Usuarios
          </Text>
          <Text as="p" variant="headingLg" fontWeight="bold">
            {stats.total}
          </Text>
          <ProgressBar
            progress={stats.total > 0 ? 100 : 0}
            size="small"
            tone="primary"
          />
          <Text as="p" variant="bodyXs" tone="subdued">
            {stats.withGlobalId} con Global ID
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Activos
          </Text>
          <InlineStack gap="200" blockAlign="center">
            <Text as="p" variant="headingLg" fontWeight="bold">
              {stats.active}
            </Text>
            <Badge tone="success">En línea</Badge>
          </InlineStack>
          <ProgressBar
            progress={stats.total > 0 ? (stats.active / stats.total) * 100 : 0}
            size="small"
            tone="success"
          />
          <Text as="p" variant="bodyXs" tone="subdued">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% del equipo
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Dados de Baja
          </Text>
          <InlineStack gap="200" blockAlign="center">
            <Text as="p" variant="headingLg" fontWeight="bold">
              {stats.baja}
            </Text>
            {stats.baja > 0 && <Badge tone="critical">Inactivos</Badge>}
          </InlineStack>
          <ProgressBar
            progress={stats.total > 0 ? (stats.baja / stats.total) * 100 : 0}
            size="small"
            tone="critical"
          />
          <Text as="p" variant="bodyXs" tone="subdued">
            {stats.withPin} con PIN de autorización
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Roles Definidos
          </Text>
          <Text as="p" variant="headingLg" fontWeight="bold">
            {stats.roles}
          </Text>
          <ProgressBar
            progress={stats.roles > 0 ? 100 : 0}
            size="small"
            tone="highlight"
          />
          <Text as="p" variant="bodyXs" tone="subdued">
            {roleDefinitions.filter((d) => d.isSystem).length} de sistema · {roleDefinitions.filter((d) => !d.isSystem).length} personalizados
          </Text>
        </BlockStack>
      </Card>
    </InlineGrid>
  );

  // ── USERS TAB CONTENT ──
  const userRows = filteredUsers.map((record, index) => {
    const roleDef = roleMap.get(record.roleId);
    const roleIndex = roleDefinitions.findIndex((d) => d.id === record.roleId);
    const isOwnerUser = roleDef?.name === 'Propietario';
    const isSelf = record.firebaseUid === user?.uid;
    const isBaja = record.status === 'baja';

    return (
      <IndexTable.Row id={record.id} key={record.id} position={index} tone={isBaja ? 'subdued' : undefined}>
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <UserAvatar name={record.displayName || record.email} status={record.status} avatarUrl={record.avatarUrl || undefined} />
            <BlockStack gap="050">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="bodyMd" fontWeight="semibold" as="span" tone={isBaja ? 'subdued' : undefined}>
                  {record.displayName || '(sin nombre)'}
                </Text>
                {isSelf && <Badge tone="info">Tú</Badge>}
                {isBaja && <Badge tone="critical">Baja</Badge>}
              </InlineStack>
              <Text variant="bodyXs" as="span" tone="subdued">
                {record.email}
              </Text>
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={roleIndex >= 0 ? getBadgeTone(roleIndex) : 'new'}>{roleDef?.name || 'Sin rol'}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {record.globalId ? (
            <Badge tone="success">{record.globalId}</Badge>
          ) : (
            <Text variant="bodySm" as="span" tone="subdued">
              —
            </Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            {record.pinCode && <Badge tone="info" size="small">PIN</Badge>}
            <Badge tone={isBaja ? 'critical' : 'success'} size="small">
              {isBaja ? 'Inactivo' : 'Activo'}
            </Badge>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" as="span" tone="subdued">
            {formatDate(record.createdAt)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            {!isOwnerUser && !isSelf && !isBaja && (
              <>
                {!record.globalId && (
                  <Button
                    size="micro"
                    variant="primary"
                    onClick={async () => {
                      try {
                        const gid = await generateGlobalId(record.firebaseUid);
                        showSuccess(`Global ID generado: ${gid}`);
                      } catch (e: unknown) {
                        showError(e instanceof Error ? e.message : 'Error al generar Global ID');
                      }
                    }}
                  >
                    Generar ID
                  </Button>
                )}
                <Button size="micro" icon={EditIcon} onClick={() => openEditUser(record)}>
                  Editar
                </Button>
                <Button size="micro" tone="critical" onClick={() => openDeleteUser(record)}>
                  Dar de baja
                </Button>
              </>
            )}
            {!isOwnerUser && !isSelf && isBaja && (
              <Button
                size="micro"
                onClick={async () => {
                  try {
                    await reactivateUser(record.firebaseUid);
                    showSuccess(`${record.displayName || record.email} ha sido reactivado`);
                  } catch (e: unknown) {
                    showError(e instanceof Error ? e.message : 'Error al reactivar');
                  }
                }}
              >
                Reactivar
              </Button>
            )}
            {isOwnerUser && (
              <>
                {!record.globalId && (
                  <Button
                    size="micro"
                    variant="primary"
                    onClick={async () => {
                      try {
                        const gid = await generateGlobalId(record.firebaseUid);
                        showSuccess(`Global ID generado: ${gid}`);
                      } catch (e: unknown) {
                        showError(e instanceof Error ? e.message : 'Error al generar Global ID');
                      }
                    }}
                  >
                    Generar ID
                  </Button>
                )}
                <Text variant="bodySm" as="span" tone="subdued">
                  Propietario
                </Text>
              </>
            )}
            {isSelf && !isOwnerUser && (
              <Text variant="bodySm" as="span" tone="subdued">
                Tu cuenta
              </Text>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const usersContent = (
    <BlockStack gap="400">
      {/* Search + Add */}
      <InlineStack align="space-between" blockAlign="end" gap="300">
        <Box minWidth="280px" maxWidth="400px">
          <TextField
            label=""
            labelHidden
            value={userSearch}
            onChange={setUserSearch}
            placeholder="Buscar por nombre, correo, ID o rol..."
            prefix={<span><SearchIcon /></span>}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setUserSearch('')}
          />
        </Box>
        <Button variant="primary" icon={PersonAddIcon} onClick={() => setAddOpen(true)}>
          Agregar usuario
        </Button>
      </InlineStack>

      {filteredUsers.length === 0 && userSearch ? (
        <Card>
          <EmptyState heading={`Sin resultados para "${userSearch}"`} image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg">
            <p>Intenta con otro término de búsqueda.</p>
          </EmptyState>
        </Card>
      ) : userRoles.length === 0 ? (
        <Card>
          <EmptyState heading="Sin usuarios registrados" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg">
            <p>Agrega usuarios a tu tienda y asígnales un rol para controlar su acceso.</p>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <IndexTable
            resourceName={{ singular: 'usuario', plural: 'usuarios' }}
            itemCount={filteredUsers.length}
            headings={[
              { title: 'Usuario' },
              { title: 'Rol' },
              { title: 'Global ID' },
              { title: 'Estado' },
              { title: 'Desde' },
              { title: 'Acciones' },
            ]}
            selectable={false}
          >
            {userRows}
          </IndexTable>
        </Card>
      )}
    </BlockStack>
  );

  // ── ROLES TAB CONTENT ──
  const totalPermissions = PERMISSION_GROUPS.reduce((s, g) => s + g.permissions.length, 0);

  const rolesContent = (
    <BlockStack gap="400">
      <InlineStack align="end">
        <Button variant="primary" icon={PlusIcon} onClick={openNewRoleDef}>
          Crear rol
        </Button>
      </InlineStack>

      {roleDefinitions.length === 0 ? (
        <Card>
          <EmptyState heading="Sin roles definidos" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg">
            <p>Crea tu primer rol personalizado para empezar a gestionar accesos.</p>
          </EmptyState>
        </Card>
      ) : (
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="300">
          {roleDefinitions.map((def, index) => {
            const tone = getBadgeTone(index);
            const usersInRole = userRoles.filter((u) => u.roleId === def.id);
            const activeInRole = usersInRole.filter((u) => u.status !== 'baja').length;
            const permPct = totalPermissions > 0 ? (def.permissions.length / totalPermissions) * 100 : 0;

            return (
              <Card key={def.id}>
                <BlockStack gap="300">
                  {/* Header */}
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone={tone}>{def.name}</Badge>
                      {def.isSystem && (
                        <Badge tone="new" size="small">Sistema</Badge>
                      )}
                    </InlineStack>
                    <Text as="span" variant="bodyXs" tone="subdued">
                      {usersInRole.length} usuario{usersInRole.length !== 1 ? 's' : ''}
                    </Text>
                  </InlineStack>

                  {/* Description */}
                  <Text as="p" variant="bodySm" tone="subdued">
                    {def.description || 'Sin descripción'}
                  </Text>

                  <Divider />

                  {/* Permissions summary */}
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyXs" tone="subdued">
                        Permisos
                      </Text>
                      <Button
                        size="micro"
                        variant="plain"
                        onClick={() => {
                          setPermDetailRole(def);
                          setPermDetailOpen(true);
                        }}
                      >
                        {`${def.permissions.length} de ${totalPermissions}`}
                      </Button>
                    </InlineStack>
                    <ProgressBar
                      progress={permPct}
                      size="small"
                      tone={permPct >= 80 ? 'success' : permPct >= 40 ? 'highlight' : 'primary'}
                    />
                    {/* Groups summary chips */}
                    <InlineStack gap="100" wrap>
                      {PERMISSION_GROUPS.map((group) => {
                        const active = group.permissions.filter((p) => def.permissions.includes(p)).length;
                        if (active === 0) return null;
                        return (
                          <Badge
                            key={group.title}
                            size="small"
                            tone={active === group.permissions.length ? 'success' : undefined}
                          >
                            {`${group.title} ${active}/${group.permissions.length}`}
                          </Badge>
                        );
                      })}
                    </InlineStack>
                  </BlockStack>

                  <Divider />

                  {/* Users in this role */}
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="100">
                      {usersInRole.slice(0, 3).map((u) => (
                        <UserAvatar key={u.id} name={u.displayName || u.email} status={u.status} avatarUrl={u.avatarUrl || undefined} />
                      ))}
                      {usersInRole.length > 3 && (
                        <Text as="span" variant="bodyXs" tone="subdued">+{usersInRole.length - 3}</Text>
                      )}
                      {usersInRole.length === 0 && (
                        <Text as="span" variant="bodyXs" tone="subdued">Sin usuarios asignados</Text>
                      )}
                    </InlineStack>
                    <Text as="span" variant="bodyXs" tone="subdued">
                      {activeInRole} activo{activeInRole !== 1 ? 's' : ''}
                    </Text>
                  </InlineStack>

                  {/* Actions */}
                  <InlineStack gap="200">
                    {!def.isSystem && (
                      <>
                        <Button size="micro" icon={EditIcon} onClick={() => openEditRoleDef(def)}>
                          Editar
                        </Button>
                        <Button size="micro" icon={DeleteIcon} tone="critical" onClick={() => openDeleteRoleDef(def)}>
                          Eliminar
                        </Button>
                      </>
                    )}
                    {def.isSystem && def.name !== 'Propietario' && (
                      <Button size="micro" icon={EditIcon} onClick={() => openEditRoleDef(def)}>
                        Editar permisos
                      </Button>
                    )}
                    {def.isSystem && def.name === 'Propietario' && (
                      <Text variant="bodySm" as="span" tone="subdued">
                        Protegido
                      </Text>
                    )}
                  </InlineStack>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      )}
    </BlockStack>
  );

  // ── TABS ──
  const tabs = [
    {
      id: 'equipo',
      content: `Equipo (${userRoles.length})`,
      panelID: 'equipo-panel',
    },
    {
      id: 'roles',
      content: `Roles (${roleDefinitions.length})`,
      panelID: 'roles-panel',
    },
  ];

  return (
    <BlockStack gap="400">
      {/* KPI Summary */}
      {kpiSection}

      {/* Tabs: Equipo | Roles */}
      <Card padding="0">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box padding="400">
            {selectedTab === 0 && usersContent}
            {selectedTab === 1 && rolesContent}
          </Box>
        </Tabs>
      </Card>

      {/* ====== MODALS ====== */}
      <RoleDefinitionFormModal
        open={roleDefOpen}
        onClose={() => setRoleDefOpen(false)}
        editingRoleDef={editingRoleDef}
        onSave={handleSaveRoleDef}
        saving={saving}
      />

      <DeleteRoleDefinitionModal
        open={deleteRoleDefOpen}
        onClose={() => {
          setDeleteRoleDefOpen(false);
          setDeletingRoleDef(null);
        }}
        roleDef={deletingRoleDef}
        onDelete={handleDeleteRoleDef}
        saving={saving}
      />

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddUser}
        saving={saving}
        roleSelectOptions={roleSelectOptions}
        roleMap={roleMap}
        defaultRoleId={defaultRoleId}
      />

      <EditUserModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedUser(null);
        }}
        selectedUser={selectedUser}
        onSave={handleEditUser}
        saving={saving}
        roleSelectOptions={roleSelectOptions}
        roleMap={roleMap}
      />

      <DeactivateUserModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedUser(null);
        }}
        selectedUser={selectedUser}
        onDeactivate={handleDeactivateUser}
        saving={saving}
      />

      <PermissionsDetailModal
        open={permDetailOpen}
        onClose={() => {
          setPermDetailOpen(false);
          setPermDetailRole(null);
        }}
        roleDef={permDetailRole}
      />
    </BlockStack>
  );
}
