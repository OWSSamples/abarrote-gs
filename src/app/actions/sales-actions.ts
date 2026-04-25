'use server';

import { requirePermission, validateId } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { db } from '@/db';
import {
  saleRecords,
  saleItems,
  products,
  clientes,
  gastos,
  cortesCaja,
  loyaltyTransactions,
  devoluciones,
} from '@/db/schema';
import { eq, desc, sql, inArray, gte } from 'drizzle-orm';
import type { SaleRecord, SaleItem, SalesData, CorteCaja, HourlySalesData } from '@/types';
import { numVal } from './_helpers';
import { adjustStock } from './_stock';
import { sendNotification, escapeHTML } from './_notifications';
import { logger } from '@/lib/logger';
import { createConektaSPEICharge, createConektaOXXOCharge } from '@/lib/conekta-provider';
import { createStripeSPEICharge, createStripeOXXOCharge } from '@/lib/stripe-provider';
import { createClipCheckoutCharge, createClipTerminalCharge } from '@/lib/clip-provider';
import { paymentCharges } from '@/db/schema';
import { createSaleSchema } from '@/lib/validation/schemas';
import { publishJob } from '@/infrastructure/qstash';
import { AppError, withLogging } from '@/lib/errors';
import { withRateLimit, idempotencyCheck, withLock } from '@/infrastructure/redis';
import { emitDomainEvent } from '@/domain/events';

// ==================== FOLIO ====================

// No separate getNextFolio() needed — folio is generated atomically inside the INSERT.

// ==================== SALES DATA (computed) ====================

async function _fetchSalesData(): Promise<SalesData[]> {
  await requirePermission('sales.view');
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Inicio y fin de la semana actual (Dom–Sáb)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Inicio y fin de la semana anterior
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);

  // 2 queries en paralelo en lugar de 14 en secuencia
  const [currentRows, prevRows] = await Promise.all([
    db
      .select({
        day: sql<number>`extract(dow from date)::int`,
        total: sql<string>`coalesce(sum(total::numeric), 0)`,
      })
      .from(saleRecords)
      .where(sql`date >= ${weekStart.toISOString()} and date < ${weekEnd.toISOString()} and status != 'cancelada'`)
      .groupBy(sql`extract(dow from date)`),
    db
      .select({
        day: sql<number>`extract(dow from date)::int`,
        total: sql<string>`coalesce(sum(total::numeric), 0)`,
      })
      .from(saleRecords)
      .where(
        sql`date >= ${prevWeekStart.toISOString()} and date < ${prevWeekEnd.toISOString()} and status != 'cancelada'`,
      )
      .groupBy(sql`extract(dow from date)`),
  ]);

  const currentByDay = new Map(currentRows.map((r) => [r.day, numVal(r.total)]));
  const prevByDay = new Map(prevRows.map((r) => [r.day, numVal(r.total)]));

  return Array.from({ length: 7 }, (_, i) => ({
    date: days[i],
    currentWeek: currentByDay.get(i) ?? 0,
    previousWeek: prevByDay.get(i) ?? 0,
  }));
}

async function _fetchHourlySalesData(): Promise<HourlySalesData[]> {
  await requirePermission('sales.view');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const startOfDay = new Date(`${todayStr}T00:00:00-06:00`);
  const endOfDay = new Date(`${todayStr}T23:59:59-06:00`);

  const rows = await db
    .select({
      hour: sql<number>`extract(hour from date)::int`,
      sales: sql<string>`coalesce(sum(total::numeric), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(saleRecords)
    .where(sql`date >= ${startOfDay.toISOString()} and date < ${endOfDay.toISOString()} and status != 'cancelada'`)
    .groupBy(sql`extract(hour from date)`)
    .orderBy(sql`extract(hour from date)`);

  const salesByHour = new Map(rows.map((r) => [r.hour, { sales: numVal(r.sales), count: r.count }]));

  // Encontrar el umbral para "Hora Pico" (Ej: top 25% de ventas o basado en promedio)
  const allSales = rows.map((r) => numVal(r.sales));
  const avgSales = allSales.length > 0 ? allSales.reduce((a, b) => a + b, 0) / allSales.length : 0;
  const peakThreshold = avgSales * 1.5;

  return Array.from({ length: 24 }, (_, i) => {
    const data = salesByHour.get(i) || { sales: 0, count: 0 };
    return {
      hour: `${i}:00`,
      sales: data.sales,
      transactions: data.count,
      isPeak: data.sales > peakThreshold && data.sales > 0,
    };
  }).filter((h) => {
    const hourInt = parseInt(h.hour);
    return hourInt >= 6 && hourInt <= 22; // Horario de tienda típico
  });
}

// ==================== SALES ====================

async function _fetchSaleRecords(): Promise<SaleRecord[]> {
  await requirePermission('sales.view');
  const rows = await db.select().from(saleRecords).orderBy(desc(saleRecords.date)).limit(100);
  if (rows.length === 0) return [];

  // Batch fetch all items for all sales in one query
  const saleIds = rows.map((r) => r.id);
  const allItems = await db.select().from(saleItems).where(inArray(saleItems.saleId, saleIds));

  // Group items by saleId
  const itemsBySaleId = new Map<string, SaleItem[]>();
  for (const item of allItems) {
    const list = itemsBySaleId.get(item.saleId) || [];
    list.push({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: numVal(item.unitPrice),
      subtotal: numVal(item.subtotal),
    });
    itemsBySaleId.set(item.saleId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    items: itemsBySaleId.get(row.id) || [],
    subtotal: numVal(row.subtotal),
    iva: numVal(row.iva),
    cardSurcharge: numVal(row.cardSurcharge),
    total: numVal(row.total),
    paymentMethod: row.paymentMethod as 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado',
    amountPaid: numVal(row.amountPaid),
    change: numVal(row.change),
    date: row.date.toISOString(),
    cajero: row.cajero,
    pointsEarned: numVal(row.pointsEarned),
    pointsUsed: numVal(row.pointsUsed),
    discount: numVal(row.discount ?? '0'),
    discountType: (row.discountType ?? 'amount') as 'amount' | 'percent',
    installments: row.installments ?? 1,
    mpPaymentId: row.mpPaymentId ?? null,
    status: (row.status ?? 'completada') as SaleRecord['status'],
  }));
}

async function _createSale(
  saleData: Omit<SaleRecord, 'id' | 'folio' | 'date'> & { clienteId?: string; clientRequestId?: string },
): Promise<SaleRecord> {
  return logger.withTiming(
    'createSale',
    async () => {
      const user = await requirePermission('sales.create');
      const { storeId } = await requireStoreScope();

      // ── Idempotency guard: prevent duplicate sale creation from double-clicks/retries ──
      // Prefer a client-provided request id (one per checkout attempt). Fall back
      // to a content-based key so legacy callers stay protected.
      const idempotencyKey = saleData.clientRequestId
        ? `sale:req:${saleData.clientRequestId}`
        : `sale:${saleData.total}:${saleData.paymentMethod}:${saleData.cajero}:${saleData.amountPaid}`;
      const isNew = await idempotencyCheck(idempotencyKey, { ttlMs: 10_000 });
      if (!isNew) {
        logger.warn('Duplicate sale creation blocked', { action: 'sale_idempotency_block', key: idempotencyKey });
        throw new Error('Venta duplicada detectada. Espera unos segundos e intenta de nuevo.');
      }

      // ── Runtime validation ──
      const parsed = createSaleSchema.safeParse(saleData);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        logger.warn('createSale validation failed', { action: 'sale_validation_error', issues });
        throw new Error(`Datos de venta inválidos: ${issues}`);
      }

      const now = new Date();
      const cajero = saleData.cajero?.trim() || 'Cajero';
      const id = `sale-${crypto.randomUUID()}`;
      const clienteId = saleData.clienteId;

      // ── Distributed lock: prevent concurrent folio/stock race conditions ──
      // Lock by cajero to serialize sales from the same register
      const { folio, stockAlerts } = await withLock(
        `sale:register:${cajero}`,
        async () => {
          // ── Transactional core: sale + items + stock + loyalty ──
          // All DB mutations run inside a single transaction so a failure at any
          // step rolls back everything — no more partial sales with wrong stock.
          return db.transaction(async (tx) => {
            // 1. Folio generation (sequence-based, atomic)
            await tx.execute(sql`CREATE SEQUENCE IF NOT EXISTS folio_seq START WITH 309001`);
            const seqResult = await tx.execute(sql`SELECT nextval('folio_seq')::text AS folio`);
            const seqRows = Array.isArray(seqResult)
              ? seqResult
              : ((seqResult as { rows: Record<string, unknown>[] }).rows ?? []);
            let txFolio = String(seqRows?.[0]?.folio ?? seqRows?.[0]?.val ?? '');

            const [existing] = await tx.select().from(saleRecords).where(eq(saleRecords.folio, txFolio)).limit(1);
            if (existing || !txFolio) {
              await tx.execute(sql`
        SELECT setval('folio_seq', (SELECT COALESCE(MAX(CASE WHEN folio ~ '^[0-9]+$' THEN folio::bigint END), 309000) FROM sale_records) + 1)
      `);
              const retryRes = await tx.execute(sql`SELECT nextval('folio_seq')::text AS folio`);
              const retryRows = Array.isArray(retryRes)
                ? retryRes
                : ((retryRes as { rows: Record<string, unknown>[] }).rows ?? []);
              txFolio = String(retryRows?.[0]?.folio ?? retryRows?.[0]?.val ?? '');
            }
            if (!txFolio) throw new Error('No se pudo generar el folio único');

            // 2. Insert sale record
            await tx.insert(saleRecords).values({
              id,
              folio: txFolio,
              subtotal: String(saleData.subtotal),
              iva: String(saleData.iva),
              cardSurcharge: String(saleData.cardSurcharge),
              total: String(saleData.total),
              paymentMethod: saleData.paymentMethod,
              amountPaid: String(saleData.amountPaid),
              change: String(saleData.change),
              cajero,
              pointsEarned: String(saleData.pointsEarned),
              pointsUsed: String(saleData.pointsUsed),
              discount: String(saleData.discount ?? 0),
              discountType: saleData.discountType ?? 'amount',
              installments: saleData.installments ?? 1,
              mpPaymentId: saleData.mpPaymentId ?? null,
              date: now,
              storeId,
            });

            // 3. Insert sale items
            for (const item of saleData.items) {
              await tx.insert(saleItems).values({
                id: `si-${crypto.randomUUID()}`,
                saleId: id,
                productId: item.productId,
                productName: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                unitPrice: String(item.unitPrice),
                subtotal: String(item.subtotal),
                storeId,
              });
            }

            // 3.5 Stock pre-check with row-level lock to prevent oversells.
            // Aggregate quantities by productId in case the same product appears in multiple lines.
            const required = new Map<string, number>();
            for (const item of saleData.items) {
              required.set(item.productId, (required.get(item.productId) ?? 0) + item.quantity);
            }
            const productIds = Array.from(required.keys());
            const lockedRows = await tx
              .select({ id: products.id, name: products.name, currentStock: products.currentStock })
              .from(products)
              .where(inArray(products.id, productIds))
              .for('update');
            const stockById = new Map(lockedRows.map((r) => [r.id, r]));
            const insufficient: string[] = [];
            for (const [pid, need] of required) {
              const row = stockById.get(pid);
              if (!row) {
                insufficient.push(`Producto ${pid} no encontrado`);
                continue;
              }
              if (row.currentStock < need) {
                insufficient.push(`${row.name}: requiere ${need}, disponible ${row.currentStock}`);
              }
            }
            if (insufficient.length > 0) {
              throw new AppError(
                'INSUFFICIENT_STOCK',
                `Stock insuficiente para completar la venta: ${insufficient.join('; ')}`,
                409,
              );
            }

            // 4. Deduct stock using shared helper (inside tx)
            const alerts: { name: string; currentStock: number; minStock: number }[] = [];
            for (const item of saleData.items) {
              const updated = await adjustStock(item.productId, -item.quantity, {
                tx,
                now,
                meta: {
                  type: 'sale',
                  source: 'venta',
                  sourceId: id,
                  sourceLabel: `Folio ${txFolio}`,
                  unitCost: item.unitPrice,
                  notes: `Venta · ${cajero}`,
                  userId: user.uid,
                  userName: cajero,
                  storeId,
                },
              });
              if (updated && updated.currentStock <= updated.minStock * 0.2) {
                alerts.push(updated);
              }
            }

            // 5. Loyalty points (inside tx for consistency)
            if (clienteId) {
              const [clienteRow] = await tx.select().from(clientes).where(eq(clientes.id, clienteId)).limit(1);
              const saldoAnterior = clienteRow ? numVal(clienteRow.points) : 0;
              let runningBalance = saldoAnterior;

              await tx
                .update(clientes)
                .set({
                  points: sql`points::numeric + ${saleData.pointsEarned} - ${saleData.pointsUsed}`,
                  lastTransaction: now,
                })
                .where(eq(clientes.id, clienteId));

              // Record canje (redemption) as a separate transaction
              if (saleData.pointsUsed > 0) {
                const saldoDespuesCanje = runningBalance - saleData.pointsUsed;
                await tx.insert(loyaltyTransactions).values({
                  id: `lt-${crypto.randomUUID()}`,
                  clienteId,
                  clienteName: clienteRow?.name ?? '',
                  tipo: 'canje',
                  puntos: String(-saleData.pointsUsed),
                  saldoAnterior: String(runningBalance),
                  saldoNuevo: String(saldoDespuesCanje),
                  saleId: id,
                  saleFolio: txFolio,
                  notas: `Canje en venta folio ${txFolio}`,
                  cajero,
                  fecha: now,
                  storeId,
                });
                runningBalance = saldoDespuesCanje;
              }

              // Record acumulacion (earning) as a separate transaction
              if (saleData.pointsEarned > 0) {
                const saldoDespuesAcum = runningBalance + saleData.pointsEarned;
                await tx.insert(loyaltyTransactions).values({
                  id: `lt-${crypto.randomUUID()}`,
                  clienteId,
                  clienteName: clienteRow?.name ?? '',
                  tipo: 'acumulacion',
                  puntos: String(saleData.pointsEarned),
                  saldoAnterior: String(runningBalance),
                  saldoNuevo: String(saldoDespuesAcum),
                  saleId: id,
                  saleFolio: txFolio,
                  notas: `Acumulación en venta folio ${txFolio}`,
                  cajero,
                  fecha: now,
                  storeId,
                });
              }
            }

            return { folio: txFolio, stockAlerts: alerts };
          });
        },
        { ttlMs: 15_000, waitMs: 10_000 },
      ); // withLock end

      // ── Side effects (outside transaction — non-critical) ──

      emitDomainEvent({
        type: 'sale.created',
        payload: {
          saleId: id,
          folio,
          total: saleData.total,
          paymentMethod: saleData.paymentMethod,
          cajero,
          itemCount: saleData.items.length,
        },
        metadata: { userId: user.uid, userEmail: user.email ?? '' },
      });

      // Stock critical alerts — published as background jobs (non-blocking).
      // QStash handles retries and falls back to inline fire-and-forget if unavailable.
      for (const alert of stockAlerts) {
        const message =
          `<b>REPORTE DE STOCK CRÍTICO</b>\n\n` +
          `Producto: ${escapeHTML(alert.name)}\n` +
          `Stock actual: ${alert.currentStock}\n` +
          `Mínimo sugerido: ${alert.minStock}`;
        void publishJob('notification', { message }, undefined, () => sendNotification(message));
      }

      // Notificación de venta detallada y estética — también async vía qstash
      const itemsList = saleData.items
        .map((it) => `• ${it.quantity}x ${escapeHTML(it.productName)} ($${numVal(String(it.unitPrice)).toFixed(2)})`)
        .join('\n');

      const saleMessage =
        `<b>REPORTE DE VENTA (#${folio})</b>\n\n` +
        `Cajero: ${escapeHTML(cajero)}\n` +
        `Método de Pago: ${saleData.paymentMethod.toUpperCase()}\n` +
        `---------------------------------\n` +
        `<b>DETALLE DE PRODUCTOS:</b>\n${itemsList}\n` +
        `---------------------------------\n` +
        `<b>TOTAL: $${numVal(String(saleData.total)).toFixed(2)}</b>\n\n` +
        (saleData.pointsUsed > 0 ? `Puntos canjeados: ${saleData.pointsUsed}\n` : '') +
        `Hora: ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
      void publishJob('notification', { message: saleMessage }, undefined, () => sendNotification(saleMessage));

      // ── Automated payment charge creation ──
      // For SPEI/OXXO automated methods, create a charge with the provider
      // and link it to this sale. The charge returns a CLABE or OXXO reference.
      let chargeResult: Record<string, unknown> | null = null;
      const pm = saleData.paymentMethod;
      const clienteId2 = saleData.clienteId;
      const customerEmail = 'pos@tienda.local';
      const customerName = 'Cliente POS';
      if (clienteId2) {
        const [c] = await db.select().from(clientes).where(eq(clientes.id, clienteId2)).limit(1);
        if (c) {
          // Use name from DB if available
          Object.assign({ customerName: c.name }, { customerEmail: `${c.id}@pos.local` });
        }
      }

      try {
        if (pm === 'spei_conekta') {
          const result = await createConektaSPEICharge({
            amount: numVal(String(saleData.total)),
            customerName,
            customerEmail,
            description: `Venta #${folio}`,
            saleReference: folio,
          });
          // Link charge to sale
          await db
            .update(paymentCharges)
            .set({ saleId: id })
            .where(eq(paymentCharges.referenceNumber, result.referenceNumber));
          chargeResult = result as unknown as Record<string, unknown>;
        } else if (pm === 'oxxo_conekta') {
          const result = await createConektaOXXOCharge({
            amount: numVal(String(saleData.total)),
            customerName,
            customerEmail,
            description: `Venta #${folio}`,
            saleReference: folio,
          });
          await db
            .update(paymentCharges)
            .set({ saleId: id })
            .where(eq(paymentCharges.referenceNumber, result.reference));
          chargeResult = result as unknown as Record<string, unknown>;
        } else if (pm === 'spei_stripe') {
          const result = await createStripeSPEICharge({
            amount: numVal(String(saleData.total)),
            customerEmail,
            description: `Venta #${folio}`,
            saleReference: folio,
          });
          await db
            .update(paymentCharges)
            .set({ saleId: id })
            .where(eq(paymentCharges.referenceNumber, result.referenceNumber));
          chargeResult = result as unknown as Record<string, unknown>;
        } else if (pm === 'oxxo_stripe') {
          const result = await createStripeOXXOCharge({
            amount: numVal(String(saleData.total)),
            customerEmail,
            description: `Venta #${folio}`,
            saleReference: folio,
          });
          await db
            .update(paymentCharges)
            .set({ saleId: id })
            .where(eq(paymentCharges.referenceNumber, result.reference));
          chargeResult = result as unknown as Record<string, unknown>;
        } else if (pm === 'tarjeta_clip') {
          const result = await createClipCheckoutCharge({
            amount: numVal(String(saleData.total)),
            description: `Venta #${folio}`,
            saleReference: folio,
          });
          await db
            .update(paymentCharges)
            .set({ saleId: id })
            .where(eq(paymentCharges.referenceNumber, result.referenceNumber));
          chargeResult = result as unknown as Record<string, unknown>;
        } else if (pm === 'clip_terminal') {
          const result = await createClipTerminalCharge({
            amount: numVal(String(saleData.total)),
            saleReference: folio,
          });
          await db
            .update(paymentCharges)
            .set({ saleId: id })
            .where(eq(paymentCharges.referenceNumber, result.referenceNumber));
          chargeResult = result as unknown as Record<string, unknown>;
        }
      } catch (chargeErr) {
        // Charge creation failed — sale is already recorded.
        // Log and continue; the cashier can retry the charge separately.
        logger.error('Automated payment charge creation failed', {
          action: 'charge_creation_failed',
          saleId: id,
          paymentMethod: pm,
          error: chargeErr instanceof Error ? chargeErr.message : String(chargeErr),
        });
      }

      // Schedule background payment status poll (belt + suspenders alongside webhooks)
      if (chargeResult) {
        const providerMap: Record<string, 'conekta' | 'stripe' | 'clip'> = {
          spei_conekta: 'conekta',
          oxxo_conekta: 'conekta',
          spei_stripe: 'stripe',
          oxxo_stripe: 'stripe',
          tarjeta_clip: 'clip',
          clip_terminal: 'clip',
        };
        const provider = providerMap[pm];
        if (provider) {
          const refNum =
            (chargeResult as Record<string, string>).referenceNumber ||
            (chargeResult as Record<string, string>).reference;
          if (refNum) {
            // Query the charge ID from DB by reference
            const [charge] = await db
              .select({ id: paymentCharges.id })
              .from(paymentCharges)
              .where(eq(paymentCharges.referenceNumber, refNum))
              .limit(1);

            if (charge) {
              // Poll after 2 min delay — gives webhooks time to arrive first
              publishJob('payment-poll', { chargeId: charge.id, provider }, { delaySec: 120, retries: 5 }).catch(() => {
                /* fire-and-forget */
              });
            }
          }
        }
      }

      return {
        ...saleData,
        id,
        folio,
        date: now.toISOString(),
        discount: saleData.discount ?? 0,
        discountType: saleData.discountType ?? 'amount',
        ...(chargeResult ? { chargeData: chargeResult } : {}),
      } as SaleRecord;
    },
    { items: saleData.items.length },
  );
}

import { fiadoTransactions, fiadoItems } from '@/db/schema'; // We need this import added if it's missing, let's just make sure.

async function _cancelSale(saleId: string): Promise<void> {
  const user = await requirePermission('sales.cancel');
  validateId(saleId, 'Sale ID');

  const [sale] = await db.select().from(saleRecords).where(eq(saleRecords.id, saleId)).limit(1);
  if (!sale) return;
  if (sale.status === 'cancelada') return;

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  for (const item of items) {
    await adjustStock(item.productId, item.quantity, {
      meta: {
        type: 'return',
        source: 'venta',
        sourceId: saleId,
        sourceLabel: `Cancelación folio ${sale.folio}`,
        unitCost: Number(item.unitPrice),
        notes: 'Reversión por cancelación de venta',
        userId: user.uid,
        userName: user.email ?? null,
      },
    });
  }

  // Si fue fiado, revertir deuda global del cliente y limpiar tickets de deudores
  if (sale.paymentMethod === 'fiado') {
    const fTransactions = await db.select().from(fiadoTransactions).where(eq(fiadoTransactions.saleFolio, sale.folio));
    for (const trx of fTransactions) {
      await db
        .update(clientes)
        .set({ balance: sql`balance - ${trx.amount}` })
        .where(eq(clientes.id, trx.clienteId));

      await db.delete(fiadoItems).where(eq(fiadoItems.fiadoId, trx.id));
      await db.delete(fiadoTransactions).where(eq(fiadoTransactions.id, trx.id));
    }
  }

  await db.delete(devoluciones).where(eq(devoluciones.saleId, saleId));
  await db.delete(loyaltyTransactions).where(eq(loyaltyTransactions.saleId, saleId));

  // Guardado histórico en base de datos.
  await db.update(saleRecords).set({ status: 'cancelada' }).where(eq(saleRecords.id, saleId));

  emitDomainEvent({
    type: 'sale.cancelled',
    payload: { saleId, folio: sale.folio },
    metadata: { userId: user.uid, userEmail: user.email ?? '' },
  });
}

async function _deleteSales(saleIds: string[]): Promise<void> {
  await requirePermission('sales.cancel');
  if (saleIds.length === 0) return;
  saleIds.forEach((id) => validateId(id, 'Sale ID'));

  const activeSales = await db.select().from(saleRecords).where(inArray(saleRecords.id, saleIds));

  const pendingSalesToCancel = activeSales.filter((s) => s.status !== 'cancelada');
  if (pendingSalesToCancel.length === 0) return;

  const activeIds = pendingSalesToCancel.map((s) => s.id);

  // Restaurar stock de todos los items involucrados
  const allItems = await db.select().from(saleItems).where(inArray(saleItems.saleId, activeIds));
  const folioById = new Map(pendingSalesToCancel.map((s) => [s.id, s.folio]));
  await Promise.all(
    allItems.map((item) =>
      adjustStock(item.productId, item.quantity, {
        meta: {
          type: 'return',
          source: 'venta',
          sourceId: item.saleId,
          sourceLabel: `Cancelación folio ${folioById.get(item.saleId) ?? ''}`,
          unitCost: Number(item.unitPrice),
          notes: 'Reversión por cancelación masiva de ventas',
        },
      }),
    ),
  );

  // Revertir deudas por fiado
  for (const sale of pendingSalesToCancel) {
    if (sale.paymentMethod === 'fiado') {
      const fTransactions = await db
        .select()
        .from(fiadoTransactions)
        .where(eq(fiadoTransactions.saleFolio, sale.folio));
      for (const trx of fTransactions) {
        await db
          .update(clientes)
          .set({ balance: sql`balance - ${trx.amount}` })
          .where(eq(clientes.id, trx.clienteId));
        await db.delete(fiadoItems).where(eq(fiadoItems.fiadoId, trx.id));
        await db.delete(fiadoTransactions).where(eq(fiadoTransactions.id, trx.id));
      }
    }
  }

  await db.delete(devoluciones).where(inArray(devoluciones.saleId, activeIds));
  await db.delete(loyaltyTransactions).where(inArray(loyaltyTransactions.saleId, activeIds));

  // Guardado histórico
  await db.update(saleRecords).set({ status: 'cancelada' }).where(inArray(saleRecords.id, activeIds));
}

// ==================== CORTES DE CAJA ====================

async function _fetchCortesHistory(): Promise<CorteCaja[]> {
  await requirePermission('corte.view');
  const rows = await db.select().from(cortesCaja).orderBy(desc(cortesCaja.fecha)).limit(30);
  return rows.map((r) => ({
    id: r.id,
    fecha: r.fecha.toISOString(),
    cajero: r.cajero,
    ventasEfectivo: numVal(r.ventasEfectivo),
    ventasTarjeta: numVal(r.ventasTarjeta),
    ventasTransferencia: numVal(r.ventasTransferencia),
    ventasFiado: numVal(r.ventasFiado),
    totalVentas: numVal(r.totalVentas),
    totalTransacciones: r.totalTransacciones,
    efectivoEsperado: numVal(r.efectivoEsperado),
    efectivoContado: numVal(r.efectivoContado),
    diferencia: numVal(r.diferencia),
    fondoInicial: numVal(r.fondoInicial),
    gastosDelDia: numVal(r.gastosDelDia),
    notas: r.notas,
    status: r.status as 'abierto' | 'cerrado',
  }));
}

async function _createCorteCaja(data: {
  cajero: string;
  efectivoContado: number;
  fondoInicial: number;
  notas: string;
}): Promise<CorteCaja> {
  await requirePermission('corte.create');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

  const salesRows = await db
    .select()
    .from(saleRecords)
    .where(
      sql`(${saleRecords.date} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date AND ${saleRecords.status} != 'cancelada'`,
    );

  const EFECTIVO_METHODS = new Set(['efectivo']);
  const TARJETA_METHODS = new Set([
    'tarjeta',
    'tarjeta_web',
    'tarjeta_manual',
    'oxxo_conekta',
    'oxxo_stripe',
    'tarjeta_clip',
    'clip_terminal',
  ]);
  const TRANSFER_METHODS = new Set([
    'transferencia',
    'spei',
    'spei_conekta',
    'spei_stripe',
    'paypal',
    'qr_cobro',
    'puntos',
  ]);
  const FIADO_METHODS = new Set(['fiado']);

  const ventasEfectivo = salesRows
    .filter((s) => EFECTIVO_METHODS.has(s.paymentMethod))
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasTarjeta = salesRows
    .filter((s) => TARJETA_METHODS.has(s.paymentMethod))
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasTransferencia = salesRows
    .filter((s) => TRANSFER_METHODS.has(s.paymentMethod))
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasFiado = salesRows
    .filter((s) => FIADO_METHODS.has(s.paymentMethod))
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia + ventasFiado;
  const totalTransacciones = salesRows.length;

  const gastosRows = await db
    .select()
    .from(gastos)
    .where(sql`(${gastos.fecha} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date`);
  const gastosDelDia = gastosRows.reduce((sum, g) => sum + numVal(g.monto), 0);

  const efectivoEsperado = data.fondoInicial + ventasEfectivo - gastosDelDia;
  const diferencia = data.efectivoContado - efectivoEsperado;

  const corte: CorteCaja = {
    id: `corte-${crypto.randomUUID()}`,
    fecha: new Date().toISOString(),
    cajero: data.cajero,
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    ventasFiado,
    totalVentas,
    totalTransacciones,
    efectivoEsperado,
    efectivoContado: data.efectivoContado,
    diferencia,
    fondoInicial: data.fondoInicial,
    gastosDelDia,
    notas: data.notas,
    status: 'cerrado',
  };

  await db.insert(cortesCaja).values({
    id: corte.id,
    fecha: new Date(),
    cajero: corte.cajero,
    ventasEfectivo: String(corte.ventasEfectivo),
    ventasTarjeta: String(corte.ventasTarjeta),
    ventasTransferencia: String(corte.ventasTransferencia),
    ventasFiado: String(corte.ventasFiado),
    totalVentas: String(corte.totalVentas),
    totalTransacciones: corte.totalTransacciones,
    efectivoEsperado: String(corte.efectivoEsperado),
    efectivoContado: String(corte.efectivoContado),
    diferencia: String(corte.diferencia),
    fondoInicial: String(corte.fondoInicial),
    gastosDelDia: String(corte.gastosDelDia),
    notas: corte.notas,
    status: corte.status,
  });

  await sendNotification(
    `<b>REPORTE DE CORTE DE CAJA</b>\n\n` +
      `Cajero: ${escapeHTML(corte.cajero)}\n` +
      `Total Ventas: $${numVal(String(corte.totalVentas)).toFixed(2)}\n` +
      `Efectivo Contado: $${numVal(String(corte.efectivoContado)).toFixed(2)}\n` +
      `Diferencia: $${numVal(String(corte.diferencia)).toFixed(2)}\n` +
      `Estatus: <b>${corte.status.toUpperCase()}</b>\n\n` +
      (corte.notas ? `Notas: ${escapeHTML(corte.notas)}` : ''),
  );

  return corte;
}

async function _createAutoCorteCaja(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const existingCortes = await db.select().from(cortesCaja);
  const todayCorte = existingCortes.find((c) => c.fecha.toISOString().startsWith(today));
  if (todayCorte) return;

  const allSales = await db.select().from(saleRecords);
  const todaySales = allSales.filter((s) => s.date.toISOString().startsWith(today) && s.status !== 'cancelada');
  if (todaySales.length === 0) return;

  const ventasEfectivo = todaySales
    .filter((s) => s.paymentMethod === 'efectivo')
    .reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const ventasTarjeta = todaySales
    .filter((s) => s.paymentMethod === 'tarjeta')
    .reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const ventasTransferencia = todaySales
    .filter((s) => s.paymentMethod === 'transferencia')
    .reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const ventasFiado = todaySales
    .filter((s) => s.paymentMethod === 'fiado')
    .reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia + ventasFiado;

  // Query only today's gastos at DB level (not full table scan)
  const todayStart = new Date(today + 'T00:00:00.000Z');
  const todayGastosRows = await db
    .select({ monto: gastos.monto })
    .from(gastos)
    .where(gte(gastos.fecha, todayStart));
  const todayGastos = todayGastosRows.reduce((sum, g) => sum + parseFloat(String(g.monto)), 0);

  const fondoInicial = 500;
  const efectivoEsperado = fondoInicial + ventasEfectivo - todayGastos;

  await db.insert(cortesCaja).values({
    id: crypto.randomUUID(),
    fecha: new Date(),
    cajero: 'Sistema (automatico)',
    ventasEfectivo: String(ventasEfectivo),
    ventasTarjeta: String(ventasTarjeta),
    ventasTransferencia: String(ventasTransferencia),
    ventasFiado: String(ventasFiado),
    totalVentas: String(totalVentas),
    totalTransacciones: todaySales.length,
    efectivoEsperado: String(efectivoEsperado),
    efectivoContado: String(efectivoEsperado),
    diferencia: '0',
    fondoInicial: String(fondoInicial),
    gastosDelDia: String(todayGastos),
    notas: 'Corte automatico generado a medianoche',
    status: 'cerrado',
  });
}

async function _deleteCortes(corteIds: string[]): Promise<void> {
  await requirePermission('corte.create');
  if (corteIds.length === 0) return;
  corteIds.forEach((id) => validateId(id, 'Corte ID'));
  await db.delete(cortesCaja).where(inArray(cortesCaja.id, corteIds));
}

// ==================== EXPORTS WITH LOGGING ====================
export const fetchSalesData = withLogging('sales.fetchSalesData', _fetchSalesData);
export const fetchHourlySalesData = withLogging('sales.fetchHourlySalesData', _fetchHourlySalesData);
export const fetchSaleRecords = withLogging('sales.fetchSaleRecords', _fetchSaleRecords);
export const createSale = withRateLimit('sales.createSale', withLogging('sales.createSale', _createSale));
export const cancelSale = withRateLimit('sales.cancelSale', withLogging('sales.cancelSale', _cancelSale));
export const deleteSales = withRateLimit('sales.deleteSales', withLogging('sales.deleteSales', _deleteSales));
export const fetchCortesHistory = withLogging('sales.fetchCortesHistory', _fetchCortesHistory);
export const createCorteCaja = withRateLimit(
  'sales.createCorteCaja',
  withLogging('sales.createCorteCaja', _createCorteCaja),
);
export const createAutoCorteCaja = withLogging('sales.createAutoCorteCaja', _createAutoCorteCaja);
export const deleteCortes = withRateLimit('sales.deleteCortes', withLogging('sales.deleteCortes', _deleteCortes));
