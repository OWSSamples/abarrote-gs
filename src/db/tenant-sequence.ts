import { sql, type SQL } from 'drizzle-orm';

interface SqlExecutor {
  execute(query: SQL): PromiseLike<unknown>;
}

function assertSequencePart(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(normalized)) {
    throw new Error(`${label} de secuencia inválido.`);
  }
  return normalized;
}

function readSequenceValue(result: unknown): number {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && 'rows' in result
      ? (result as { rows: unknown[] }).rows
      : [];
  const row = rows[0];
  const value = row && typeof row === 'object' && 'value' in row
    ? Number(row.value)
    : Number.NaN;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('No fue posible reservar el siguiente consecutivo del negocio.');
  }
  return value;
}

/** Reserves and returns one sequence value atomically inside the caller context. */
export async function nextTenantSequence(
  executor: SqlExecutor,
  storeId: string,
  key: string,
  startingAt = 1,
): Promise<number> {
  const tenant = assertSequencePart(storeId, 'Tenant');
  const sequenceKey = assertSequencePart(key, 'Clave');
  if (!Number.isSafeInteger(startingAt) || startingAt < 1) {
    throw new Error('El valor inicial de la secuencia no es válido.');
  }

  const result = await executor.execute(sql`
    INSERT INTO tenant_sequences (store_id, key, value, updated_at)
    VALUES (${tenant}, ${sequenceKey}, ${startingAt}, now())
    ON CONFLICT (store_id, key)
    DO UPDATE SET value = tenant_sequences.value + 1, updated_at = now()
    RETURNING value
  `);
  return readSequenceValue(result);
}
