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
  TextField,
  Divider,
} from '@shopify/polaris';
import {
  PersonAddIcon,
  DeleteIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import type { RoleDefinition, UserRoleRecord, PermissionKey, TenantInvitation } from '@/types';
import { PERMISSION_GROUPS } from '@/types';
import styles from './RolesManager.module.css';

import { RoleDefinitionFormModal } from './modals/RoleDefinitionFormModal';
import { DeleteRoleDefinitionModal } from './modals/DeleteRoleDefinitionModal';
import { AddUserModal } from './modals/AddUserModal';
import { EditUserModal } from './modals/EditUserModal';
import { DeactivateUserModal } from './modals/DeactivateUserModal';
import { PermissionsDetailModal } from './modals/PermissionsDetailModal';
import { TransferOwnershipModal } from './modals/TransferOwnershipModal';
import { PolarisOptionDropdown } from './PolarisOptionDropdown';
import {
  createTenantInvitation,
  listTenantInvitations,
  revokeTenantInvitation,
} from '@/app/actions/tenant-invitation-actions';
import { transferTenantOwnership } from '@/app/actions/tenant-lifecycle-actions';

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

const PIN_REGEX = /^\d{4,6}$/;
type UserStatusFilter = 'all' | 'active' | 'inactive' | 'pin' | 'missingGlobalId';

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
  const updateRole = useDashboardStore((s) => s.updateRole);
  const updateUserPin = useDashboardStore((s) => s.updateUserPin);
  const deactivateUser = useDashboardStore((s) => s.deactivateUser);
  const reactivateUser = useDashboardStore((s) => s.reactivateUser);
  const getUserRole = useDashboardStore((s) => s.getUserRole);
  const generateGlobalId = useDashboardStore((s) => s.generateGlobalId);
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);

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
  const [transferOwnershipOpen, setTransferOwnershipOpen] = useState(false);

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

  // Permission check: if role definitions aren't loaded yet, assume access
  // (the server-side guard enforces the real check). Once loaded, verify client-side.
  const canManageRoles = useMemo(() => {
    // If we haven't loaded role definitions yet, allow access (server enforces)
    if (roleDefinitions.length === 0) return true;
    if (!currentRoleDef) return false;
    if (currentRoleDef.name === 'Propietario' || currentRoleDef.name === 'Administrador') return true;
    return currentRoleDef.permissions.includes('roles.manage');
  }, [currentRoleDef, roleDefinitions.length]);

  // The tenant owner is created only during self-service provisioning.
  const roleSelectOptions = useMemo(() => {
    return roleDefinitions
      .filter((d) => d.name !== 'Propietario')
      .map((d) => ({ label: d.name, value: d.id }));
  }, [roleDefinitions]);

  // Default role ID for new user form
  const defaultRoleId = useMemo(() => {
    const assignableRoles = roleDefinitions.filter((d) => d.name !== 'Propietario');
    const defaultRole = assignableRoles.find((d) => d.name === 'Cajero') ?? assignableRoles[0];
    return defaultRole?.id ?? '';
  }, [roleDefinitions]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return userRoles.filter((u) => {
      const roleName = roleMap.get(u.roleId)?.name.toLowerCase() ?? '';
      const matchesSearch =
        q.length === 0 ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        Boolean(u.globalId?.toLowerCase().includes(q)) ||
        roleName.includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.status !== 'baja') ||
        (statusFilter === 'inactive' && u.status === 'baja') ||
        (statusFilter === 'pin' && Boolean(u.pinCode)) ||
        (statusFilter === 'missingGlobalId' && !u.globalId);
      const matchesRole = roleFilter === 'all' || u.roleId === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [userRoles, userSearch, roleMap, statusFilter, roleFilter]);

  const roleFilterOptions = useMemo(
    () => [
      { label: 'Todos los roles', value: 'all' },
      ...roleDefinitions.map((role) => ({ label: role.name, value: role.id })),
    ],
    [roleDefinitions],
  );

  const hasUserFilters = Boolean(userSearch.trim()) || statusFilter !== 'all' || roleFilter !== 'all';

  const refreshInvitations = useCallback(async () => {
    const rows = await listTenantInvitations();
    setInvitations(rows);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        if (user) {
          await getUserRole(user.userId);
        }
        await Promise.all([fetchRoleDefinitions(), fetchRoles(), refreshInvitations()]);
      } catch (err) {
        console.error('Error initializing roles:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, getUserRole, fetchRoleDefinitions, fetchRoles, refreshInvitations]);

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

  const openCreateRoleFromUserFlow = () => {
    setAddOpen(false);
    setSelectedTab(1);
    setEditingRoleDef(null);
    setRoleDefOpen(true);
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
            user.userId,
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
    async (data: { email: string; roleId: string }) => {
      const email = data.email.trim().toLowerCase();

      if (!email) {
        showError('El correo es obligatorio');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('Ingresa un correo electrónico válido');
        return;
      }
      if (!data.roleId) return;
      setSaving(true);
      try {
        await createTenantInvitation({ email, roleId: data.roleId });
        await refreshInvitations();

        const roleName = roleMap.get(data.roleId)?.name ?? '';
        showSuccess(`Invitación enviada a ${email} con el rol ${roleName}`);
        setAddOpen(false);
      } catch (error: unknown) {
        showError(error instanceof Error ? error.message : 'No fue posible enviar la invitación');
      } finally {
        setSaving(false);
      }
    },
    [roleMap, showSuccess, showError, refreshInvitations],
  );

  const handleRevokeInvitation = useCallback(
    async (invitation: TenantInvitation) => {
      setSaving(true);
      try {
        await revokeTenantInvitation(invitation.id);
        await refreshInvitations();
        showSuccess(`Invitación para ${invitation.email} revocada`);
      } catch (error: unknown) {
        showError(error instanceof Error ? error.message : 'No fue posible revocar la invitación');
      } finally {
        setSaving(false);
      }
    },
    [refreshInvitations, showError, showSuccess],
  );

  const handleTransferOwnership = useCallback(
    async (data: { targetCognitoSub: string; previousOwnerRoleId: string }) => {
      setSaving(true);
      try {
        await transferTenantOwnership(data);
        await fetchRoles();
        setTransferOwnershipOpen(false);
        showSuccess('La propiedad del negocio se transfirió correctamente');
      } catch (error: unknown) {
        showError(error instanceof Error ? error.message : 'No fue posible transferir la propiedad');
      } finally {
        setSaving(false);
      }
    },
    [fetchRoles, showError, showSuccess],
  );

  const handleEditUser = useCallback(
    async (data: { roleId: string; pinCode: string }) => {
      if (!selectedUser || !user) return;
      const pinCode = data.pinCode.trim();
      if (!data.roleId) {
        showError('Selecciona un rol válido');
        return;
      }
      if (pinCode && !PIN_REGEX.test(pinCode)) {
        showError('El PIN debe tener de 4 a 6 dígitos numéricos');
        return;
      }
      setSaving(true);
      try {
        await updateRole(selectedUser.cognitoSub, data.roleId, user.userId);
        if (pinCode) {
          await updateUserPin(selectedUser.cognitoSub, pinCode);
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
      await deactivateUser(selectedUser.cognitoSub);
      await fetchRoles();
      showSuccess(
        `${selectedUser.displayName || selectedUser.email} fue bloqueado y marcado como baja. Su ID interno queda reservado permanentemente.`,
      );
      setDeleteOpen(false);
      setSelectedUser(null);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Error al dar de baja');
    } finally {
      setSaving(false);
    }
  }, [selectedUser, deactivateUser, fetchRoles, showSuccess, showError]);

  const handleReactivateUser = useCallback(
    async (record: UserRoleRecord) => {
      setSaving(true);
      try {
        await reactivateUser(record.cognitoSub);
        await fetchRoles();
        showSuccess(`${record.displayName || record.email} fue reactivado correctamente`);
      } catch (e: unknown) {
        showError(e instanceof Error ? e.message : 'Error al reactivar');
      } finally {
        setSaving(false);
      }
    },
    [reactivateUser, fetchRoles, showSuccess, showError],
  );

  const handleGenerateGlobalId = useCallback(
    async (record: UserRoleRecord) => {
      try {
        const gid = await generateGlobalId(record.cognitoSub);
        await fetchRoles();
        showSuccess(`ID interno generado: ${gid}`);
      } catch (e: unknown) {
        showError(e instanceof Error ? e.message : 'Error al generar el ID interno');
      }
    },
    [fetchRoles, generateGlobalId, showSuccess, showError],
  );

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

  // ── USERS TAB CONTENT ──
  const userRows = filteredUsers.map((record, index) => {
    const roleDef = roleMap.get(record.roleId);
    const roleIndex = roleDefinitions.findIndex((d) => d.id === record.roleId);
    const isOwnerUser = roleDef?.name === 'Propietario';
    const isSelf = record.cognitoSub === user?.userId;
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
                    onClick={() => void handleGenerateGlobalId(record)}
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
                loading={saving}
                onClick={() => void handleReactivateUser(record)}
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
                    onClick={() => void handleGenerateGlobalId(record)}
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
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarIntro}>
          <Text as="h3" variant="headingMd" fontWeight="bold">
            Directorio del negocio
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Mostrando {filteredUsers.length} de {userRoles.length} usuario{userRoles.length !== 1 ? 's' : ''}
          </Text>
        </div>

        <div className={styles.toolbarControls}>
          <div className={styles.searchControl}>
            <TextField
              label=""
              labelHidden
              value={userSearch}
              onChange={setUserSearch}
              placeholder="Buscar usuario, correo, ID o rol"
              prefix={<span><SearchIcon /></span>}
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setUserSearch('')}
            />
          </div>
          <div className={styles.filterControl}>
            <PolarisOptionDropdown
              label="Estado"
              labelHidden
              options={[
                { label: 'Todos los estados', value: 'all' },
                { label: 'Activos', value: 'active' },
                { label: 'Dados de baja', value: 'inactive' },
                { label: 'Con PIN', value: 'pin' },
                { label: 'Sin ID interno', value: 'missingGlobalId' },
              ]}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as UserStatusFilter)}
            />
          </div>
          <div className={styles.filterControl}>
            <PolarisOptionDropdown
              label="Rol"
              labelHidden
              options={roleFilterOptions}
              value={roleFilter}
              onChange={setRoleFilter}
            />
          </div>
          {hasUserFilters && (
            <Button
              onClick={() => {
                setUserSearch('');
                setStatusFilter('all');
                setRoleFilter('all');
              }}
            >
              Limpiar
            </Button>
          )}
          {currentRoleDef?.name === 'Propietario' && (
            <Button tone="critical" onClick={() => setTransferOwnershipOpen(true)}>
              Transferir propiedad
            </Button>
          )}
          <Button variant="primary" icon={PersonAddIcon} onClick={() => setAddOpen(true)}>
            Agregar usuario
          </Button>
        </div>
      </div>

      {filteredUsers.length === 0 && hasUserFilters ? (
        <Card>
          <EmptyState heading="Sin resultados con los filtros actuales" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg">
            <p>Ajusta la búsqueda, el estado o el rol para ampliar los resultados.</p>
          </EmptyState>
        </Card>
      ) : userRoles.length === 0 ? (
        <Card>
          <EmptyState heading="Sin usuarios registrados" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg">
            <p>Agrega usuarios a tu tienda y asígnales un rol para controlar su acceso.</p>
          </EmptyState>
        </Card>
      ) : (
        <div className={styles.tableSurface}>
          <IndexTable
            resourceName={{ singular: 'usuario', plural: 'usuarios' }}
            itemCount={filteredUsers.length}
            headings={[
              { title: 'Usuario' },
              { title: 'Rol' },
              { title: 'ID interno' },
              { title: 'Estado' },
              { title: 'Desde' },
              { title: 'Acciones' },
            ]}
            selectable={false}
          >
            {userRows}
          </IndexTable>
        </div>
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
            const visiblePermissionGroups = PERMISSION_GROUPS.map((group) => {
              const active = group.permissions.filter((p) => def.permissions.includes(p)).length;
              return { title: group.title, active, total: group.permissions.length };
            }).filter((group) => group.active > 0);

            return (
              <div className={styles.roleCard} key={def.id}>
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
                    {visiblePermissionGroups.length > 0 ? (
                      <InlineStack gap="100" wrap>
                        {visiblePermissionGroups.map((group) => (
                          <Badge
                            key={group.title}
                            size="small"
                            tone={group.active === group.total ? 'success' : undefined}
                          >
                            {`${group.title} ${group.active}/${group.total}`}
                          </Badge>
                        ))}
                      </InlineStack>
                    ) : (
                      <Text as="p" variant="bodySm" tone="subdued">
                        Sin permisos asignados
                      </Text>
                    )}
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
                    {def.isSystem && (
                      <Text variant="bodySm" as="span" tone="subdued">
                        Protegido
                      </Text>
                    )}
                  </InlineStack>
                </BlockStack>
              </div>
            );
          })}
        </InlineGrid>
      )}
    </BlockStack>
  );

  const invitationRows = invitations.map((invitation, index) => {
    const roleName = roleMap.get(invitation.roleId)?.name ?? 'Rol no disponible';
    const statusPresentation: Record<
      TenantInvitation['status'],
      { label: string; tone: 'attention' | 'success' | 'critical' | 'info' }
    > = {
      pending: { label: 'Pendiente', tone: 'attention' },
      accepted: { label: 'Aceptada', tone: 'success' },
      revoked: { label: 'Revocada', tone: 'critical' },
      expired: { label: 'Vencida', tone: 'info' },
    };
    const status = statusPresentation[invitation.status];

    return (
      <IndexTable.Row id={invitation.id} key={invitation.id} position={index}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {invitation.email}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{roleName}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status.tone}>{status.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm" tone="subdued">
            {formatDate(invitation.expiresAt)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {invitation.status === 'pending' ? (
            <Button
              size="micro"
              tone="critical"
              loading={saving}
              onClick={() => void handleRevokeInvitation(invitation)}
            >
              Revocar
            </Button>
          ) : (
            <Text as="span" variant="bodySm" tone="subdued">
              Sin acciones
            </Text>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const invitationsContent = (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd" fontWeight="bold">
            Invitaciones del negocio
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Cada invitación vence automáticamente y solo puede aceptarla el correo destinatario.
          </Text>
        </BlockStack>
        <Button variant="primary" icon={PersonAddIcon} onClick={() => setAddOpen(true)}>
          Invitar usuario
        </Button>
      </InlineStack>

      {invitations.length === 0 ? (
        <EmptyState
          heading="No hay invitaciones"
          image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg"
        >
          <p>Las invitaciones enviadas aparecerán aquí con su estado y vencimiento.</p>
        </EmptyState>
      ) : (
        <div className={styles.tableSurface}>
          <IndexTable
            resourceName={{ singular: 'invitación', plural: 'invitaciones' }}
            itemCount={invitations.length}
            headings={[
              { title: 'Correo' },
              { title: 'Rol' },
              { title: 'Estado' },
              { title: 'Vence' },
              { title: 'Acciones' },
            ]}
            selectable={false}
          >
            {invitationRows}
          </IndexTable>
        </div>
      )}
    </BlockStack>
  );

  // ── TABS ──
  const tabs = [
    {
      id: 'local-access',
      content: `Usuarios (${userRoles.length})`,
      panelID: 'local-access-panel',
    },
    {
      id: 'roles',
      content: `Roles y permisos (${roleDefinitions.length})`,
      panelID: 'roles-panel',
    },
    {
      id: 'invitations',
      content: `Invitaciones (${invitations.filter((invitation) => invitation.status === 'pending').length})`,
      panelID: 'invitations-panel',
    },
  ];

  return (
    <BlockStack gap="400">
      {/* Tabs */}
      <Card padding="0">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box padding="500">
            {selectedTab === 0 && usersContent}
            {selectedTab === 1 && rolesContent}
            {selectedTab === 2 && invitationsContent}
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
        onCreateRole={openCreateRoleFromUserFlow}
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

      <TransferOwnershipModal
        open={transferOwnershipOpen}
        onClose={() => setTransferOwnershipOpen(false)}
        onTransfer={handleTransferOwnership}
        saving={saving}
        currentUserId={user?.userId ?? ''}
        users={userRoles}
        roles={roleDefinitions}
      />
    </BlockStack>
  );
}
