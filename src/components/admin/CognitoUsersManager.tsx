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
  type IndexTableProps,
} from '@shopify/polaris';
import {
  listCognitoUsersAction,
  disableCognitoUserAction,
  enableCognitoUserAction,
  deleteCognitoUserAction,
  resetCognitoPasswordAction,
  setCognitoPasswordAction,
  updateCognitoUserAttributesAction,
  importCognitoUsersAction,
} from '@/app/actions/cognito-admin-actions';
import { fetchRoleDefinitions } from '@/app/actions/role-actions';
import type { RoleDefinition } from '@/types';

interface CognitoUserRow {
  sub: string;
  username: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  status: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  mfaEnabled: boolean;
  hasDbRole: boolean;
}

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

export function CognitoUsersManager() {
  const [users, setUsers] = useState<CognitoUserRow[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<ToastState>(null);

  // Modals
  const [pwUser, setPwUser] = useState<CognitoUserRow | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwPermanent, setPwPermanent] = useState(true);

  const [editUser, setEditUser] = useState<CognitoUserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const [deleteUser, setDeleteUser] = useState<CognitoUserRow | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importRoleId, setImportRoleId] = useState('');

  const showToast = (content: string, error = false) => setToast({ content, error });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        listCognitoUsersAction({ limit: 60, filter: appliedFilter }),
        fetchRoleDefinitions(),
      ]);
      setUsers(usersRes.users);
      setRoles(rolesRes);
      if (rolesRes.length && !importRoleId) {
        const lectura = rolesRes.find((r) => /lectura/i.test(r.name));
        setImportRoleId((lectura ?? rolesRes[0]).id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [appliedFilter, importRoleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (key: string, fn: () => Promise<void>, successMsg: string) => {
    setBusyKey(key);
    try {
      await fn();
      showToast(successMsg);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Operación fallida', true);
    } finally {
      setBusyKey(null);
    }
  };

  const onApplyFilter = () => {
    // Cognito filter syntax: email ^= "foo" — keep simple prefix on email
    const trimmed = filter.trim();
    setAppliedFilter(trimmed ? `email ^= "${trimmed}"` : undefined);
  };

  const rowMarkup = useMemo(
    () =>
      users.map((u, index) => (
        <IndexTable.Row id={u.sub} key={u.sub} position={index}>
          <IndexTable.Cell>
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {u.displayName || '(sin nombre)'}
              </Text>
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
              {u.enabled ? 'Habilitado' : 'Deshabilitado'}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={u.mfaEnabled ? 'success' : 'attention'}>
              {u.mfaEnabled ? 'MFA' : 'Sin MFA'}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={u.hasDbRole ? 'success' : 'warning'}>
              {u.hasDbRole ? 'Con rol' : 'Sin rol'}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" variant="bodySm" tone="subdued">
              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <ButtonGroup>
              <Button
                size="micro"
                onClick={() => {
                  setEditUser(u);
                  setEditName(u.displayName);
                  setEditEmail(u.email);
                }}
              >
                Editar
              </Button>
              <Button
                size="micro"
                onClick={() => {
                  setPwUser(u);
                  setPwValue('');
                  setPwPermanent(true);
                }}
              >
                Contraseña
              </Button>
              <Button
                size="micro"
                loading={busyKey === `reset-${u.sub}`}
                onClick={() =>
                  runAction(
                    `reset-${u.sub}`,
                    () => resetCognitoPasswordAction(u.username),
                    'Se envió correo de recuperación.',
                  )
                }
              >
                Forzar reseteo
              </Button>
              {u.enabled ? (
                <Button
                  size="micro"
                  tone="critical"
                  variant="secondary"
                  loading={busyKey === `disable-${u.sub}`}
                  onClick={() =>
                    runAction(
                      `disable-${u.sub}`,
                      () => disableCognitoUserAction(u.username),
                      'Usuario deshabilitado.',
                    )
                  }
                >
                  Deshabilitar
                </Button>
              ) : (
                <Button
                  size="micro"
                  loading={busyKey === `enable-${u.sub}`}
                  onClick={() =>
                    runAction(
                      `enable-${u.sub}`,
                      () => enableCognitoUserAction(u.username),
                      'Usuario habilitado.',
                    )
                  }
                >
                  Habilitar
                </Button>
              )}
              <Button
                size="micro"
                tone="critical"
                onClick={() => setDeleteUser(u)}
              >
                Eliminar
              </Button>
            </ButtonGroup>
          </IndexTable.Cell>
        </IndexTable.Row>
      )),
    [users, busyKey],
  );

  const headings: IndexTableProps['headings'] = [
    { title: 'Usuario' },
    { title: 'Estado Cognito' },
    { title: 'Acceso' },
    { title: 'MFA' },
    { title: 'Rol DB' },
    { title: 'Creado' },
    { title: 'Acciones' },
  ];

  return (
    <Frame>
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        <Card padding="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Usuarios de Cognito
              </Text>
              <ButtonGroup>
                <Button onClick={() => setImportOpen(true)}>Importar a roles</Button>
                <Button onClick={() => void load()} loading={loading}>
                  Recargar
                </Button>
              </ButtonGroup>
            </InlineStack>

            <InlineStack gap="200" blockAlign="end">
              <Box minWidth="280px">
                <TextField
                  label="Filtrar por email (prefijo)"
                  labelHidden
                  placeholder="Filtrar por email (prefijo)"
                  value={filter}
                  onChange={setFilter}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => {
                    setFilter('');
                    setAppliedFilter(undefined);
                  }}
                />
              </Box>
              <Button onClick={onApplyFilter}>Aplicar</Button>
            </InlineStack>

            {loading ? (
              <Box padding="600">
                <InlineStack align="center">
                  <Spinner accessibilityLabel="Cargando usuarios" />
                </InlineStack>
              </Box>
            ) : users.length === 0 ? (
              <EmptyState
                heading="No hay usuarios"
                image="/illustrations/empty-state.svg"
              >
                <p>No se encontraron usuarios en el User Pool de Cognito.</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: 'usuario', plural: 'usuarios' }}
                itemCount={users.length}
                headings={headings}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </BlockStack>
        </Card>
      </BlockStack>

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
            await runAction(
              'edit',
              () =>
                updateCognitoUserAttributesAction(editUser.username, {
                  displayName: editName,
                  email: editEmail !== editUser.email ? editEmail : undefined,
                }),
              'Atributos actualizados.',
            );
            setEditUser(null);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setEditUser(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Nombre para mostrar" value={editName} onChange={setEditName} autoComplete="off" />
            <TextField
              label="Email"
              type="email"
              value={editEmail}
              onChange={setEditEmail}
              autoComplete="off"
              helpText="Cambiar el email puede requerir reverificación."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Set password modal */}
      <Modal
        open={!!pwUser}
        onClose={() => setPwUser(null)}
        title={`Establecer contraseña — ${pwUser?.email ?? ''}`}
        primaryAction={{
          content: 'Aplicar',
          destructive: true,
          loading: busyKey === 'pw',
          disabled: pwValue.length < 8,
          onAction: async () => {
            if (!pwUser) return;
            await runAction(
              'pw',
              () => setCognitoPasswordAction(pwUser.username, pwValue, pwPermanent),
              pwPermanent ? 'Contraseña permanente establecida.' : 'Contraseña temporal establecida.',
            );
            setPwUser(null);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setPwUser(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone="warning">
              Esta acción sobreescribe la contraseña sin notificar al usuario. Compártela por un canal seguro.
            </Banner>
            <TextField
              label="Nueva contraseña"
              type="password"
              value={pwValue}
              onChange={setPwValue}
              autoComplete="new-password"
              helpText="Mínimo 8 caracteres."
            />
            <Select
              label="Tipo"
              options={[
                { label: 'Permanente (no fuerza cambio)', value: 'true' },
                { label: 'Temporal (forzar cambio en próximo inicio)', value: 'false' },
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
        title="Eliminar usuario"
        primaryAction={{
          content: 'Eliminar definitivamente',
          destructive: true,
          loading: busyKey === 'delete',
          onAction: async () => {
            if (!deleteUser) return;
            await runAction(
              'delete',
              () => deleteCognitoUserAction(deleteUser.username),
              'Usuario eliminado.',
            );
            setDeleteUser(null);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setDeleteUser(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              Vas a eliminar a <strong>{deleteUser?.email}</strong> de Cognito y de la base de datos.
            </Text>
            <Banner tone="critical">Esta acción es irreversible.</Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Import modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar usuarios de Cognito"
        primaryAction={{
          content: 'Importar',
          loading: busyKey === 'import',
          disabled: !importRoleId,
          onAction: async () => {
            await runAction(
              'import',
              async () => {
                const res = await importCognitoUsersAction(importRoleId);
                showToast(`Importados: ${res.imported}, ya existían: ${res.skipped}`);
              },
              'Importación completada.',
            );
            setImportOpen(false);
          },
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setImportOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">
              Crea un registro en <code>user_roles</code> para cada usuario de Cognito que aún no tenga uno,
              asignándole el rol seleccionado.
            </Text>
            <Select
              label="Rol por defecto"
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
              value={importRoleId}
              onChange={setImportRoleId}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {toast && (
        <Toast
          content={toast.content}
          error={toast.error}
          onDismiss={() => setToast(null)}
        />
      )}
    </Frame>
  );
}
