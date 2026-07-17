import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { clientes, loyaltyTransactions } from '@/db/schema';

export async function expireStalePointsForStore(storeId: string, expirationDays: number): Promise<{ expired: number }> {
  if (!Number.isInteger(expirationDays) || expirationDays < 1 || expirationDays > 3_650) {
    throw new Error('El periodo de expiración de puntos no es válido.');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - expirationDays);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`loyalty-expiration:${storeId}`}))`);

    const staleCustomers = await tx
      .select({
        id: clientes.id,
        name: clientes.name,
        points: clientes.points,
      })
      .from(clientes)
      .where(
        and(
          eq(clientes.storeId, storeId),
          sql`${clientes.points}::numeric > 0 AND ${clientes.lastTransaction} < ${cutoffDate}`,
        ),
      );

    let expired = 0;
    for (const customer of staleCustomers) {
      const currentPoints = Number(customer.points) || 0;
      if (currentPoints <= 0) continue;

      const [updated] = await tx
        .update(clientes)
        .set({ points: sql`0` })
        .where(
          and(
            eq(clientes.id, customer.id),
            eq(clientes.storeId, storeId),
            sql`${clientes.points}::numeric > 0`,
          ),
        )
        .returning({ id: clientes.id });
      if (!updated) continue;

      await tx.insert(loyaltyTransactions).values({
        id: `lt-exp-${crypto.randomUUID()}`,
        clienteId: customer.id,
        clienteName: customer.name,
        tipo: 'expiracion',
        puntos: String(-currentPoints),
        saldoAnterior: String(currentPoints),
        saldoNuevo: '0',
        saleId: null,
        saleFolio: null,
        notas: `Expiración por inactividad (${expirationDays} días sin transacciones)`,
        cajero: 'sistema',
        fecha: new Date(),
        storeId,
      });
      expired++;
    }

    return { expired };
  });
}
