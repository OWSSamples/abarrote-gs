'use server';

import { requirePermission, requireAuth, validateId } from '@/lib/auth/guard';
import { db } from '@/db';
import { saleRecords, saleItems, products, clientes, gastos, cortesCaja, loyaltyTransactions, devoluciones } from '@/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import type { SaleRecord, SaleItem, SalesData, CorteCaja, HourlySalesData } from '@/types';
import { numVal } from './_helpers';
import { sendNotification, escapeHTML } from './_notifications';
import { logger } from '@/lib/logger';
import { createConektaSPEICharge, createConektaOXXOCharge } from '@/lib/conekta-provider';
import { createStripeSPEICharge, createStripeOXXOCharge } from '@/lib/stripe-provider';
import { createClipCheckoutCharge, createClipTerminalCharge } from '@/lib/clip-provider';
import { paymentCharges } from '@/db/schema';
import { createSaleSchema } from '@/lib/validation/schemas';
import { publishJob } from '@/infrastructure/qstash';

// ==================== FOLIO ====================

// No separate getNextFolio() needed — folio is generated atomically inside the INSERT.

// ==================== SALES DATA (computed) ====================

export async function fetchSalesData(): Promise<SalesData[]> {
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
    db.select({
      day: sql<number>`extract(dow from date)::int`,
      total: sql<string>`coalesce(sum(total::numeric), 0)`,
    })
      .from(saleRecords)
      .where(sql`date >= ${weekStart.toISOString()} and date < ${weekEnd.toISOString()}`)
      .groupBy(sql`extract(dow from date)`),
    db.select({
      day: sql<number>`extract(dow from date)::int`,
      total: sql<string>`coalesce(sum(total::numeric), 0)`,
    })
      .from(saleRecords)
      .where(sql`date >= ${prevWeekStart.toISOString()} and date < ${prevWeekEnd.toISOString()}`)
      .groupBy(sql`extract(dow from date)`),
  ]);

  const currentByDay = new Map(currentRows.map(r => [r.day, numVal(r.total)]));
  const prevByDay = new Map(prevRows.map(r => [r.day, numVal(r.total)]));

  return Array.from({ length: 7 }, (_, i) => ({
    date: days[i],
    currentWeek: currentByDay.get(i) ?? 0,
    previousWeek: prevByDay.get(i) ?? 0,
  }));
}

export async function fetchHourlySalesData(): Promise<HourlySalesData[]> {
  await requirePermission('sales.view');
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const startOfDay = new Date(`${todayStr}T00:00:00-06:00`);
  const endOfDay = new Date(`${todayStr}T23:59:59-06:00`);

  const rows = await db.select({
    hour: sql<number>`extract(hour from date)::int`,
    sales: sql<string>`coalesce(sum(total::numeric), 0)`,
    count: sql<number>`count(*)::int`,
  })
    .from(saleRecords)
    .where(sql`date >= ${startOfDay.toISOString()} and date < ${endOfDay.toISOString()}`)
    .groupBy(sql`extract(hour from date)`)
    .orderBy(sql`extract(hour from date)`);

  const salesByHour = new Map(rows.map(r => [r.hour, { sales: numVal(r.sales), count: r.count }]));
  
  // Encontrar el umbral para "Hora Pico" (Ej: top 25% de ventas o basado en promedio)
  const allSales = rows.map(r => numVal(r.sales));
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
  }).filter(h => {
    const hourInt = parseInt(h.hour);
    return hourInt >= 6 && hourInt <= 22; // Horario de tienda típico
  });
}

// ==================== SALES ====================

export async function fetchSaleRecords(): Promise<SaleRecord[]> {
  await requirePermission('sales.view');
  const rows = await db.select().from(saleRecords).orderBy(desc(saleRecords.date)).limit(100);
  if (rows.length === 0) return [];

  // Batch fetch all items for all sales in one query
  const saleIds = rows.map(r => r.id);
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

  return rows.map(row => ({
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
    discount: numVal((row as any).discount ?? '0'),
    discountType: ((row as any).discountType ?? 'amount') as 'amount' | 'percent',
    installments: (row as any).installments ?? 1,
    mpPaymentId: (row as any).mpPaymentId ?? null,
  }));
}

export async function createSale(
  saleData: Omit<SaleRecord, 'id' | 'folio' | 'date'>
): Promise<SaleRecord> {
  return logger.withTiming('createSale', async () => {
  await requirePermission('sales.create');

  // ── Runtime validation ──
  const parsed = createSaleSchema.safeParse(saleData);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    logger.warn('createSale validation failed', { action: 'sale_validation_error', issues });
    throw new Error(`Datos de venta inválidos: ${issues}`);
  }

  const now = new Date();
  const cajero = saleData.cajero?.trim() || 'Cajero';
  const id = `sale-${crypto.randomUUID()}`;

  // ── PostgreSQL SEQUENCE: industry-standard for high-volume POS ──
  // 1. Create sequence if not exists (idempotent, runs once ever)
  // 2. Sync sequence to current MAX(folio) so it never collides
  // 3. nextval() is 100% atomic — impossible to duplicate even with 100 concurrent cashiers
    let folio: string;
    try {
      // 1. Asegurar secuencia
      await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS folio_seq START WITH 309001`);

      // 2. Obtener siguiente valor de forma atómica (estándar PG)
      const seqResult = await db.execute(sql`SELECT nextval('folio_seq')::text AS folio`);
      const rows = (seqResult as any).rows || seqResult;
      const nextSeq = String(rows?.[0]?.folio ?? rows?.[0]?.val ?? '');
      
      // 3. Verificación de seguridad: si por alguna razón el folio ya existe, saltamos al Max + 1
      const [existing] = await db.select().from(saleRecords).where(eq(saleRecords.folio, nextSeq)).limit(1);
      
      if (existing || !nextSeq) {
        await db.execute(sql`
          SELECT setval('folio_seq', (SELECT COALESCE(MAX(CASE WHEN folio ~ '^[0-9]+$' THEN folio::bigint END), 309000) FROM sale_records) + 1)
        `);
        const retryRes = await db.execute(sql`SELECT nextval('folio_seq')::text AS folio`);
        const retryRows = (retryRes as any).rows || retryRes;
        folio = String(retryRows?.[0]?.folio ?? retryRows?.[0]?.val ?? '');
      } else {
        folio = nextSeq;
      }

      if (!folio) throw new Error('No se pudo generar el folio único');

    // Normal insert with the guaranteed-unique folio
    await db.insert(saleRecords).values({
      id,
      folio,
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
    });
  } catch (err: any) {
    const pgCode    = err?.code ?? err?.cause?.code;
    const pgMessage = err?.message ?? err?.cause?.message;
    const detail    = err?.detail ?? err?.cause?.detail ?? err?.hint ?? err?.constraint;
    // Log full error internally — never expose PG internals to the client
    logger.error('Sale insert failed', {
      action: 'create_sale_error',
      pgCode,
      pgMessage,
      detail,
    });
    throw new Error('No se pudo registrar la venta. Intenta de nuevo o contacta soporte.');
  }

  const clienteId = (saleData as any).clienteId;
  if (clienteId) {
    // Get current points balance before update
    const [clienteRow] = await db.select().from(clientes).where(eq(clientes.id, clienteId)).limit(1);
    const saldoAnterior = clienteRow ? numVal(clienteRow.points) : 0;
    const puntosNetos = saleData.pointsEarned - saleData.pointsUsed;
    const saldoNuevo = saldoAnterior + puntosNetos;

    await db.update(clientes)
      .set({
        points: sql`points::numeric + ${saleData.pointsEarned} - ${saleData.pointsUsed}`,
        lastTransaction: now,
      })
      .where(eq(clientes.id, clienteId));

    // Write loyalty history only when points change
    if (puntosNetos !== 0) {
      const ltId = `lt-${crypto.randomUUID()}`;
      await db.insert(loyaltyTransactions).values({
        id: ltId,
        clienteId,
        clienteName: clienteRow?.name ?? '',
        tipo: saleData.pointsEarned > 0 ? 'acumulacion' : 'canje',
        puntos: String(puntosNetos),
        saldoAnterior: String(saldoAnterior),
        saldoNuevo: String(saldoNuevo),
        saleId: id,
        saleFolio: folio,
        notas: `Venta folio ${folio}`,
        cajero,        fecha: now,
      });
    }
  }

  for (const item of saleData.items) {
    await db.insert(saleItems).values({
      id: `si-${crypto.randomUUID()}`,
      saleId: id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      subtotal: String(item.subtotal),
    });
  }

  // Batch stock update: use RETURNING to avoid N+1 queries
  for (const item of saleData.items) {
    const [updated] = await db
      .update(products)
      .set({
        currentStock: sql`greatest(0, current_stock - ${item.quantity})`,
        updatedAt: now,
      })
      .where(eq(products.id, item.productId))
      .returning({
        name: products.name,
        currentStock: products.currentStock,
        minStock: products.minStock,
      });

    if (updated && updated.currentStock <= updated.minStock * 0.2) {
      await sendNotification(
        `<b>REPORTE DE STOCK CRÍTICO</b>\n\n` +
        `Producto: ${escapeHTML(updated.name)}\n` +
        `Stock actual: ${updated.currentStock}\n` +
        `Mínimo sugerido: ${updated.minStock}`
      );
    }
  }

  // Notificación de venta detallada y estética
  const itemsList = saleData.items.map(it => 
    `• ${it.quantity}x ${escapeHTML(it.productName)} ($${numVal(String(it.unitPrice)).toFixed(2)})`
  ).join('\n');

  await sendNotification(
    `<b>REPORTE DE VENTA (#${folio})</b>\n\n` +
    `Cajero: ${escapeHTML(cajero)}\n` +
    `Método de Pago: ${saleData.paymentMethod.toUpperCase()}\n` +
    `---------------------------------\n` +
    `<b>DETALLE DE PRODUCTOS:</b>\n${itemsList}\n` +
    `---------------------------------\n` +
    `<b>TOTAL: $${numVal(String(saleData.total)).toFixed(2)}</b>\n\n` +
    (saleData.pointsUsed > 0 ? `Puntos canjeados: ${saleData.pointsUsed}\n` : '') +
    `Hora: ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
  );

  // ── Automated payment charge creation ──
  // For SPEI/OXXO automated methods, create a charge with the provider
  // and link it to this sale. The charge returns a CLABE or OXXO reference.
  let chargeResult: Record<string, unknown> | null = null;
  const pm = saleData.paymentMethod;
  const clienteId2 = (saleData as any).clienteId;
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
      await db.update(paymentCharges)
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
      await db.update(paymentCharges)
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
      await db.update(paymentCharges)
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
      await db.update(paymentCharges)
        .set({ saleId: id })
        .where(eq(paymentCharges.referenceNumber, result.reference));
      chargeResult = result as unknown as Record<string, unknown>;
    } else if (pm === 'tarjeta_clip') {
      const result = await createClipCheckoutCharge({
        amount: numVal(String(saleData.total)),
        description: `Venta #${folio}`,
        saleReference: folio,
      });
      await db.update(paymentCharges)
        .set({ saleId: id })
        .where(eq(paymentCharges.referenceNumber, result.referenceNumber));
      chargeResult = result as unknown as Record<string, unknown>;
    } else if (pm === 'clip_terminal') {
      const result = await createClipTerminalCharge({
        amount: numVal(String(saleData.total)),
        saleReference: folio,
      });
      await db.update(paymentCharges)
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
      spei_conekta: 'conekta', oxxo_conekta: 'conekta',
      spei_stripe: 'stripe', oxxo_stripe: 'stripe',
      tarjeta_clip: 'clip', clip_terminal: 'clip',
    };
    const provider = providerMap[pm];
    if (provider) {
      const refNum = (chargeResult as Record<string, string>).referenceNumber
                  || (chargeResult as Record<string, string>).reference;
      if (refNum) {
        // Query the charge ID from DB by reference
        const [charge] = await db
          .select({ id: paymentCharges.id })
          .from(paymentCharges)
          .where(eq(paymentCharges.referenceNumber, refNum))
          .limit(1);

        if (charge) {
          // Poll after 2 min delay — gives webhooks time to arrive first
          publishJob(
            'payment-poll',
            { chargeId: charge.id, provider },
            { delaySec: 120, retries: 5 },
          ).catch(() => { /* fire-and-forget */ });
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
  }, { items: saleData.items.length });
}

export async function cancelSale(saleId: string): Promise<void> {
  await requirePermission('sales.cancel');
  validateId(saleId, 'Sale ID');
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  for (const item of items) {
    await db
      .update(products)
      .set({
        currentStock: sql`current_stock + ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, item.productId));
  }
  await db.delete(devoluciones).where(eq(devoluciones.saleId, saleId));
  await db.delete(loyaltyTransactions).where(eq(loyaltyTransactions.saleId, saleId));
  await db.delete(saleItems).where(eq(saleItems.saleId, saleId));
  await db.delete(saleRecords).where(eq(saleRecords.id, saleId));
}

export async function deleteSales(saleIds: string[]): Promise<void> {
  await requirePermission('sales.cancel');
  if (saleIds.length === 0) return;
  saleIds.forEach(id => validateId(id, 'Sale ID'));

  // Restaurar stock de todos los items involucrados
  const allItems = await db.select().from(saleItems).where(inArray(saleItems.saleId, saleIds));
  await Promise.all(
    allItems.map(item =>
      db.update(products)
        .set({ currentStock: sql`current_stock + ${item.quantity}`, updatedAt: new Date() })
        .where(eq(products.id, item.productId))
    )
  );

  await db.delete(devoluciones).where(inArray(devoluciones.saleId, saleIds));
  await db.delete(loyaltyTransactions).where(inArray(loyaltyTransactions.saleId, saleIds));
  await db.delete(saleItems).where(inArray(saleItems.saleId, saleIds));
  await db.delete(saleRecords).where(inArray(saleRecords.id, saleIds));
}

// ==================== CORTES DE CAJA ====================

export async function fetchCortesHistory(): Promise<CorteCaja[]> {
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

export async function createCorteCaja(data: {
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
    .where(sql`(${saleRecords.date} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date`);

  const EFECTIVO_METHODS = new Set(['efectivo']);
  const TARJETA_METHODS = new Set(['tarjeta', 'tarjeta_web', 'tarjeta_manual', 'oxxo_conekta', 'oxxo_stripe', 'tarjeta_clip', 'clip_terminal']);
  const TRANSFER_METHODS = new Set(['transferencia', 'spei', 'spei_conekta', 'spei_stripe', 'paypal', 'qr_cobro', 'puntos']);
  const FIADO_METHODS = new Set(['fiado']);

  const ventasEfectivo = salesRows.filter((s) => EFECTIVO_METHODS.has(s.paymentMethod)).reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasTarjeta = salesRows.filter((s) => TARJETA_METHODS.has(s.paymentMethod)).reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasTransferencia = salesRows.filter((s) => TRANSFER_METHODS.has(s.paymentMethod)).reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasFiado = salesRows.filter((s) => FIADO_METHODS.has(s.paymentMethod)).reduce((sum, s) => sum + numVal(s.total), 0);
  const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia + ventasFiado;
  const totalTransacciones = salesRows.length;

  const gastosRows = await db.select().from(gastos).where(sql`(${gastos.fecha} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date = ${todayStr}::date`);
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
    (corte.notas ? `Notas: ${escapeHTML(corte.notas)}` : '')
  );

  return corte;
}

export async function createAutoCorteCaja(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const existingCortes = await db.select().from(cortesCaja);
  const todayCorte = existingCortes.find(c => c.fecha.toISOString().startsWith(today));
  if (todayCorte) return;

  const allSales = await db.select().from(saleRecords);
  const todaySales = allSales.filter(s => s.date.toISOString().startsWith(today));
  if (todaySales.length === 0) return;

  const ventasEfectivo = todaySales.filter(s => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const ventasTarjeta = todaySales.filter(s => s.paymentMethod === 'tarjeta').reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const ventasTransferencia = todaySales.filter(s => s.paymentMethod === 'transferencia').reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const ventasFiado = todaySales.filter(s => s.paymentMethod === 'fiado').reduce((sum, s) => sum + parseFloat(String(s.total)), 0);
  const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia + ventasFiado;

  const allGastos = await db.select().from(gastos);
  const todayGastos = allGastos.filter(g => g.fecha.toISOString().startsWith(today)).reduce((sum, g) => sum + parseFloat(String(g.monto)), 0);

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

export async function deleteCortes(corteIds: string[]): Promise<void> {
  await requirePermission('corte.create');
  if (corteIds.length === 0) return;
  corteIds.forEach(id => validateId(id, 'Corte ID'));
  await db.delete(cortesCaja).where(inArray(cortesCaja.id, corteIds));
}
