'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Modal,
  FormLayout,
  EmptyState,
  Box,
  Divider,
  Banner,
  Spinner,
  Checkbox,
  InlineGrid,
} from '@shopify/polaris';
import { PersonAddIcon, DeleteIcon, EditIcon, PlusIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import type { RoleDefinition, UserRoleRecord, PermissionKey } from '@/types';
import { PERMISSION_LABELS, PERMISSION_GROUPS } from '@/types';

// Color tones cycled for badges
const BADGE_TONES: Array<'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new'> = [
  'critical', 'warning', 'info', 'success', 'new', 'attention',
];

function getBadgeTone(index: number) {
  return BADGE_TONES[index % BADGE_TONES.length];
}

export function RolesManager() {
  const { user } = useAuth();
  const {
    roleDefinitions,
    userRoles,
    currentUserRole,
    fetchRoleDefinitions,
    createRoleDefinition,
    updateRoleDefinition,
    deleteRoleDefinition,
    fetchRoles,
    createUserWithRole,
    assignRole,
    updateRole,
    updateUserPin,
    removeRole,
    ensureOwnerRole,
    generateGlobalId,
    deactivateUser,
    reactivateUser,
  } = useDashboardStore();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);

  // Role definition modals
  const [roleDefOpen, setRoleDefOpen] = useState(false);
  const [editingRoleDef, setEditingRoleDef] = useState<RoleDefinition | null>(null);
  const [deleteRoleDefOpen, setDeleteRoleDefOpen] = useState(false);
  const [deletingRoleDef, setDeletingRoleDef] = useState<RoleDefinition | null>(null);
  const [roleDefName, setRoleDefName] = useState('');
  const [roleDefDesc, setRoleDefDesc] = useState('');
  const [roleDefPerms, setRoleDefPerms] = useState<PermissionKey[]>([]);

  // User assignment modals
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRoleRecord | null>(null);

  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [formPinCode, setFormPinCode] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editPinCode, setEditPinCode] = useState('');
  const [saving, setSaving] = useState(false);

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

  // Determine owner role definition
  const ownerRoleDef = useMemo(() => {
    return roleDefinitions.find((d) => d.isSystem && d.name === 'Propietario') ?? null;
  }, [roleDefinitions]);

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

  // Set default formRoleId once roleDefinitions load
  useEffect(() => {
    if (roleDefinitions.length > 0 && !formRoleId) {
      const defaultRole = roleDefinitions.find((d) => d.name === 'Cajero') ?? roleDefinitions[0];
      setFormRoleId(defaultRole.id);
    }
  }, [roleDefinitions, formRoleId]);

  // ---- Role Definition handlers ----
  const openNewRoleDef = () => {
    setEditingRoleDef(null);
    setRoleDefName('');
    setRoleDefDesc('');
    setRoleDefPerms([]);
    setRoleDefOpen(true);
  };

  const openEditRoleDef = (def: RoleDefinition) => {
    setEditingRoleDef(def);
    setRoleDefName(def.name);
    setRoleDefDesc(def.description);
    setRoleDefPerms([...def.permissions]);
    setRoleDefOpen(true);
  };

  const openDeleteRoleDef = (def: RoleDefinition) => {
    setDeletingRoleDef(def);
    setDeleteRoleDefOpen(true);
  };

  const togglePermission = (perm: PermissionKey) => {
    setRoleDefPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveRoleDef = useCallback(async () => {
    if (!roleDefName.trim()) {
      showError('El nombre del rol es obligatorio');
      return;
    }
    if (roleDefPerms.length === 0) {
      showError('Selecciona al menos un permiso');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      if (editingRoleDef) {
        await updateRoleDefinition(editingRoleDef.id, {
          name: roleDefName.trim(),
          description: roleDefDesc.trim(),
          permissions: roleDefPerms,
        });
        showSuccess(`Rol "${roleDefName.trim()}" actualizado`);
      } else {
        await createRoleDefinition(
          { name: roleDefName.trim(), description: roleDefDesc.trim(), permissions: roleDefPerms },
          user.uid
        );
        showSuccess(`Rol "${roleDefName.trim()}" creado`);
      }
      setRoleDefOpen(false);
    } catch {
      showError('Error al guardar el rol');
    } finally {
      setSaving(false);
    }
  }, [roleDefName, roleDefDesc, roleDefPerms, editingRoleDef, user, createRoleDefinition, updateRoleDefinition, showSuccess, showError]);

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
  const resetUserForm = () => {
    setFormEmail('');
    setFormDisplayName('');
    setFormPassword('');
    setFormPinCode('');
    const defaultRole = roleDefinitions.find((d) => d.name === 'Cajero') ?? roleDefinitions[0];
    if (defaultRole) setFormRoleId(defaultRole.id);
  };

  const handleAddUser = useCallback(async () => {
    if (!formEmail.trim() || !formPassword.trim()) {
      showError('El correo y la contraseña son obligatorios');
      return;
    }
    if (formPassword.trim().length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!user || !formRoleId) return;
    setSaving(true);
    try {
      await createUserWithRole(
        {
          email: formEmail.trim(),
          password: formPassword.trim(),
          displayName: formDisplayName.trim(),
          roleId: formRoleId,
          pinCode: formPinCode.trim() || undefined,
        },
        user.uid
      );

      const roleName = roleMap.get(formRoleId)?.name ?? '';
      showSuccess(`Usuario creado y Rol ${roleName} asignado a ${formEmail}`);
      resetUserForm();
      setAddOpen(false);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('FirebaseAuthError') || error?.errorInfo?.code === 'auth/email-already-exists') {
        showError('Error: El correo electrónico ya está registrado en la base de datos.');
      } else {
        showError('Error al crear el usuario y asignar el rol');
      }
    } finally {
      setSaving(false);
    }
  }, [formEmail, formDisplayName, formPassword, formRoleId, formPinCode, user, createUserWithRole, roleMap, showSuccess, showError]);

  const handleEditUser = useCallback(async () => {
    if (!selectedUser || !user) return;
    setSaving(true);
    try {
      await updateRole(selectedUser.firebaseUid, editRoleId, user.uid);
      if (editPinCode.trim()) {
        await updateUserPin(selectedUser.firebaseUid, editPinCode.trim());
      }
      const roleName = roleMap.get(editRoleId)?.name ?? '';
      showSuccess(`Rol y accesos actualizados a ${roleName}`);
      setEditOpen(false);
      setSelectedUser(null);
    } catch {
      showError('Error al actualizar rol');
    } finally {
      setSaving(false);
    }
  }, [selectedUser, editRoleId, editPinCode, user, updateRole, updateUserPin, roleMap, showSuccess, showError]);

  const handleDeleteUser = useCallback(async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await removeRole(selectedUser.firebaseUid);
      showSuccess(`Usuario ${selectedUser.email} eliminado del sistema de roles`);
      setDeleteOpen(false);
      setSelectedUser(null);
    } catch {
      showError('Error al eliminar rol');
    } finally {
      setSaving(false);
    }
  }, [selectedUser, removeRole, showSuccess, showError]);

  const openEditUser = (record: UserRoleRecord) => {
    setSelectedUser(record);
    setEditRoleId(record.roleId);
    setEditPinCode(record.pinCode || '');
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

  // Build role select options for user assignment (exclude owner for non-owners)
  const roleSelectOptions = useMemo(() => {
    return roleDefinitions
      .filter((d) => {
        if (currentRoleDef?.name === 'Propietario') return true;
        return d.name !== 'Propietario';
      })
      .map((d) => ({ label: d.name, value: d.id }));
  }, [roleDefinitions, currentRoleDef]);

  if (loading) {
    return (
      <Card>
        <BlockStack align="center" inlineAlign="center">
          <Box padding="800">
            <BlockStack align="center" inlineAlign="center" gap="400">
              <Spinner size="large" />
              <Text as="p" variant="bodyMd" tone="subdued">Cargando roles...</Text>
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

  // ---- Role Definitions Table Rows ----
  const roleDefRows = roleDefinitions.map((def, index) => {
    const tone = getBadgeTone(index);
    return (
      <IndexTable.Row id={def.id} key={def.id} position={index}>
        <IndexTable.Cell>
          <InlineStack gap="200" blockAlign="center">
            <Badge tone={tone}>{def.name}</Badge>
            {def.isSystem && (
              <Text variant="bodySm" as="span" tone="subdued">(Sistema)</Text>
            )}
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">{def.description}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            size="micro"
            variant="plain"
            onClick={() => { setPermDetailRole(def); setPermDetailOpen(true); }}
          >
            {`${def.permissions.length} permisos`}
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            {!def.isSystem && (
              <>
                <Button size="micro" icon={EditIcon} onClick={() => openEditRoleDef(def)}>Editar</Button>
                <Button size="micro" icon={DeleteIcon} tone="critical" onClick={() => openDeleteRoleDef(def)}>Eliminar</Button>
              </>
            )}
            {def.isSystem && def.name !== 'Propietario' && (
              <Button size="micro" icon={EditIcon} onClick={() => openEditRoleDef(def)}>Editar permisos</Button>
            )}
            {def.isSystem && def.name === 'Propietario' && (
              <Text variant="bodySm" as="span" tone="subdued">Protegido</Text>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const userRows = userRoles.map((record, index) => {
    const roleDef = roleMap.get(record.roleId);
    const roleIndex = roleDefinitions.findIndex((d) => d.id === record.roleId);
    const isOwnerUser = roleDef?.name === 'Propietario';
    const isSelf = record.firebaseUid === user?.uid;
    const isBaja = record.status === 'baja';

    return (
      <IndexTable.Row id={record.id} key={record.id} position={index} tone={isBaja ? 'subdued' : undefined}>
        <IndexTable.Cell>
          <InlineStack gap="200" blockAlign="center">
            <Text variant="bodyMd" fontWeight="bold" as="span" tone={isBaja ? 'subdued' : undefined}>
              {record.displayName || '(sin nombre)'}
            </Text>
            {isBaja && <Badge tone="critical">Baja</Badge>}
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone={isBaja ? 'subdued' : undefined}>{record.email}</Text>
          {record.pinCode && (
            <div style={{ marginTop: '2px' }}>
              <Badge tone="info" size="small">PIN Asignado</Badge>
            </div>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {record.globalId ? (
            <Badge tone="success">{record.globalId}</Badge>
          ) : (
            <Text variant="bodySm" as="span" tone="subdued">Sin Global ID</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={roleIndex >= 0 ? getBadgeTone(roleIndex) : 'new'}>
            {roleDef?.name || 'Sin rol'}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">{formatDate(record.createdAt)}</Text>
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
                <Button size="micro" icon={EditIcon} onClick={() => openEditUser(record)}>Editar</Button>
                <Button
                  size="micro"
                  tone="critical"
                  onClick={() => openDeleteUser(record)}
                >
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
                <Text variant="bodySm" as="span" tone="subdued">Protegido</Text>
              </>
            )}
            {isSelf && !isOwnerUser && (
              <Text variant="bodySm" as="span" tone="subdued">Tu cuenta</Text>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <BlockStack gap="400">
      {/* Info banner */}
      <Banner title="Gestion de Roles" tone="info">
        <p>
          Define roles personalizados con los permisos que necesites y asignalos a los usuarios de tu equipo.
          El primer usuario registrado es automaticamente el Propietario del sistema.
        </p>
      </Banner>

      {/* ====== ROLE DEFINITIONS SECTION ====== */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Definicion de Roles ({roleDefinitions.length})</Text>
            <Button variant="primary" icon={PlusIcon} onClick={openNewRoleDef}>
              Crear rol
            </Button>
          </InlineStack>

          {roleDefinitions.length === 0 ? (
            <EmptyState heading="Sin roles definidos" image="">
              <p>Crea tu primer rol personalizado para empezar a gestionar accesos.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: 'rol', plural: 'roles' }}
              itemCount={roleDefinitions.length}
              headings={[
                { title: 'Nombre' },
                { title: 'Descripcion' },
                { title: 'Permisos' },
                { title: 'Acciones' },
              ]}
              selectable={false}
            >
              {roleDefRows}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      {/* ====== USERS SECTION ====== */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Usuarios y Roles ({userRoles.length})</Text>
            <Button variant="primary" icon={PersonAddIcon} onClick={() => setAddOpen(true)}>
              Agregar usuario
            </Button>
          </InlineStack>

          {userRoles.length === 0 ? (
            <EmptyState heading="Sin usuarios registrados" image="">
              <p>Agrega usuarios a tu tienda y asignales un rol para controlar su acceso.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: 'usuario', plural: 'usuarios' }}
              itemCount={userRoles.length}
              headings={[
                { title: 'Nombre' },
                { title: 'Correo' },
                { title: 'Global ID' },
                { title: 'Rol' },
                { title: 'Desde' },
                { title: 'Acciones' },
              ]}
              selectable={false}
            >
              {userRows}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      {/* ====== ROLE DEFINITION CREATE/EDIT MODAL ====== */}
      <Modal
        open={roleDefOpen}
        onClose={() => setRoleDefOpen(false)}
        title={editingRoleDef ? `Editar rol: ${editingRoleDef.name}` : 'Crear nuevo rol'}
        primaryAction={{
          content: editingRoleDef ? 'Guardar cambios' : 'Crear rol',
          onAction: handleSaveRoleDef,
          loading: saving,
          disabled: !roleDefName.trim() || roleDefPerms.length === 0,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setRoleDefOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Nombre del rol"
              value={roleDefName}
              onChange={setRoleDefName}
              autoComplete="off"
              placeholder="Ej: Cajero Senior"
              disabled={editingRoleDef?.isSystem && editingRoleDef?.name === 'Propietario'}
            />
            <TextField
              label="Descripcion"
              value={roleDefDesc}
              onChange={setRoleDefDesc}
              autoComplete="off"
              multiline={2}
              placeholder="Descripcion breve de lo que puede hacer este rol"
            />
          </FormLayout>
        </Modal.Section>
        <Modal.Section>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingSm" as="h3">
                Permisos ({roleDefPerms.length} seleccionados)
              </Text>
              <InlineStack gap="200">
                <Button
                  size="micro"
                  onClick={() => {
                    const all = PERMISSION_GROUPS.flatMap((g) => g.permissions);
                    setRoleDefPerms(all);
                  }}
                >
                  Seleccionar todos
                </Button>
                <Button size="micro" onClick={() => setRoleDefPerms([])}>
                  Limpiar
                </Button>
              </InlineStack>
            </InlineStack>
            <Divider />
            {PERMISSION_GROUPS.map((group) => (
              <Box key={group.title}>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h4">{group.title}</Text>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="100">
                    {group.permissions.map((perm) => (
                      <Checkbox
                        key={perm}
                        label={PERMISSION_LABELS[perm]}
                        checked={roleDefPerms.includes(perm)}
                        onChange={() => togglePermission(perm)}
                      />
                    ))}
                  </InlineGrid>
                </BlockStack>
              </Box>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ====== ROLE DEFINITION DELETE MODAL ====== */}
      <Modal
        open={deleteRoleDefOpen}
        onClose={() => { setDeleteRoleDefOpen(false); setDeletingRoleDef(null); }}
        title="Eliminar rol"
        primaryAction={{
          content: 'Eliminar',
          destructive: true,
          onAction: handleDeleteRoleDef,
          loading: saving,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => { setDeleteRoleDefOpen(false); setDeletingRoleDef(null); } }]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              Se eliminara el rol <strong>{deletingRoleDef?.name}</strong> del sistema.
            </Text>
            <Text as="p" tone="subdued">
              Los usuarios que tengan este rol asignado perderan sus permisos asociados.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ====== ADD USER MODAL ====== */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); resetUserForm(); }}
        title="Agregar usuario al sistema"
        primaryAction={{
          content: 'Asignar rol',
          onAction: handleAddUser,
          loading: saving,
          disabled: !formEmail.trim() || !formRoleId,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => { setAddOpen(false); resetUserForm(); } }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Correo electronico"
              type="email"
              value={formEmail}
              onChange={setFormEmail}
              autoComplete="email"
              placeholder="cajero@mitienda.com"
              helpText="El correo con el que el usuario se registro en Firebase"
            />
            <TextField
              label="Nombre (opcional)"
              value={formDisplayName}
              onChange={setFormDisplayName}
              autoComplete="name"
              placeholder="Juan Perez"
            />
            <TextField
              label="Contraseña"
              type="password"
              value={formPassword}
              onChange={setFormPassword}
              autoComplete="new-password"
              placeholder="Min. 6 caracteres"
              helpText="La contraseña inicial para que el usuario inicie sesión."
            />
            <Select
              label="Rol"
              options={roleSelectOptions}
              value={formRoleId}
              onChange={setFormRoleId}
            />
            <TextField
              label="PIN de Aprobación (Opcional)"
              type="password"
              value={formPinCode}
              onChange={setFormPinCode}
              autoComplete="off"
              maxLength={6}
              placeholder="Ej: 1234"
              helpText="PIN de 4 a 6 dígitos numéricos para autorizar anulaciones y mermas en mostrador."
            />
            {formRoleId && roleMap.get(formRoleId) && (
              <Banner tone="info">
                <p><strong>{roleMap.get(formRoleId)!.name}:</strong> {roleMap.get(formRoleId)!.description}</p>
              </Banner>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* ====== EDIT USER MODAL ====== */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setSelectedUser(null); }}
        title={`Cambiar rol de ${selectedUser?.displayName || selectedUser?.email || ''}`}
        primaryAction={{
          content: 'Guardar cambio',
          onAction: handleEditUser,
          loading: saving,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => { setEditOpen(false); setSelectedUser(null); } }]}
      >
        <Modal.Section>
          <FormLayout>
            <Text as="p">
              Correo: <strong>{selectedUser?.email}</strong>
            </Text>
            <Text as="p">
              Rol actual: <Badge tone="info">{roleMap.get(selectedUser?.roleId ?? '')?.name || 'Sin rol'}</Badge>
            </Text>
            <Select
              label="Nuevo rol"
              options={roleSelectOptions}
              value={editRoleId}
              onChange={setEditRoleId}
            />
            <TextField
              label="Cambiar o Establecer PIN de Aprobación"
              type="password"
              value={editPinCode}
              onChange={setEditPinCode}
              autoComplete="off"
              maxLength={6}
              placeholder="Ej: 1234"
              helpText="Este usuario usará este PIN numérico para autorizar bloqueos, mermas o cortes."
            />
            {editRoleId && roleMap.get(editRoleId) && (
              <Banner tone="info">
                <p><strong>{roleMap.get(editRoleId)!.name}:</strong> {roleMap.get(editRoleId)!.description}</p>
              </Banner>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* ====== DELETE USER MODAL ====== */}
      <Modal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setSelectedUser(null); }}
        title="Dar de baja al usuario"
        primaryAction={{
          content: 'Dar de baja',
          destructive: true,
          onAction: async () => {
            if (!selectedUser) return;
            setSaving(true);
            try {
              await deactivateUser(selectedUser.firebaseUid);
              showSuccess(`${selectedUser.displayName || selectedUser.email} ha sido dado de baja. Su Global ID queda reservado permanentemente.`);
              setDeleteOpen(false);
              setSelectedUser(null);
            } catch (e: unknown) {
              showError(e instanceof Error ? e.message : 'Error al dar de baja');
            } finally {
              setSaving(false);
            }
          },
          loading: saving,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => { setDeleteOpen(false); setSelectedUser(null); } }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone="warning">
              <p>
                Al dar de baja a <strong>{selectedUser?.displayName || selectedUser?.email}</strong>, su acceso al sistema será revocado inmediatamente.
              </p>
            </Banner>
            {selectedUser?.globalId && (
              <Banner tone="info">
                <p>
                  El Global ID <strong>{selectedUser.globalId}</strong> quedará reservado permanentemente y no podrá ser reutilizado por nadie más.
                </p>
              </Banner>
            )}
            <Text as="p" tone="subdued">
              El usuario no será eliminado del sistema. Su registro permanecerá para auditoría y su Global ID nunca podrá ser reasignado.
              Si necesitas reincorporarlo, podrás usar la opción "Reactivar".
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ====== PERMISSIONS DETAIL MODAL ====== */}
      <Modal
        open={permDetailOpen}
        onClose={() => { setPermDetailOpen(false); setPermDetailRole(null); }}
        title={`Permisos: ${permDetailRole?.name ?? ''}`}
        secondaryActions={[{ content: 'Cerrar', onAction: () => { setPermDetailOpen(false); setPermDetailRole(null); } }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {permDetailRole && (
              <>
                <Banner tone="info">
                  <p>{permDetailRole.description}</p>
                </Banner>
                <Text variant="headingSm" as="h3">
                  {permDetailRole.permissions.length} permisos activos
                </Text>
                <Divider />
                {PERMISSION_GROUPS.map((group) => {
                  const active = group.permissions.filter((p) =>
                    permDetailRole.permissions.includes(p)
                  );
                  return (
                    <Box key={group.title}>
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h4">{group.title}</Text>
                        {active.length === 0 ? (
                          <Text variant="bodySm" as="p" tone="subdued">Sin acceso</Text>
                        ) : (
                          <InlineStack gap="200" wrap>
                            {group.permissions.map((perm) => {
                              const has = permDetailRole.permissions.includes(perm);
                              return (
                                <Badge key={perm} tone={has ? 'success' : undefined}>
                                  {PERMISSION_LABELS[perm]}
                                </Badge>
                              );
                            })}
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>
                  );
                })}
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
