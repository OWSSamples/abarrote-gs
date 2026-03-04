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
  DescriptionList,
  Spinner,
} from '@shopify/polaris';
import { PersonAddIcon, DeleteIcon, EditIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import type { UserRole, UserRoleRecord, PermissionKey } from '@/types';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS, PERMISSION_LABELS } from '@/types';

const roleOptions: { label: string; value: UserRole }[] = [
  { label: 'Dueño', value: 'owner' },
  { label: 'Administrador', value: 'admin' },
  { label: 'Gerente', value: 'manager' },
  { label: 'Cajero', value: 'cashier' },
  { label: 'Solo lectura', value: 'viewer' },
];

const roleBadge: Record<UserRole, { tone: 'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new'; label: string }> = {
  owner: { tone: 'critical', label: 'Dueño' },
  admin: { tone: 'warning', label: 'Administrador' },
  manager: { tone: 'info', label: 'Gerente' },
  cashier: { tone: 'success', label: 'Cajero' },
  viewer: { tone: 'new', label: 'Solo lectura' },
};

// Permission categories for display
const PERMISSION_GROUPS: { title: string; permissions: PermissionKey[] }[] = [
  {
    title: 'Dashboard',
    permissions: ['dashboard.view'],
  },
  {
    title: 'Ventas',
    permissions: ['sales.create', 'sales.view', 'sales.cancel', 'corte.create', 'corte.view'],
  },
  {
    title: 'Inventario',
    permissions: ['inventory.view', 'inventory.edit', 'inventory.create', 'inventory.delete'],
  },
  {
    title: 'Clientes',
    permissions: ['customers.view', 'customers.edit', 'fiado.create', 'fiado.view'],
  },
  {
    title: 'Gastos',
    permissions: ['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'],
  },
  {
    title: 'Proveedores y Pedidos',
    permissions: ['suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create'],
  },
  {
    title: 'Reportes',
    permissions: ['analytics.view', 'reports.view', 'reports.export'],
  },
  {
    title: 'Sistema',
    permissions: ['settings.view', 'settings.edit', 'roles.manage'],
  },
];

export function RolesManager() {
  const { user } = useAuth();
  const {
    userRoles,
    currentUserRole,
    fetchRoles,
    assignRole,
    updateRole,
    removeRole,
    ensureOwnerRole,
  } = useDashboardStore();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRoleRecord | null>(null);
  const [previewRole, setPreviewRole] = useState<UserRole>('viewer');

  // Form state for adding new user role
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formFirebaseUid, setFormFirebaseUid] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('cashier');
  const [editRole, setEditRole] = useState<UserRole>('cashier');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Ensure current user has a role (first user becomes owner)
      if (user) {
        await ensureOwnerRole(user.uid, user.email || '', user.displayName || '');
      }
      await fetchRoles();
      setLoading(false);
    };
    init();
  }, [user, ensureOwnerRole, fetchRoles]);

  const canManageRoles = useMemo(() => {
    return currentUserRole?.role === 'owner' || currentUserRole?.role === 'admin';
  }, [currentUserRole]);

  const canAssignRole = useCallback((targetRole: UserRole): boolean => {
    if (!currentUserRole) return false;
    if (currentUserRole.role === 'owner') return true;
    if (currentUserRole.role === 'admin') {
      return targetRole !== 'owner' && targetRole !== 'admin';
    }
    return false;
  }, [currentUserRole]);

  const resetForm = () => {
    setFormEmail('');
    setFormDisplayName('');
    setFormFirebaseUid('');
    setFormRole('cashier');
  };

  const handleAdd = useCallback(async () => {
    if (!formEmail.trim()) {
      showError('El correo es obligatorio');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      await assignRole(
        {
          firebaseUid: formFirebaseUid || `pending-${Date.now()}`,
          email: formEmail.trim(),
          displayName: formDisplayName.trim(),
          role: formRole,
        },
        user.uid
      );
      showSuccess(`Rol ${ROLE_LABELS[formRole]} asignado a ${formEmail}`);
      resetForm();
      setAddOpen(false);
    } catch {
      showError('Error al asignar rol');
    } finally {
      setSaving(false);
    }
  }, [formEmail, formDisplayName, formFirebaseUid, formRole, user, assignRole, showSuccess, showError]);

  const handleEdit = useCallback(async () => {
    if (!selectedRole || !user) return;

    setSaving(true);
    try {
      await updateRole(selectedRole.firebaseUid, editRole, user.uid);
      showSuccess(`Rol actualizado a ${ROLE_LABELS[editRole]}`);
      setEditOpen(false);
      setSelectedRole(null);
    } catch {
      showError('Error al actualizar rol');
    } finally {
      setSaving(false);
    }
  }, [selectedRole, editRole, user, updateRole, showSuccess, showError]);

  const handleDelete = useCallback(async () => {
    if (!selectedRole) return;

    setSaving(true);
    try {
      await removeRole(selectedRole.firebaseUid);
      showSuccess(`Usuario ${selectedRole.email} eliminado del sistema de roles`);
      setDeleteOpen(false);
      setSelectedRole(null);
    } catch {
      showError('Error al eliminar rol');
    } finally {
      setSaving(false);
    }
  }, [selectedRole, removeRole, showSuccess, showError]);

  const openEdit = (record: UserRoleRecord) => {
    setSelectedRole(record);
    setEditRole(record.role);
    setEditOpen(true);
  };

  const openDelete = (record: UserRoleRecord) => {
    setSelectedRole(record);
    setDeleteOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const allowedEditOptions = useMemo(() => {
    if (currentUserRole?.role === 'owner') return roleOptions;
    return roleOptions.filter(o => o.value !== 'owner' && o.value !== 'admin');
  }, [currentUserRole]);

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
          <p>Solo el dueño o administradores pueden gestionar roles de usuario.</p>
        </Banner>
      </Card>
    );
  }

  const roleRows = userRoles.map((record, index) => {
    const badge = roleBadge[record.role];
    const isOwner = record.role === 'owner';
    const isSelf = record.firebaseUid === user?.uid;

    return (
      <IndexTable.Row id={record.id} key={record.id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {record.displayName || '(sin nombre)'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">{record.email}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">{formatDate(record.createdAt)}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            {!isOwner && !isSelf && canAssignRole(record.role) && (
              <>
                <Button
                  size="micro"
                  icon={EditIcon}
                  onClick={() => openEdit(record)}
                >
                  Editar
                </Button>
                <Button
                  size="micro"
                  icon={DeleteIcon}
                  tone="critical"
                  onClick={() => openDelete(record)}
                >
                  Eliminar
                </Button>
              </>
            )}
            {isOwner && (
              <Text variant="bodySm" as="span" tone="subdued">Protegido</Text>
            )}
            {isSelf && !isOwner && (
              <Text variant="bodySm" as="span" tone="subdued">Tú</Text>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <BlockStack gap="400">
      {/* Info banner */}
      <Banner title="Gestión de Roles" tone="info">
        <p>
          Como {ROLE_LABELS[currentUserRole?.role || 'viewer']}, puedes asignar y modificar los roles de acceso de tu equipo.
          El primer usuario registrado es automáticamente el Dueño del sistema.
        </p>
      </Banner>

      {/* Permissions Reference Card */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Referencia de Permisos por Rol</Text>
            <Button
              onClick={() => {
                setPreviewRole('viewer');
                setPermissionsOpen(true);
              }}
            >
              Ver detalle
            </Button>
          </InlineStack>
          <InlineStack gap="300" wrap>
            {roleOptions.map((opt) => (
              <div
                key={opt.value}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setPreviewRole(opt.value);
                  setPermissionsOpen(true);
                }}
              >
                <Badge tone={roleBadge[opt.value].tone}>
                  {`${roleBadge[opt.value].label} — ${ROLE_PERMISSIONS[opt.value].length} permisos`}
                </Badge>
              </div>
            ))}
          </InlineStack>
          <Divider />
          <DescriptionList
            items={roleOptions.map((opt) => ({
              term: `${opt.label}`,
              description: ROLE_DESCRIPTIONS[opt.value],
            }))}
          />
        </BlockStack>
      </Card>

      {/* Users Table */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Usuarios y Roles ({userRoles.length})</Text>
            <Button
              variant="primary"
              icon={PersonAddIcon}
              onClick={() => setAddOpen(true)}
            >
              Agregar usuario
            </Button>
          </InlineStack>

          {userRoles.length === 0 ? (
            <EmptyState
              heading="Sin usuarios registrados"
              image=""
            >
              <p>Agrega usuarios a tu tienda y asígnales un rol para controlar su acceso al sistema.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: 'usuario', plural: 'usuarios' }}
              itemCount={userRoles.length}
              headings={[
                { title: 'Nombre' },
                { title: 'Correo' },
                { title: 'Rol' },
                { title: 'Desde' },
                { title: 'Acciones' },
              ]}
              selectable={false}
            >
              {roleRows}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      {/* ====== ADD MODAL ====== */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); resetForm(); }}
        title="Agregar usuario al sistema"
        primaryAction={{
          content: 'Asignar rol',
          onAction: handleAdd,
          loading: saving,
          disabled: !formEmail.trim(),
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => { setAddOpen(false); resetForm(); } }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Correo electrónico"
              type="email"
              value={formEmail}
              onChange={setFormEmail}
              autoComplete="email"
              placeholder="cajero@mitienda.com"
              helpText="El correo con el que el usuario se registró en Firebase"
            />
            <TextField
              label="Nombre (opcional)"
              value={formDisplayName}
              onChange={setFormDisplayName}
              autoComplete="name"
              placeholder="Juan Pérez"
            />
            <TextField
              label="Firebase UID (opcional)"
              value={formFirebaseUid}
              onChange={setFormFirebaseUid}
              autoComplete="off"
              placeholder="Se asigna automáticamente al iniciar sesión"
              helpText="Si no lo sabes, déjalo vacío. Se vinculará cuando el usuario inicie sesión."
            />
            <Select
              label="Rol"
              options={allowedEditOptions.filter(o => o.value !== 'owner').map(o => ({ label: o.label, value: o.value }))}
              value={formRole}
              onChange={(v) => setFormRole(v as UserRole)}
            />
            <Banner tone="info">
              <p><strong>{ROLE_LABELS[formRole]}:</strong> {ROLE_DESCRIPTIONS[formRole]}</p>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* ====== EDIT MODAL ====== */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setSelectedRole(null); }}
        title={`Cambiar rol de ${selectedRole?.displayName || selectedRole?.email || ''}`}
        primaryAction={{
          content: 'Guardar cambio',
          onAction: handleEdit,
          loading: saving,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => { setEditOpen(false); setSelectedRole(null); } }]}
      >
        <Modal.Section>
          <FormLayout>
            <Text as="p">
              Correo: <strong>{selectedRole?.email}</strong>
            </Text>
            <Text as="p">
              Rol actual: <Badge tone={roleBadge[selectedRole?.role || 'viewer'].tone}>{roleBadge[selectedRole?.role || 'viewer'].label}</Badge>
            </Text>
            <Select
              label="Nuevo rol"
              options={allowedEditOptions.map(o => ({ label: o.label, value: o.value }))}
              value={editRole}
              onChange={(v) => setEditRole(v as UserRole)}
            />
            <Banner tone="info">
              <p><strong>{ROLE_LABELS[editRole]}:</strong> {ROLE_DESCRIPTIONS[editRole]}</p>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* ====== DELETE MODAL ====== */}
      <Modal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setSelectedRole(null); }}
        title="¿Eliminar usuario del sistema?"
        primaryAction={{
          content: 'Eliminar',
          destructive: true,
          onAction: handleDelete,
          loading: saving,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => { setDeleteOpen(false); setSelectedRole(null); } }]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              Se eliminará el acceso de <strong>{selectedRole?.displayName || selectedRole?.email}</strong> al sistema.
            </Text>
            <Text as="p" tone="subdued">
              El usuario podrá seguir iniciando sesión en Firebase, pero no tendrá ningún rol asignado
              y será tratado como &quot;solo lectura&quot; por defecto.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ====== PERMISSIONS DETAIL MODAL ====== */}
      <Modal
        open={permissionsOpen}
        onClose={() => setPermissionsOpen(false)}
        title={`Permisos del rol: ${ROLE_LABELS[previewRole]}`}
        secondaryActions={[{ content: 'Cerrar', onAction: () => setPermissionsOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Select
              label="Selecciona un rol para ver sus permisos"
              options={roleOptions.map(o => ({ label: o.label, value: o.value }))}
              value={previewRole}
              onChange={(v) => setPreviewRole(v as UserRole)}
            />
            <Divider />
            <Banner tone="info">
              <p>{ROLE_DESCRIPTIONS[previewRole]}</p>
            </Banner>
            <Text variant="headingSm" as="h3">
              {ROLE_PERMISSIONS[previewRole].length} permisos activos
            </Text>
            {PERMISSION_GROUPS.map((group) => {
              const activePerms = group.permissions.filter((p) =>
                ROLE_PERMISSIONS[previewRole].includes(p)
              );
              if (activePerms.length === 0 && group.permissions.length > 0) {
                return (
                  <Box key={group.title}>
                    <BlockStack gap="100">
                      <Text variant="headingSm" as="h4">{group.title}</Text>
                      <Text variant="bodySm" as="p" tone="subdued">Sin acceso</Text>
                    </BlockStack>
                  </Box>
                );
              }
              return (
                <Box key={group.title}>
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h4">{group.title}</Text>
                    <InlineStack gap="200" wrap>
                      {group.permissions.map((perm) => {
                        const hasIt = ROLE_PERMISSIONS[previewRole].includes(perm);
                        return (
                          <Badge key={perm} tone={hasIt ? 'success' : undefined}>
                            {PERMISSION_LABELS[perm]}
                          </Badge>
                        );
                      })}
                    </InlineStack>
                  </BlockStack>
                </Box>
              );
            })}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
