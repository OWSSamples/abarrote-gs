'use server';

import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db';
import { devoluciones, devolucionItems, clientes, saleItems, auditLogs } from '@/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import type { Devolucion, DevolucionItem } from '@/types';
import { numVal } from './_helpers';
import { adjustStock } from './_stock';
import { validateSchema, createDevolucionSchema } from '@/lib/validation/schemas';
import { withLogging } from '@/lib/errors';
import { sendNotification } from './_notifications';
import { devolucionEvent } from './_notification-events';

function mapDevolucion(row: typeof devoluciones.$inferSelect, items: DevolucionItem[]): Devolucion {
  return {
    id: row.id,
    saleId: row.saleId,
    saleFolio: row.saleFolio,
    tipo: row.tipo as Devolucion['tipo'],
    motivo: row.motivo as Devolucion['motivo'],
    notas: row.notas,
    montoDevuelto: numVal(row.montoDevuelto),
    metodoDev: row.metodoDev as Devolucion['metodoDev'],
    cajero: row.cajero,
    clienteId: row.clienteId ?? undefined,
    fecha: row.fecha.toISOString(),
    items,
  };
}

async function _fetchDevoluciones(): Promise<Devolucion[]> {
  await requirePermission('sales.view');
  const rows = await db.select().from(devoluciones).orderBy(desc(devoluciones.fecha));
  if (rows.length === 0) return [];

  // Batch-fetch all items in one query instead of N+1
  const devIds = rows.map((r) => r.id);
  const allItemRows = await db.select().from(devolucionItems).where(inArray(devolucionItems.devolucionId, devIds));

  // Group items by devolucionId
  const itemsByDevId = new Map<string, DevolucionItem[]>();
  for (const i of allItemRows) {
    const list = itemsByDevId.get(i.devolucionId) || [];
    list.push({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: numVal(i.unitPrice),
      subtotal: numVal(i.subtotal),
      regresoInventario: i.regresoInventario,
    });
    itemsByDevId.set(i.devolucionId, list);
  }

  return rows.map((row) => mapDevolucion(row, itemsByDevId.get(row.id) || []));
}

async function _createDevolucion(data: {
  saleId: string;
  saleFolio: string;
  tipo: Devolucion['tipo'];
  motivo: Devolucion['motivo'];
  notas: string;
  montoDevuelto: number;
  metodoDev: Devolucion['metodoDev'];
  cajero: string;
  clienteId?: string;
  items: Omit<DevolucionItem, 'id'>[];
}): Promise<Devolucion> {
  const authUser = await requirePermission('sales.cancel');
  const _validated = validateSchema(createDevolucionSchema, data, 'createDevolucion');

  const id = `dev-${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(devoluciones).values({
    id,
    saleId: data.saleId,
    saleFolio: data.saleFolio,
    tipo: data.tipo,
    motivo: data.motivo,
    notas: data.notas,
    montoDevuelto: String(data.montoDevuelto),
    metodoDev: data.metodoDev,
    cajero: data.cajero,
    clienteId: data.clienteId ?? null,
    fecha: now,
  });

  const savedItems: DevolucionItem[] = [];
  for (const item of data.items) {
    const itemId = `devi-${crypto.randomUUID()}`;
    await db.insert(devolucionItems).values({
      id: itemId,
      devolucionId: id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      subtotal: String(item.subtotal),
      regresoInventario: item.regresoInventario,
    });

    // Regresar al inventario si aplica
    if (item.regresoInventario) {
      await adjustStock(item.productId, item.quantity, {
        now,
        meta: {
          type: 'return',
          source: 'devolucion',
          sourceId: id,
          sourceLabel: `Devolución folio ${data.saleFolio}`,
          unitCost: item.unitPrice,
          notes: 'Producto devuelto por cliente',
          userId: authUser.uid,
          userName: authUser.email ?? null,
        },
      });
    }

    savedItems.push({ ...item, id: itemId });
  }

  // Si el método es crédito_cliente, abonar al balance del cliente
  if (data.metodoDev === 'credito_cliente' && data.clienteId) {
    await db
      .update(clientes)
      .set({ balance: sql`balance::numeric - ${data.montoDevuelto}`, lastTransaction: now })
      .where(eq(clientes.id, data.clienteId));
  }

  // Audit trail
  await db.insert(auditLogs).values({
    id: `audit-${crypto.randomUUID()}`,
    userId: authUser.uid,
    userEmail: authUser.email ?? 'unknown',
    action: 'create',
    entity: 'devolucion',
    entityId: id,
    changes: {
      saleId: data.saleId,
      saleFolio: data.saleFolio,
      tipo: data.tipo,
      motivo: data.motivo,
      montoDevuelto: data.montoDevuelto,
      metodoDev: data.metodoDev,
      itemCount: data.items.length,
    },
    timestamp: now,
  });

  // Telegram notification (fire-and-forget)
  sendNotification(
    devolucionEvent({
      saleFolio: data.saleFolio,
      tipo: data.tipo,
      motivo: data.motivo,
      montoDevuelto: data.montoDevuelto,
      metodoDev: data.metodoDev,
      cajero: data.cajero,
      itemCount: data.items.length,
      notas: data.notas || undefined,
    }),
  );

  const [row] = await db.select().from(devoluciones).where(eq(devoluciones.id, id)).limit(1);
  return mapDevolucion(row, savedItems);
}

// Precarga los items de una venta para poblar el formulario de devolución
async function _getSaleItemsForDevolucion(saleId: string) {
  await requirePermission('sales.view');

  // 1. Obtener todos los items de la venta original
  const sItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));

  // 2. Obtener todas las devoluciones previas de esta venta
  const prevDevs = await db
    .select()
    .from(devolucionItems)
    .innerJoin(devoluciones, eq(devolucionItems.devolucionId, devoluciones.id))
    .where(eq(devoluciones.saleId, saleId));

  // 3. Calcular cantidades ya devueltas por producto
  const returnedQtyMap = new Map<string, number>();
  for (const { devolucion_items: di } of prevDevs) {
    returnedQtyMap.set(di.productId, (returnedQtyMap.get(di.productId) || 0) + di.quantity);
  }

  // 4. Retornar items con la cantidad restante disponible para devolver
  return sItems
    .map((i) => {
      const returned = returnedQtyMap.get(i.productId) || 0;
      const availableToReturn = Math.max(0, i.quantity - returned);

      return {
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        quantity: availableToReturn, // Esta es la cantidad disponible para devolver ahora
        unitPrice: numVal(i.unitPrice),
        subtotal: availableToReturn * numVal(i.unitPrice),
      };
    })
    .filter((i) => i.quantity > 0); // Solo mostrar items que aún tienen algo por devolver
}

// ==================== WRAPPED EXPORTS ====================

export const fetchDevoluciones = withLogging('devolucion.fetchDevoluciones', _fetchDevoluciones);
export const createDevolucion = withLogging('devolucion.createDevolucion', _createDevolucion);
export const getSaleItemsForDevolucion = withLogging(
  'devolucion.getSaleItemsForDevolucion',
  _getSaleItemsForDevolucion,
);
