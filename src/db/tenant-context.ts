import { sql, type SQL } from 'drizzle-orm';

interface SqlExecutor {
  execute(query: SQL): PromiseLike<unknown>;
}

function assertContextId(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(normalized)) {
    throw new Error(`${label} inválido para el contexto de base de datos.`);
  }
  return normalized;
}

/**
 * Sets transaction-local values consumed by PostgreSQL tenant policies.
 * `is_local = true` guarantees pooled connections do not leak tenant state.
 */
export async function setTenantTransactionContext(
  executor: SqlExecutor,
  storeId: string,
  userId: string,
): Promise<void> {
  const tenant = assertContextId(storeId, 'Tenant');
  const actor = assertContextId(userId, 'Usuario');
  await executor.execute(sql`SELECT set_config('app.current_tenant_id', ${tenant}, true)`);
  await executor.execute(sql`SELECT set_config('app.current_user_id', ${actor}, true)`);
}
