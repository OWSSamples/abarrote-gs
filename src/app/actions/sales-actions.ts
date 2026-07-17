'use server';

import { requirePermission, validateId } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { db } from '@/db';
import { nextTenantSequence } from '@/db/tenant-sequence';
import { setTenantTransactionContext } from '@/db/tenant-context';
import {
  saleRecords,
  saleItems,
  products,
  clientes,
  gastos,
  cortesCaja,
  loyaltyTransactions,
  devoluciones,
  fiadoTransactions,
  fiadoItems,
} from '@/db/schema';
import { and, eq, desc, sql, inArray, gte } from 'drizzle-orm';
import type { SaleRecord, SaleItem, SalesData, CorteCaja, HourlySalesData } from '@/types';
import { numVal } from './_helpers';
import { adjustStock } from './_stock';
import { sendNotification, escapeHTML } from './_notifications';
import { logger } from '@/lib/logger';
import { createCorteCajaSchema, createSaleSchema, deleteSalesSchema } from '@/lib/validation/schemas';
import { AppError, withLogging } from '@/lib/errors';
import {
  withRateLimit,
  idempotencyCheck,
  withLock,
  checkTieredRateLimit,
  RateLimitError,
  idempotencyClear,
} from '@/infrastructure/redis';
import { emitDomainEvent } from '@/domain/events';
import { getStoreConfig } from '@/server/store-config-service';
import { calculateSalePricing } from '@/domain/services/SalePricingService';
import { consumeSaleDiscountApproval } from '@/server/sale-discount-approval-service';

const UNSUPPORTED_SINGLE_TENDER_METHODS = new Set([
  'tarjeta',
  'tarjeta_web',
  'qr_cobro',
  'puntos',
  'spei_conekta',
  'oxxo_conekta',
  'spei_stripe',
  'oxxo_stripe',
  'tarjeta_clip',
  'clip_terminal',
]);

// ==================== FOLIO ====================

// No separate getNextFolio() needed — folio is generated atomically inside the INSERT.

// ==================== SALES DATA (computed) ====================

async function _fetchSalesData(): Promise<SalesData[]> {
  await requirePermission('sales.view');
  const { storeId } = await requireStoreScope();
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
      .where(
        and(
          eq(saleRecords.storeId, storeId),
          sql`date >= ${weekStart.toISOString()} and date < ${weekEnd.toISOString()} and status != 'cancelada'`,
        ),
      )
      .groupBy(sql`extract(dow from date)`),
    db
      .select({
        day: sql<number>`extract(dow from date)::int`,
        total: sql<string>`coalesce(sum(total::numeric), 0)`,
      })
      .from(saleRecords)
      .where(
        and(
          eq(saleRecords.storeId, storeId),
          sql`date >= ${prevWeekStart.toISOString()} and date < ${prevWeekEnd.toISOString()} and status != 'cancelada'`,
        ),
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
  const { storeId } = await requireStoreScope();
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
    .where(
      and(
        eq(saleRecords.storeId, storeId),
        sql`date >= ${startOfDay.toISOString()} and date < ${endOfDay.toISOString()} and status != 'cancelada'`,
      ),
    )
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
  const { storeId } = await requireStoreScope();
  const rows = await db
    .select()
    .from(saleRecords)
    .where(eq(saleRecords.storeId, storeId))
    .orderBy(desc(saleRecords.date))
    .limit(100);
  if (rows.length === 0) return [];

  // Batch fetch all items for all sales in one query
  const saleIds = rows.map((r) => r.id);
  const allItems = await db
    .select()
    .from(saleItems)
    .where(and(inArray(saleItems.saleId, saleIds), eq(saleItems.storeId, storeId)));

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
  saleData: Omit<SaleRecord, 'id' | 'folio' | 'date'> & {
    clienteId?: string;
    clientRequestId?: string;
    discountApprovalToken?: string;
  },
): Promise<SaleRecord> {
  return logger.withTiming(
    'createSale',
    async () => {
      const user = await requirePermission('sales.create');
      const { storeId } = await requireStoreScope();
      const rateLimit = await checkTieredRateLimit('sales.create', user.uid, {
        roleId: user.roleName ?? user.roleId,
      });
      if (rateLimit.blocked) throw new RateLimitError(rateLimit);

      // Runtime validation happens before idempotency so malformed requests cannot reserve valid keys.
      const parsed = createSaleSchema.safeParse(saleData);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        logger.warn('createSale validation failed', { action: 'sale_validation_error', issues });
        throw new AppError('INVALID_SALE', 'Los datos de la venta son inválidos.', 400);
      }
      const input = parsed.data;

      if (UNSUPPORTED_SINGLE_TENDER_METHODS.has(input.paymentMethod)) {
        throw new AppError(
          'PAYMENT_FLOW_REQUIRES_CONFIRMATION',
          'Este método requiere un flujo de pago verificado antes de registrar la venta.',
          409,
        );
      }

      const canApplyDiscount =
        user.roleName === 'Propietario' ||
        user.roleName === 'Administrador' ||
        user.permissions.includes('sales.discount');
      let discountAuthorizedByUid: string | undefined;
      if (input.discount > 0 && !canApplyDiscount) {
        if (!input.clientRequestId || !input.discountApprovalToken) {
          throw new AppError('DISCOUNT_NOT_AUTHORIZED', 'No tienes autorización para aplicar descuentos.', 403);
        }

        const approval = await consumeSaleDiscountApproval({
          token: input.discountApprovalToken,
          requesterUid: user.uid,
          storeId,
          context: {
            operation: 'sale_discount',
            clientRequestId: input.clientRequestId,
            discountValue: input.discount,
            discountType: input.discountType,
            items: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          },
        });
        if (!approval) {
          throw new AppError(
            'DISCOUNT_APPROVAL_INVALID',
            'La autorización del descuento expiró o ya fue utilizada.',
            403,
          );
        }
        discountAuthorizedByUid = approval.authorizedByUid;
        logger.info('Supervisor discount approval consumed', {
          action: 'sale_discount_approval_consumed',
          requesterUid: user.uid,
          authorizedByUid: approval.authorizedByUid,
          storeId,
        });
      }

      const storeConfiguration = await getStoreConfig();

      // ── Idempotency guard: prevent duplicate sale creation from double-clicks/retries ──
      // Prefer a client-provided request id (one per checkout attempt). Fall back
      // to a content-based key so legacy callers stay protected.
      const idempotencyKey = input.clientRequestId
        ? `sale:${storeId}:req:${input.clientRequestId}`
        : `sale:${storeId}:${input.total}:${input.paymentMethod}:${input.cajero}:${input.amountPaid}`;
      const isNew = await idempotencyCheck(idempotencyKey, { ttlMs: 10 * 60_000 });
      if (!isNew) {
        logger.warn('Duplicate sale creation blocked', { action: 'sale_idempotency_block', key: idempotencyKey });
        throw new Error('Venta duplicada detectada. Espera unos segundos e intenta de nuevo.');
      }

      const now = new Date();
      const cajero = user.displayName?.trim() || user.email || user.uid;
      const id = `sale-${crypto.randomUUID()}`;
      const clienteId = input.clienteId;

      // ── Distributed lock: prevent concurrent folio/stock race conditions ──
      // Lock by cajero to serialize sales from the same register
      let transactionResult: {
        folio: string;
        stockAlerts: { name: string; currentStock: number; minStock: number }[];
        pricing: ReturnType<typeof calculateSalePricing>;
      };
      try {
        transactionResult = await withLock(
          `sale:register:${storeId}:${user.uid}`,
          async () => {
          // ── Transactional core: sale + items + stock + loyalty ──
          // All DB mutations run inside a single transaction so a failure at any
          // step rolls back everything — no more partial sales with wrong stock.
          return db.transaction(async (tx) => {
            await setTenantTransactionContext(tx, storeId, user.uid);
            // 1. Tenant-local folio generation (atomic and independent per business).
            const txFolio = String(await nextTenantSequence(tx, storeId, 'sale_folio', 309001));

            // 2. Lock catalog and customer data before deriving any financial value.
            const required = new Map<string, number>();
            for (const item of input.items) {
              required.set(item.productId, (required.get(item.productId) ?? 0) + item.quantity);
            }
            const productIds = Array.from(required.keys());
            const lockedRows = await tx
              .select({
                id: products.id,
                name: products.name,
                sku: products.sku,
                unitPrice: products.unitPrice,
                currentStock: products.currentStock,
              })
              .from(products)
              .where(and(eq(products.storeId, storeId), inArray(products.id, productIds)))
              .for('update');

            let customerRow:
              | { id: string; name: string; points: string; balance: string; creditLimit: string }
              | undefined;
            if (clienteId) {
              [customerRow] = await tx
                .select({
                  id: clientes.id,
                  name: clientes.name,
                  points: clientes.points,
                  balance: clientes.balance,
                  creditLimit: clientes.creditLimit,
                })
                .from(clientes)
                .where(and(eq(clientes.id, clienteId), eq(clientes.storeId, storeId)))
                .for('update')
                .limit(1);
              if (!customerRow) throw new AppError('CUSTOMER_NOT_FOUND', 'El cliente seleccionado no existe.', 404);
            }

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

            const calculated = calculateSalePricing(
              {
                items: input.items,
                discountValue: input.discount,
                discountType: input.discountType,
                paymentMethod: input.paymentMethod,
                amountPaid: input.amountPaid,
                customerPoints: customerRow ? numVal(customerRow.points) : 0,
              },
              lockedRows,
              storeConfiguration,
            );
            const pricing = {
              ...calculated,
              pointsEarned: customerRow ? calculated.pointsEarned : 0,
            };

            if (input.paymentMethod === 'fiado' && customerRow) {
              const resultingBalance = numVal(customerRow.balance) + pricing.total;
              if (resultingBalance > numVal(customerRow.creditLimit)) {
                throw new AppError(
                  'CREDIT_LIMIT_EXCEEDED',
                  'La venta excede el límite de crédito disponible del cliente.',
                  409,
                );
              }
            }

            // 3. Persist only server-derived catalog and financial values.
            await tx.insert(saleRecords).values({
              id,
              folio: txFolio,
              subtotal: String(pricing.subtotal),
              iva: String(pricing.iva),
              cardSurcharge: String(pricing.cardSurcharge),
              total: String(pricing.total),
              paymentMethod: input.paymentMethod,
              amountPaid: String(pricing.amountPaid),
              change: String(pricing.change),
              cajero,
              pointsEarned: String(pricing.pointsEarned),
              pointsUsed: String(pricing.pointsUsed),
              discount: String(pricing.discount),
              discountType: pricing.discountType,
              installments: input.installments,
              mpPaymentId: input.mpPaymentId ?? null,
              date: now,
              storeId,
            });

            for (const item of pricing.items) {
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

            // 4. Register customer credit atomically with the sale and its line items.
            if (input.paymentMethod === 'fiado' && customerRow) {
              const creditId = `fiado-${crypto.randomUUID()}`;
              await tx.insert(fiadoTransactions).values({
                id: creditId,
                clienteId: customerRow.id,
                clienteName: customerRow.name,
                type: 'fiado',
                amount: String(pricing.total),
                description: `Venta a crédito, folio ${txFolio}`,
                saleFolio: txFolio,
                date: now,
                storeId,
              });
              for (const item of pricing.items) {
                await tx.insert(fiadoItems).values({
                  id: `fi-${crypto.randomUUID()}`,
                  fiadoId: creditId,
                  productId: item.productId,
                  productName: item.productName,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPrice: String(item.unitPrice),
                  subtotal: String(item.subtotal),
                  storeId,
                });
              }
              await tx
                .update(clientes)
                .set({
                  balance: sql`balance::numeric + ${pricing.total}`,
                  lastTransaction: now,
                })
                .where(and(eq(clientes.id, customerRow.id), eq(clientes.storeId, storeId)));
            }

            // 5. Deduct stock using shared helper (inside tx)
            const alerts: { name: string; currentStock: number; minStock: number }[] = [];
            for (const item of pricing.items) {
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

            // 6. Loyalty points (inside tx for consistency)
            if (clienteId && customerRow) {
              const saldoAnterior = numVal(customerRow.points);
              let runningBalance = saldoAnterior;

              await tx
                .update(clientes)
                .set({
                  points: sql`points::numeric + ${pricing.pointsEarned} - ${pricing.pointsUsed}`,
                  lastTransaction: now,
                })
                .where(and(eq(clientes.id, clienteId), eq(clientes.storeId, storeId)));

              // Record canje (redemption) as a separate transaction
              if (pricing.pointsUsed > 0) {
                const saldoDespuesCanje = runningBalance - pricing.pointsUsed;
                await tx.insert(loyaltyTransactions).values({
                  id: `lt-${crypto.randomUUID()}`,
                  clienteId,
                  clienteName: customerRow.name,
                  tipo: 'canje',
                  puntos: String(-pricing.pointsUsed),
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
              if (pricing.pointsEarned > 0) {
                const saldoDespuesAcum = runningBalance + pricing.pointsEarned;
                await tx.insert(loyaltyTransactions).values({
                  id: `lt-${crypto.randomUUID()}`,
                  clienteId,
                  clienteName: customerRow.name,
                  tipo: 'acumulacion',
                  puntos: String(pricing.pointsEarned),
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

            return { folio: txFolio, stockAlerts: alerts, pricing };
          });
        },
          { ttlMs: 15_000, waitMs: 10_000 },
        );
      } catch (error) {
        await idempotencyClear(idempotencyKey);
        throw error;
      }
      const { folio, stockAlerts, pricing } = transactionResult;

      // ── Side effects (outside transaction — non-critical) ──

      emitDomainEvent({
        type: 'sale.created',
        payload: {
          saleId: id,
          folio,
          total: pricing.total,
          paymentMethod: input.paymentMethod,
          cajero,
          itemCount: pricing.items.length,
          discountAuthorizedByUid,
        },
        metadata: { userId: user.uid, userEmail: user.email ?? '', storeId },
      });

      // Stock critical alerts — published as background jobs (non-blocking).
      // QStash handles retries and falls back to inline fire-and-forget if unavailable.
      for (const alert of stockAlerts) {
        const message =
          `<b>REPORTE DE STOCK CRÍTICO</b>\n\n` +
          `Producto: ${escapeHTML(alert.name)}\n` +
          `Stock actual: ${alert.currentStock}\n` +
          `Mínimo sugerido: ${alert.minStock}`;
        void sendNotification(message, storeId);
      }

      // Notificación de venta detallada y estética — también async vía qstash
      const itemsList = pricing.items
        .map((it) => `• ${it.quantity}x ${escapeHTML(it.productName)} ($${numVal(String(it.unitPrice)).toFixed(2)})`)
        .join('\n');

      const saleMessage =
        `<b>REPORTE DE VENTA (#${folio})</b>\n\n` +
        `Cajero: ${escapeHTML(cajero)}\n` +
        `Método de Pago: ${input.paymentMethod.toUpperCase()}\n` +
        `---------------------------------\n` +
        `<b>DETALLE DE PRODUCTOS:</b>\n${itemsList}\n` +
        `---------------------------------\n` +
        `<b>TOTAL: $${pricing.total.toFixed(2)}</b>\n\n` +
        (pricing.pointsUsed > 0 ? `Puntos canjeados: ${pricing.pointsUsed}\n` : '') +
        `Hora: ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
      void sendNotification(saleMessage, storeId);

      return {
        id,
        folio,
        items: pricing.items,
        subtotal: pricing.subtotal,
        iva: pricing.iva,
        cardSurcharge: pricing.cardSurcharge,
        total: pricing.total,
        paymentMethod: input.paymentMethod,
        installments: input.installments,
        mpPaymentId: input.mpPaymentId ?? null,
        amountPaid: pricing.amountPaid,
        change: pricing.change,
        date: now.toISOString(),
        cajero,
        pointsEarned: pricing.pointsEarned,
        pointsUsed: pricing.pointsUsed,
        discount: pricing.discount,
        discountType: pricing.discountType,
        status: 'completada',
      } satisfies SaleRecord;
    },
    { items: Array.isArray(saleData?.items) ? saleData.items.length : 0 },
  );
}

type SalesTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface CancelledSale {
  saleId: string;
  folio: string;
}

async function cancelSalesInStore(
  tx: SalesTransaction,
  saleIds: string[],
  storeId: string,
  actor: { uid: string; email: string },
): Promise<CancelledSale[]> {
  await setTenantTransactionContext(tx, storeId, actor.uid);
  const cancelled: CancelledSale[] = [];

  // Stable lock order prevents deadlocks when two bulk cancellations overlap.
  for (const saleId of [...new Set(saleIds)].sort()) {
    const [sale] = await tx
      .select()
      .from(saleRecords)
      .where(and(eq(saleRecords.id, saleId), eq(saleRecords.storeId, storeId)))
      .for('update')
      .limit(1);

    if (!sale || sale.status === 'cancelada') continue;
    if (sale.status !== 'completada') {
      throw new AppError(
        'SALE_NOT_CANCELLABLE',
        `La venta ${sale.folio} no está en un estado que permita cancelación.`,
        409,
      );
    }

    const [existingReturn] = await tx
      .select({ id: devoluciones.id })
      .from(devoluciones)
      .where(and(eq(devoluciones.saleId, saleId), eq(devoluciones.storeId, storeId)))
      .limit(1);
    if (existingReturn) {
      throw new AppError(
        'SALE_HAS_RETURNS',
        `La venta ${sale.folio} tiene devoluciones registradas y requiere conciliación manual antes de cancelarse.`,
        409,
      );
    }

    const items = await tx
      .select()
      .from(saleItems)
      .where(and(eq(saleItems.saleId, saleId), eq(saleItems.storeId, storeId)));
    for (const item of items) {
      await adjustStock(item.productId, item.quantity, {
        tx,
        meta: {
          type: 'return',
          source: 'venta',
          sourceId: saleId,
          sourceLabel: `Cancelación folio ${sale.folio}`,
          unitCost: numVal(item.unitPrice),
          notes: 'Reversión por cancelación de venta',
          userId: actor.uid,
          userName: actor.email,
          storeId,
        },
      });
    }

    if (sale.paymentMethod === 'fiado') {
      const creditTransactions = await tx
        .select()
        .from(fiadoTransactions)
        .where(
          and(
            eq(fiadoTransactions.saleFolio, sale.folio),
            eq(fiadoTransactions.storeId, storeId),
            eq(fiadoTransactions.type, 'fiado'),
          ),
        );
      for (const transaction of creditTransactions) {
        const now = new Date();
        const [laterPayment] = await tx
          .select({ id: fiadoTransactions.id })
          .from(fiadoTransactions)
          .where(
            and(
              eq(fiadoTransactions.clienteId, transaction.clienteId),
              eq(fiadoTransactions.storeId, storeId),
              eq(fiadoTransactions.type, 'abono'),
              gte(fiadoTransactions.date, transaction.date),
            ),
          )
          .limit(1);
        if (laterPayment) {
          throw new AppError(
            'CREDIT_RECONCILIATION_REQUIRED',
            `La venta ${sale.folio} ya tiene movimientos de abono posteriores y requiere conciliación manual.`,
            409,
          );
        }

        const [customer] = await tx
          .select({ balance: clientes.balance })
          .from(clientes)
          .where(and(eq(clientes.id, transaction.clienteId), eq(clientes.storeId, storeId)))
          .for('update')
          .limit(1);
        if (!customer || numVal(customer.balance) < numVal(transaction.amount)) {
          throw new AppError(
            'CREDIT_RECONCILIATION_REQUIRED',
            `El saldo de la venta ${sale.folio} ya no puede revertirse automáticamente.`,
            409,
          );
        }

        await tx
          .update(clientes)
          .set({
            balance: sql`balance::numeric - ${transaction.amount}`,
            lastTransaction: now,
          })
          .where(and(eq(clientes.id, transaction.clienteId), eq(clientes.storeId, storeId)));
        await tx.insert(fiadoTransactions).values({
          id: `abono-${crypto.randomUUID()}`,
          clienteId: transaction.clienteId,
          clienteName: transaction.clienteName,
          type: 'abono',
          amount: transaction.amount,
          description: `Reversión por cancelación de venta ${sale.folio}`,
          saleFolio: sale.folio,
          date: now,
          storeId,
        });
      }
    }

    const saleLoyaltyTransactions = await tx
      .select()
      .from(loyaltyTransactions)
      .where(
        and(eq(loyaltyTransactions.saleId, saleId), eq(loyaltyTransactions.storeId, storeId)),
      );
    const pointsByCustomer = new Map<string, number>();
    for (const transaction of saleLoyaltyTransactions) {
      pointsByCustomer.set(
        transaction.clienteId,
        (pointsByCustomer.get(transaction.clienteId) ?? 0) + numVal(transaction.puntos),
      );
    }

    for (const customerId of [...pointsByCustomer.keys()].sort()) {
      const pointDelta = pointsByCustomer.get(customerId) ?? 0;
      if (pointDelta === 0) continue;

      const [customer] = await tx
        .select({ name: clientes.name, points: clientes.points })
        .from(clientes)
        .where(and(eq(clientes.id, customerId), eq(clientes.storeId, storeId)))
        .for('update')
        .limit(1);
      if (!customer) continue;

      const previousBalance = numVal(customer.points);
      const newBalance = previousBalance - pointDelta;
      if (newBalance < 0) {
        throw new AppError(
          'LOYALTY_RECONCILIATION_REQUIRED',
          `Los puntos obtenidos en la venta ${sale.folio} ya fueron utilizados y requieren conciliación manual.`,
          409,
        );
      }
      const now = new Date();
      await tx
        .update(clientes)
        .set({ points: String(newBalance), lastTransaction: now })
        .where(and(eq(clientes.id, customerId), eq(clientes.storeId, storeId)));
      await tx.insert(loyaltyTransactions).values({
        id: `lt-${crypto.randomUUID()}`,
        clienteId: customerId,
        clienteName: customer.name,
        tipo: 'ajuste',
        puntos: String(-pointDelta),
        saldoAnterior: String(previousBalance),
        saldoNuevo: String(newBalance),
        saleId,
        saleFolio: sale.folio,
        notas: `Reversión por cancelación de venta ${sale.folio}`,
        cajero: actor.email || 'Sistema',
        fecha: now,
        storeId,
      });
    }

    await tx
      .update(saleRecords)
      .set({ status: 'cancelada' })
      .where(and(eq(saleRecords.id, saleId), eq(saleRecords.storeId, storeId)));
    cancelled.push({ saleId, folio: sale.folio });
  }

  return cancelled;
}

function emitCancellationEvents(
  cancelled: CancelledSale[],
  actor: { uid: string; email: string },
  storeId: string,
): void {
  for (const sale of cancelled) {
    emitDomainEvent({
      type: 'sale.cancelled',
      payload: { saleId: sale.saleId, folio: sale.folio },
      metadata: { userId: actor.uid, userEmail: actor.email, storeId },
    });
  }
}

async function _cancelSale(saleId: string): Promise<void> {
  const user = await requirePermission('sales.cancel');
  const { storeId } = await requireStoreScope();
  validateId(saleId, 'Sale ID');

  const cancelled = await db.transaction((tx) => cancelSalesInStore(tx, [saleId], storeId, user));
  emitCancellationEvents(cancelled, user, storeId);
}

async function _deleteSales(saleIds: string[]): Promise<void> {
  const user = await requirePermission('sales.cancel');
  const { storeId } = await requireStoreScope();
  if (saleIds.length === 0) return;
  const parsed = deleteSalesSchema.safeParse({ saleIds });
  if (!parsed.success) {
    throw new AppError('INVALID_SALE_IDS', 'La selección de ventas no es válida.', 400);
  }

  const cancelled = await db.transaction((tx) =>
    cancelSalesInStore(tx, parsed.data.saleIds, storeId, user),
  );
  emitCancellationEvents(cancelled, user, storeId);
}

// ==================== CORTES DE CAJA ====================

const CASH_PAYMENT_METHODS = new Set(['efectivo']);
const CARD_PAYMENT_METHODS = new Set([
  'tarjeta',
  'tarjeta_web',
  'tarjeta_manual',
  'oxxo_conekta',
  'oxxo_stripe',
  'tarjeta_clip',
  'clip_terminal',
]);
const TRANSFER_PAYMENT_METHODS = new Set([
  'transferencia',
  'spei',
  'spei_conekta',
  'spei_stripe',
  'paypal',
  'qr_cobro',
  'puntos',
]);

function summarizeSalesByPaymentMethod(rows: (typeof saleRecords.$inferSelect)[]) {
  const sum = (methods: Set<string>) =>
    rows.filter((sale) => methods.has(sale.paymentMethod)).reduce((total, sale) => total + numVal(sale.total), 0);
  const ventasEfectivo = sum(CASH_PAYMENT_METHODS);
  const ventasTarjeta = sum(CARD_PAYMENT_METHODS);
  const ventasTransferencia = sum(TRANSFER_PAYMENT_METHODS);
  const ventasFiado = sum(new Set(['fiado']));

  return {
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    ventasFiado,
    totalVentas: ventasEfectivo + ventasTarjeta + ventasTransferencia + ventasFiado,
    totalTransacciones: rows.length,
  };
}

async function _fetchCortesHistory(): Promise<CorteCaja[]> {
  await requirePermission('corte.view');
  const { storeId } = await requireStoreScope();
  const rows = await db
    .select()
    .from(cortesCaja)
    .where(eq(cortesCaja.storeId, storeId))
    .orderBy(desc(cortesCaja.fecha))
    .limit(30);
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
  const { storeId } = await requireStoreScope();
  const parsed = createCorteCajaSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError('INVALID_CASH_CLOSE', 'Los datos del corte de caja son inválidos.', 400);
  }
  const input = parsed.data;
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

  const salesRows = await db
    .select()
    .from(saleRecords)
    .where(
      and(
        eq(saleRecords.storeId, storeId),
        sql`(${saleRecords.date} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date AND ${saleRecords.status} != 'cancelada'`,
      ),
    );

  const {
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    ventasFiado,
    totalVentas,
    totalTransacciones,
  } = summarizeSalesByPaymentMethod(salesRows);

  const gastosRows = await db
    .select()
    .from(gastos)
    .where(
      and(
        eq(gastos.storeId, storeId),
        sql`(${gastos.fecha} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date`,
      ),
    );
  const gastosDelDia = gastosRows.reduce((sum, g) => sum + numVal(g.monto), 0);

  const efectivoEsperado = input.fondoInicial + ventasEfectivo - gastosDelDia;
  const diferencia = input.efectivoContado - efectivoEsperado;

  const corte: CorteCaja = {
    id: `corte-${crypto.randomUUID()}`,
    fecha: new Date().toISOString(),
    cajero: input.cajero.trim(),
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    ventasFiado,
    totalVentas,
    totalTransacciones,
    efectivoEsperado,
    efectivoContado: input.efectivoContado,
    diferencia,
    fondoInicial: input.fondoInicial,
    gastosDelDia,
    notas: input.notas,
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
    storeId,
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
  await requirePermission('corte.create');
  const { storeId } = await requireStoreScope();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

  await withLock(
    `corte:auto:${storeId}:${todayStr}`,
    async () => {
      const [existingCorte] = await db
        .select({ id: cortesCaja.id })
        .from(cortesCaja)
        .where(
          and(
            eq(cortesCaja.storeId, storeId),
            sql`(${cortesCaja.fecha} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date`,
          ),
        )
        .limit(1);
      if (existingCorte) return;

      const todaySales = await db
        .select()
        .from(saleRecords)
        .where(
          and(
            eq(saleRecords.storeId, storeId),
            sql`(${saleRecords.date} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date AND ${saleRecords.status} != 'cancelada'`,
          ),
        );
      if (todaySales.length === 0) return;

      const summary = summarizeSalesByPaymentMethod(todaySales);
      const todayGastosRows = await db
        .select({ monto: gastos.monto })
        .from(gastos)
        .where(
          and(
            eq(gastos.storeId, storeId),
            sql`(${gastos.fecha} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date`,
          ),
        );
      const todayGastos = todayGastosRows.reduce((sum, gasto) => sum + numVal(gasto.monto), 0);
      const fondoInicial = 500;
      const efectivoEsperado = fondoInicial + summary.ventasEfectivo - todayGastos;

      await db.insert(cortesCaja).values({
        id: `corte-${crypto.randomUUID()}`,
        fecha: new Date(),
        cajero: 'Sistema (automático)',
        ventasEfectivo: String(summary.ventasEfectivo),
        ventasTarjeta: String(summary.ventasTarjeta),
        ventasTransferencia: String(summary.ventasTransferencia),
        ventasFiado: String(summary.ventasFiado),
        totalVentas: String(summary.totalVentas),
        totalTransacciones: summary.totalTransacciones,
        efectivoEsperado: String(efectivoEsperado),
        efectivoContado: String(efectivoEsperado),
        diferencia: '0',
        fondoInicial: String(fondoInicial),
        gastosDelDia: String(todayGastos),
        notas: 'Corte automático generado a medianoche',
        status: 'cerrado',
        storeId,
      });
    },
    { ttlMs: 15_000, waitMs: 2_000 },
  );
}

async function _deleteCortes(corteIds: string[]): Promise<void> {
  await requirePermission('corte.create');
  const { storeId } = await requireStoreScope();
  if (corteIds.length === 0) return;
  if (corteIds.length > 100) {
    throw new AppError('TOO_MANY_CASH_CLOSE_IDS', 'Solo puedes eliminar hasta 100 cortes por operación.', 400);
  }
  corteIds.forEach((id) => validateId(id, 'Corte ID'));
  await db
    .delete(cortesCaja)
    .where(and(inArray(cortesCaja.id, corteIds), eq(cortesCaja.storeId, storeId)));
}

// ==================== EXPORTS WITH LOGGING ====================
export const fetchSalesData = withLogging('sales.fetchSalesData', _fetchSalesData);
export const fetchHourlySalesData = withLogging('sales.fetchHourlySalesData', _fetchHourlySalesData);
export const fetchSaleRecords = withLogging('sales.fetchSaleRecords', _fetchSaleRecords);
export const createSale = withLogging('sales.createSale', _createSale);
export const cancelSale = withRateLimit('sales.cancelSale', withLogging('sales.cancelSale', _cancelSale));
export const deleteSales = withRateLimit('sales.deleteSales', withLogging('sales.deleteSales', _deleteSales));
export const fetchCortesHistory = withLogging('sales.fetchCortesHistory', _fetchCortesHistory);
export const createCorteCaja = withRateLimit(
  'sales.createCorteCaja',
  withLogging('sales.createCorteCaja', _createCorteCaja),
);
export const createAutoCorteCaja = withLogging('sales.createAutoCorteCaja', _createAutoCorteCaja);
export const deleteCortes = withRateLimit('sales.deleteCortes', withLogging('sales.deleteCortes', _deleteCortes));
