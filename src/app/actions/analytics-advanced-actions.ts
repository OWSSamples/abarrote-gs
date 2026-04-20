'use server';

import { withLogging } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db';
import {
  products,
  saleRecords,
  saleItems,
  clientes,
  proveedores,
  pedidos,
  pedidoItems,
  cfdiRecords,
  auditLogs,
  gastos,
  devoluciones,
} from '@/db/schema';
import { eq, desc, sql, gte, and } from 'drizzle-orm';
import { numVal } from './_helpers';
import { sendNotification, escapeHTML } from './_notifications';
import { weeklyReportEvent } from './_notification-events';
import { fetchStoreConfig } from './store-config-actions';
import type {
  ABCAnalysis,
  ABCProduct,
  ABCClassification,
  ReorderSuggestion,
  RFMAnalysis,
  RFMCustomer,
  RFMSegment,
  ForecastProduct,
  CFDIRequest,
  CFDIRecord,
  InventoryAgingAnalysis,
  AgingProduct,
  AgingBucket,
  ProductMarginReport,
  ProductMarginRow,
} from '@/types';
import { logger } from '@/lib/logger';
import { isNotDeleted } from '@/infrastructure/soft-delete';
import {
  createPacProvider,
  isPacConfigured,
  type CfdiPacAuthType,
  type CfdiPacEnvironment,
  type CfdiPacProviderId,
  type PacRuntimeConfig,
} from '@/infrastructure/cfdi/pac-provider';

function buildPacRuntimeConfig(config: Awaited<ReturnType<typeof fetchStoreConfig>>): PacRuntimeConfig {
  return {
    provider: (config.cfdiPacProvider || 'none') as CfdiPacProviderId,
    environment: (config.cfdiPacEnvironment || 'sandbox') as CfdiPacEnvironment,
    authType: (config.cfdiPacAuthType || 'basic') as CfdiPacAuthType,
    apiUrl: config.cfdiPacApiUrl,
    apiKey: config.cfdiPacApiKey,
    apiSecret: config.cfdiPacApiSecret,
    cancelPath: config.cfdiPacCancelPath,
  };
}

// ==================== 1. ABC INVENTORY CLASSIFICATION ====================

async function _fetchABCAnalysis(periodDays = 30): Promise<ABCAnalysis> {
  await requirePermission('analytics.view');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Revenue per product in the period
  const revenueRows = await db
    .select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      sku: saleItems.sku,
      totalRevenue: sql<string>`coalesce(sum(${saleItems.subtotal}::numeric), 0)`,
      totalQuantity: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleId))
    .where(gte(saleRecords.date, sql`${cutoffStr}::timestamp`))
    .groupBy(saleItems.productId, saleItems.productName, saleItems.sku)
    .orderBy(desc(sql`sum(${saleItems.subtotal}::numeric)`));

  // Get current product data for stock/price info
  const allProducts = await db.select().from(products).where(isNotDeleted(products));
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  const totalRevenue = revenueRows.reduce((sum, r) => sum + numVal(r.totalRevenue), 0);

  // Build sorted list and calculate cumulative %
  let cumulative = 0;
  const abcProducts: ABCProduct[] = revenueRows.map((row) => {
    const revenue = numVal(row.totalRevenue);
    const pct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
    cumulative += pct;

    let classification: ABCClassification = 'C';
    if (cumulative <= 80) classification = 'A';
    else if (cumulative <= 95) classification = 'B';

    const prod = productMap.get(row.productId);

    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      category: prod?.category ?? '',
      totalRevenue: revenue,
      totalQuantity: numVal(row.totalQuantity),
      revenuePercentage: pct,
      cumulativePercentage: cumulative,
      classification,
      currentStock: prod ? numVal(String(prod.currentStock)) : 0,
      costPrice: prod ? numVal(prod.costPrice) : 0,
      unitPrice: prod ? numVal(prod.unitPrice) : 0,
    };
  });

  // Include products with zero sales as class C
  const soldIds = new Set(abcProducts.map((p) => p.productId));
  for (const prod of allProducts) {
    if (!soldIds.has(prod.id)) {
      abcProducts.push({
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        category: prod.category ?? '',
        totalRevenue: 0,
        totalQuantity: 0,
        revenuePercentage: 0,
        cumulativePercentage: 100,
        classification: 'C',
        currentStock: numVal(String(prod.currentStock)),
        costPrice: numVal(prod.costPrice),
        unitPrice: numVal(prod.unitPrice),
      });
    }
  }

  const summary = {
    A: { count: 0, revenueShare: 0, skuShare: 0 },
    B: { count: 0, revenueShare: 0, skuShare: 0 },
    C: { count: 0, revenueShare: 0, skuShare: 0 },
  };

  const total = abcProducts.length || 1;
  for (const p of abcProducts) {
    summary[p.classification].count++;
    summary[p.classification].revenueShare += p.revenuePercentage;
  }
  summary.A.skuShare = (summary.A.count / total) * 100;
  summary.B.skuShare = (summary.B.count / total) * 100;
  summary.C.skuShare = (summary.C.count / total) * 100;

  return { products: abcProducts, summary, totalRevenue, periodDays };
}

// ==================== 2. SMART REORDER SUGGESTIONS ====================

async function _fetchReorderSuggestions(): Promise<ReorderSuggestion[]> {
  await requirePermission('inventory.view');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Average daily sales per product (last 30 days)
  const salesVelocity = await db
    .select({
      productId: saleItems.productId,
      totalQty: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleId))
    .where(gte(saleRecords.date, sql`${cutoffStr}::timestamp`))
    .groupBy(saleItems.productId);

  const velocityMap = new Map(salesVelocity.map((v) => [v.productId, numVal(v.totalQty) / 30]));

  // Get all products and suppliers
  const allProducts = await db.select().from(products).where(isNotDeleted(products));
  const allProveedores = await db.select().from(proveedores).where(isNotDeleted(proveedores));

  // Build supplier lookup by category
  const supplierByCategory = new Map<string, string>();
  for (const prov of allProveedores) {
    if (prov.activo && prov.categorias) {
      for (const cat of prov.categorias) {
        if (!supplierByCategory.has(cat)) {
          supplierByCategory.set(cat, prov.nombre);
        }
      }
    }
  }

  const suggestions: ReorderSuggestion[] = [];

  for (const prod of allProducts) {
    const stock = numVal(String(prod.currentStock));
    const minStock = numVal(String(prod.minStock));
    const avgDaily = velocityMap.get(prod.id) ?? 0;
    const daysUntilStockout = avgDaily > 0 ? Math.floor(stock / avgDaily) : stock > 0 ? 999 : 0;

    // Only suggest if stock is at or below minimum, or will run out within 7 days
    if (stock > minStock && daysUntilStockout > 7) continue;

    // Suggest enough for 14 days of sales + buffer to reach minStock
    const targetDays = 14;
    const needed = Math.max(Math.ceil(avgDaily * targetDays) - stock, minStock - stock, 1);

    const costPrice = numVal(prod.costPrice);
    const urgency: ReorderSuggestion['urgency'] =
      stock === 0 ? 'critical' : daysUntilStockout <= 3 ? 'critical' : daysUntilStockout <= 7 ? 'warning' : 'normal';

    suggestions.push({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      currentStock: stock,
      minStock,
      avgDailySales: Math.round(avgDaily * 100) / 100,
      daysUntilStockout,
      suggestedQuantity: needed,
      estimatedCost: Math.round(costPrice * needed * 100) / 100,
      supplier: supplierByCategory.get(prod.category ?? '') ?? null,
      urgency,
    });
  }

  return suggestions.sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, normal: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || a.daysUntilStockout - b.daysUntilStockout;
  });
}

/**
 * Auto-generates a draft pedido from reorder suggestions for a given supplier.
 */
async function _createAutoReorderPedido(supplierName: string): Promise<{ id: string; itemCount: number }> {
  await requirePermission('pedidos.create');

  const suggestions = await fetchReorderSuggestions();
  const forSupplier = suggestions.filter((s) => s.supplier === supplierName);

  if (forSupplier.length === 0) {
    throw new Error(`No hay sugerencias de reorden para ${supplierName}`);
  }

  const id = `pedido-auto-${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(pedidos).values({
    id,
    proveedor: supplierName,
    notas: `Auto-generado por sistema de reorden inteligente (${forSupplier.length} productos)`,
    fecha: now,
    estado: 'pendiente',
  });

  for (const item of forSupplier) {
    await db.insert(pedidoItems).values({
      id: `pi-${crypto.randomUUID()}`,
      pedidoId: id,
      productId: item.productId,
      productName: item.productName,
      cantidad: item.suggestedQuantity,
    });
  }

  return { id, itemCount: forSupplier.length };
}

// ==================== 3. DAILY TELEGRAM REPORT ====================

async function _sendDailyTelegramReport(): Promise<{ sent: boolean; message: string }> {
  await requirePermission('reports.view');

  const config = await fetchStoreConfig();
  if (!config.enableNotifications || !config.telegramToken || !config.telegramChatId) {
    return { sent: false, message: 'Notificaciones no configuradas' };
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(yesterdayDate);

  // Parallel queries
  const [todaySales, yesterdaySales, lowStock, topProducts] = await Promise.all([
    db
      .select({
        total: sql<string>`coalesce(sum(total::numeric), 0)`,
        count: sql<string>`count(*)`,
        efectivo: sql<string>`coalesce(sum(case when ${saleRecords.paymentMethod} = 'efectivo' then total::numeric else 0 end), 0)`,
        tarjeta: sql<string>`coalesce(sum(case when ${saleRecords.paymentMethod} = 'tarjeta' then total::numeric else 0 end), 0)`,
        transferencia: sql<string>`coalesce(sum(case when ${saleRecords.paymentMethod} = 'transferencia' then total::numeric else 0 end), 0)`,
      })
      .from(saleRecords)
      .where(sql`date::date = ${todayStr}`),

    db
      .select({
        total: sql<string>`coalesce(sum(total::numeric), 0)`,
      })
      .from(saleRecords)
      .where(sql`date::date = ${yesterdayStr}`),

    db
      .select()
      .from(products)
      .where(and(isNotDeleted(products), sql`${products.currentStock}::numeric <= ${products.minStock}::numeric`)),

    db
      .select({
        productName: saleItems.productName,
        qty: sql<string>`sum(${saleItems.quantity})`,
        revenue: sql<string>`sum(${saleItems.subtotal}::numeric)`,
      })
      .from(saleItems)
      .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleId))
      .where(sql`${saleRecords.date}::date = ${todayStr}`)
      .groupBy(saleItems.productName)
      .orderBy(desc(sql`sum(${saleItems.subtotal}::numeric)`))
      .limit(5),
  ]);

  const today = todaySales[0];
  const totalHoy = numVal(today.total);
  const totalAyer = numVal(yesterdaySales[0].total);
  const diff = totalAyer > 0 ? (((totalHoy - totalAyer) / totalAyer) * 100).toFixed(1) : '0';
  const arrow = numVal(diff) > 0 ? '📈' : numVal(diff) < 0 ? '📉' : '➡️';

  const topProductsList = topProducts
    .map((p, i) => `  ${i + 1}. ${escapeHTML(p.productName)} — ${numVal(p.qty)} uds ($${numVal(p.revenue).toFixed(0)})`)
    .join('\n');

  const lowStockList = lowStock
    .slice(0, 5)
    .map((p) => `  ⚠️ ${escapeHTML(p.name)} — ${p.currentStock} uds`)
    .join('\n');

  const message = `<b>📊 Reporte del Día — ${escapeHTML(config.storeName)}</b>
<b>Fecha:</b> ${todayStr}

<b>💰 Ventas del día:</b> $${totalHoy.toFixed(2)}
<b>📊 Vs ayer:</b> $${totalAyer.toFixed(2)} (${arrow} ${diff}%)
<b>🧾 Transacciones:</b> ${numVal(today.count)}

<b>💳 Desglose:</b>
  Efectivo: $${numVal(today.efectivo).toFixed(2)}
  Tarjeta: $${numVal(today.tarjeta).toFixed(2)}
  Transferencia: $${numVal(today.transferencia).toFixed(2)}

<b>🏆 Top 5 Productos:</b>
${topProductsList || '  Sin ventas hoy'}

<b>📦 Stock Bajo (${lowStock.length}):</b>
${lowStockList || '  ✅ Todo en orden'}`;

  await sendNotification(message);
  return { sent: true, message: 'Reporte enviado' };
}

// ==================== 3b. WEEKLY TELEGRAM REPORT ====================

async function _sendWeeklyTelegramReport(): Promise<{ sent: boolean; message: string }> {
  await requirePermission('reports.view');

  const config = await fetchStoreConfig();
  if (!config.enableNotifications || !config.telegramToken || !config.telegramChatId) {
    return { sent: false, message: 'Notificaciones no configuradas' };
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const weekEnd = new Date(now);

  const weekStartStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(weekStart);
  const weekEndStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(weekEnd);

  // Previous week for comparison
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekStartStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(prevWeekStart);

  const [weekSales, prevWeekSales, topProducts, weekGastos, weekDevoluciones, lowStock] = await Promise.all([
    db
      .select({
        total: sql<string>`coalesce(sum(total::numeric), 0)`,
        count: sql<string>`count(*)`,
      })
      .from(saleRecords)
      .where(sql`date::date >= ${weekStartStr} and date::date < ${weekEndStr}`),

    db
      .select({
        total: sql<string>`coalesce(sum(total::numeric), 0)`,
      })
      .from(saleRecords)
      .where(sql`date::date >= ${prevWeekStartStr} and date::date < ${weekStartStr}`),

    db
      .select({
        productName: saleItems.productName,
        qty: sql<string>`sum(${saleItems.quantity})`,
        revenue: sql<string>`sum(${saleItems.subtotal}::numeric)`,
      })
      .from(saleItems)
      .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleId))
      .where(sql`${saleRecords.date}::date >= ${weekStartStr} and ${saleRecords.date}::date < ${weekEndStr}`)
      .groupBy(saleItems.productName)
      .orderBy(desc(sql`sum(${saleItems.subtotal}::numeric)`))
      .limit(5),

    db
      .select({
        total: sql<string>`coalesce(sum(monto::numeric), 0)`,
      })
      .from(gastos)
      .where(sql`fecha::date >= ${weekStartStr} and fecha::date < ${weekEndStr}`),

    db
      .select({
        total: sql<string>`coalesce(sum(monto_devuelto::numeric), 0)`,
        count: sql<string>`count(*)`,
      })
      .from(devoluciones)
      .where(sql`fecha::date >= ${weekStartStr} and fecha::date < ${weekEndStr}`),

    db
      .select()
      .from(products)
      .where(and(isNotDeleted(products), sql`${products.currentStock}::numeric <= ${products.minStock}::numeric`)),
  ]);

  const totalVentas = numVal(weekSales[0].total);
  const totalPrev = numVal(prevWeekSales[0].total);
  const diffPct = totalPrev > 0 ? ((totalVentas - totalPrev) / totalPrev) * 100 : 0;

  const weekRange = `${weekStartStr} — ${weekEndStr}`;

  const message = weeklyReportEvent({
    storeName: config.storeName,
    weekRange,
    totalVentas,
    totalTransacciones: numVal(weekSales[0].count),
    ventasVsSemanaAnterior: diffPct,
    topProducts: topProducts.map((p) => ({
      name: p.productName,
      qty: numVal(p.qty),
      revenue: numVal(p.revenue),
    })),
    totalGastos: numVal(weekGastos[0].total),
    totalDevoluciones: numVal(weekDevoluciones[0].total),
    devolucionCount: numVal(weekDevoluciones[0].count),
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.slice(0, 5).map((p) => ({ name: p.name, stock: Number(p.currentStock) })),
  });

  await sendNotification(message);
  return { sent: true, message: 'Reporte semanal enviado' };
}

// ==================== 4. CFDI / FACTURACIÓN ELECTRÓNICA ====================

/**
 * Generates a CFDI invoice by calling the configured PAC API.
 *
 * PAC credentials/provider are read from platform configuration (store_config),
 * so timbrado can run without local env variables.
 */
async function _generateCFDI(request: CFDIRequest): Promise<CFDIRecord> {
  await requirePermission('reports.export');

  // Validate RFC format (13 chars for persona moral, 12 for persona física)
  const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
  if (!rfcRegex.test(request.receptorRfc.toUpperCase())) {
    throw new Error('RFC del receptor tiene formato inválido');
  }

  // Fetch sale data
  const saleRows = await db.select().from(saleRecords).where(eq(saleRecords.id, request.saleId)).limit(1);

  if (saleRows.length === 0) {
    throw new Error('Venta no encontrada');
  }

  const sale = saleRows[0];
  const config = await fetchStoreConfig();

  // Fetch sale items
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, request.saleId));

  const pacConfig = buildPacRuntimeConfig(config);
  const pacProvider = createPacProvider(pacConfig);

  if (!isPacConfigured(pacConfig)) {
    logger.warn('CFDI PAC not configured from platform settings, generating local record only', {
      provider: pacConfig.provider,
    });

    // Create a local record without timbrado — persist to DB
    const record: CFDIRecord = {
      id: `cfdi-${crypto.randomUUID()}`,
      saleId: request.saleId,
      folio: sale.folio,
      uuid: 'PAC_NOT_CONFIGURED',
      receptorRfc: request.receptorRfc.toUpperCase(),
      receptorNombre: request.receptorNombre,
      total: numVal(sale.total),
      status: 'error',
      xmlUrl: '',
      pdfUrl: '',
      fechaTimbrado: '',
      createdAt: new Date().toISOString(),
    };

    await db.insert(cfdiRecords).values({
      id: record.id,
      saleId: record.saleId,
      folio: record.folio,
      uuid: record.uuid,
      receptorRfc: record.receptorRfc,
      receptorNombre: record.receptorNombre,
      total: String(record.total),
      status: record.status,
      xmlUrl: '',
      pdfUrl: '',
      fechaTimbrado: '',
    });

    return record;
  }

  // Build CFDI payload following SAT 4.0 schema
  const cfdiPayload = {
    Emisor: {
      Rfc: config.rfc,
      Nombre: config.legalName,
      RegimenFiscal: config.regimenFiscal,
    },
    Receptor: {
      Rfc: request.receptorRfc.toUpperCase(),
      Nombre: request.receptorNombre,
      RegimenFiscalReceptor: request.receptorRegimenFiscal,
      DomicilioFiscalReceptor: request.receptorDomicilioFiscal,
      UsoCFDI: request.usoCfdi,
    },
    Conceptos: items.map((item) => ({
      ClaveProdServ: '01010101', // Generic product key
      Cantidad: item.quantity,
      ClaveUnidad: 'H87', // Pieza
      Descripcion: item.productName,
      ValorUnitario: numVal(item.unitPrice),
      Importe: numVal(item.subtotal),
      ObjetoImp: '02', // Sí objeto de impuesto
      Traslados: [
        {
          Base: numVal(item.subtotal),
          Impuesto: '002', // IVA
          TipoFactor: 'Tasa',
          TasaOCuota: 0.16,
          Importe: numVal(item.subtotal) * 0.16,
        },
      ],
    })),
    Total: numVal(sale.total),
    SubTotal: numVal(sale.subtotal),
    Moneda: 'MXN',
    FormaPago:
      sale.paymentMethod === 'efectivo'
        ? '01'
        : sale.paymentMethod === 'tarjeta'
          ? '04'
          : sale.paymentMethod === 'transferencia'
            ? '03'
            : '99',
    MetodoPago: 'PUE', // Pago en Una sola Exhibición
    TipoDeComprobante: 'I', // Ingreso
  };

  try {
    const result = await pacProvider.timbrar(cfdiPayload);

    const record: CFDIRecord = {
      id: `cfdi-${crypto.randomUUID()}`,
      saleId: request.saleId,
      folio: sale.folio,
      uuid: result.uuid,
      receptorRfc: request.receptorRfc.toUpperCase(),
      receptorNombre: request.receptorNombre,
      total: numVal(sale.total),
      status: 'timbrada',
      xmlUrl: result.xmlUrl,
      pdfUrl: result.pdfUrl,
      fechaTimbrado: result.fechaTimbrado,
      createdAt: new Date().toISOString(),
    };

    // Persist the timbrada CFDI to DB
    await db.insert(cfdiRecords).values({
      id: record.id,
      saleId: record.saleId,
      folio: record.folio,
      uuid: record.uuid,
      receptorRfc: record.receptorRfc,
      receptorNombre: record.receptorNombre,
      total: String(record.total),
      status: record.status,
      xmlUrl: record.xmlUrl,
      pdfUrl: record.pdfUrl,
      fechaTimbrado: record.fechaTimbrado,
    });

    return record;
  } catch (error) {
    logger.error('CFDI generation failed', { error: error instanceof Error ? error.message : error });
    throw new Error('Error al generar el CFDI. Consulta los logs del servidor.');
  }
}

// ==================== 4b. CFDI CANCEL + LIST ====================

/**
 * List CFDI records for a sale or all recent.
 */
async function _fetchCFDIRecords(saleId?: string): Promise<CFDIRecord[]> {
  await requirePermission('reports.view');

  const query = saleId
    ? db.select().from(cfdiRecords).where(eq(cfdiRecords.saleId, saleId)).orderBy(desc(cfdiRecords.createdAt))
    : db.select().from(cfdiRecords).orderBy(desc(cfdiRecords.createdAt)).limit(100);

  const rows = await query;
  return rows.map((r) => ({
    id: r.id,
    saleId: r.saleId,
    folio: r.folio,
    uuid: r.uuid,
    receptorRfc: r.receptorRfc,
    receptorNombre: r.receptorNombre,
    total: Number(r.total),
    status: r.status as CFDIRecord['status'],
    xmlUrl: r.xmlUrl,
    pdfUrl: r.pdfUrl,
    fechaTimbrado: r.fechaTimbrado ?? '',
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Cancel a timbrada CFDI following SAT cancellation flow.
 * Motivos de cancelación SAT:
 * - '01': Comprobante emitido con errores con relación
 * - '02': Comprobante emitido con errores sin relación
 * - '03': No se llevó a cabo la operación
 * - '04': Operación nominativa relacionada en una factura global
 */
async function _cancelCFDI(
  cfdiId: string,
  reason: '01' | '02' | '03' | '04',
  relatedUuid?: string,
): Promise<{ success: boolean; message: string }> {
  const currentUser = await requirePermission('reports.export');

  const [record] = await db.select().from(cfdiRecords).where(eq(cfdiRecords.id, cfdiId)).limit(1);
  if (!record) throw new Error('CFDI no encontrado');
  if (record.status === 'cancelada') throw new Error('Este CFDI ya fue cancelado');
  if (record.status !== 'timbrada') throw new Error('Solo se pueden cancelar CFDIs timbrados');

  // Motivo 01 requires a related UUID
  if (reason === '01' && !relatedUuid) {
    throw new Error('Motivo 01 requiere el UUID del CFDI sustituto');
  }

  const config = await fetchStoreConfig();
  const pacConfig = buildPacRuntimeConfig(config);
  const pacProvider = createPacProvider(pacConfig);
  const now = new Date();

  if (!isPacConfigured(pacConfig)) {
    // No PAC configured — mark as cancelled locally
    await db
      .update(cfdiRecords)
      .set({
        status: 'cancelada',
        cancelReason: reason,
        cancelRelatedUuid: relatedUuid ?? null,
        cancelledAt: now,
      })
      .where(eq(cfdiRecords.id, cfdiId));

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      userEmail: currentUser.email ?? 'system',
      action: 'update',
      entity: 'cfdi',
      entityId: cfdiId,
      changes: { before: { status: 'timbrada' }, after: { status: 'cancelada', reason } },
      timestamp: now,
    });

    return { success: true, message: 'CFDI marcado como cancelado localmente (PAC no configurado)' };
  }

  try {
    const result = await pacProvider.cancelar(record.uuid, reason, relatedUuid);

    await db
      .update(cfdiRecords)
      .set({
        status: 'cancelada',
        cancelReason: reason,
        cancelRelatedUuid: relatedUuid ?? null,
        cancelAckUrl: result.acuse ?? '',
        cancelledAt: now,
      })
      .where(eq(cfdiRecords.id, cfdiId));

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      userEmail: currentUser.email ?? 'system',
      action: 'update',
      entity: 'cfdi',
      entityId: cfdiId,
      changes: { before: { status: 'timbrada' }, after: { status: 'cancelada', reason, uuid: record.uuid } },
      timestamp: now,
    });

    return { success: true, message: 'CFDI cancelado exitosamente ante el SAT' };
  } catch (error) {
    logger.error('CFDI cancel failed', { error: error instanceof Error ? error.message : error });
    throw new Error('Error al cancelar el CFDI. Consulta los logs del servidor.');
  }
}

// ==================== 5. RFM CUSTOMER ANALYSIS ======================================

async function _fetchRFMAnalysis(periodDays = 90): Promise<RFMAnalysis> {
  await requirePermission('analytics.view');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Get all clients
  const allClients = await db.select().from(clientes);

  // Per-client purchase data
  const _purchaseData = await db
    .select({
      clienteId: sql<string>`${saleRecords.cajero}`, // We need a client link; fallback to scanning fiadoTransactions if needed
      lastPurchase: sql<string>`max(${saleRecords.date})`,
      purchaseCount: sql<string>`count(*)`,
      totalSpent: sql<string>`coalesce(sum(${saleRecords.total}::numeric), 0)`,
    })
    .from(saleRecords)
    .where(gte(saleRecords.date, sql`${cutoffStr}::timestamp`))
    .groupBy(saleRecords.cajero);

  // Also bring in fiado transactions which are client-linked
  const { fiadoTransactions } = await import('@/db/schema');
  const fiadoData = await db
    .select({
      clienteId: fiadoTransactions.clienteId,
      lastPurchase: sql<string>`max(${fiadoTransactions.date})`,
      purchaseCount: sql<string>`count(*)`,
      totalSpent: sql<string>`coalesce(sum(case when ${fiadoTransactions.type} = 'fiado' then ${fiadoTransactions.amount}::numeric else 0 end), 0)`,
    })
    .from(fiadoTransactions)
    .where(gte(fiadoTransactions.date, sql`${cutoffStr}::timestamp`))
    .groupBy(fiadoTransactions.clienteId);

  const fiadoMap = new Map(fiadoData.map((f) => [f.clienteId, f]));

  const now = new Date();
  const rfmCustomers: RFMCustomer[] = [];

  // Compute raw RFM values
  for (const client of allClients) {
    const fiado = fiadoMap.get(client.id);

    const lastPurchaseStr = fiado?.lastPurchase || client.lastTransaction;
    const recency = lastPurchaseStr
      ? Math.floor((now.getTime() - new Date(lastPurchaseStr).getTime()) / (1000 * 60 * 60 * 24))
      : periodDays;

    const frequency = numVal(fiado?.purchaseCount ?? '0');
    const monetary = numVal(fiado?.totalSpent ?? '0') + numVal(String(client.balance));

    rfmCustomers.push({
      clienteId: client.id,
      clienteName: client.name,
      phone: client.phone ?? '',
      recency,
      frequency,
      monetary,
      rScore: 0,
      fScore: 0,
      mScore: 0,
      segment: 'lost',
      balance: numVal(String(client.balance)),
      points: numVal(String(client.points ?? 0)),
    });
  }

  if (rfmCustomers.length === 0) {
    return {
      customers: [],
      segments: Object.fromEntries(
        [
          'champions',
          'loyal',
          'potential_loyal',
          'recent',
          'promising',
          'needs_attention',
          'about_to_sleep',
          'at_risk',
          'lost',
        ].map((s) => [s, 0]),
      ) as Record<RFMSegment, number>,
      averageRecency: 0,
      averageFrequency: 0,
      averageMonetary: 0,
    };
  }

  // Quintile scoring (1-5) using sorted rank
  const scoreQuintile = (arr: number[], value: number, inverse = false): number => {
    const sorted = [...arr].sort((a, b) => a - b);
    const rank = sorted.filter((v) => v <= value).length / sorted.length;
    const score = Math.min(5, Math.max(1, Math.ceil(rank * 5)));
    return inverse ? 6 - score : score; // Recency is inverse: lower = better
  };

  const recencies = rfmCustomers.map((c) => c.recency);
  const frequencies = rfmCustomers.map((c) => c.frequency);
  const monetaries = rfmCustomers.map((c) => c.monetary);

  for (const c of rfmCustomers) {
    c.rScore = scoreQuintile(recencies, c.recency, true); // lower recency = higher score
    c.fScore = scoreQuintile(frequencies, c.frequency);
    c.mScore = scoreQuintile(monetaries, c.monetary);
    c.segment = classifyRFMSegment(c.rScore, c.fScore, c.mScore);
  }

  const segments = {} as Record<RFMSegment, number>;
  const allSegments: RFMSegment[] = [
    'champions',
    'loyal',
    'potential_loyal',
    'recent',
    'promising',
    'needs_attention',
    'about_to_sleep',
    'at_risk',
    'lost',
  ];
  for (const s of allSegments) segments[s] = 0;
  for (const c of rfmCustomers) segments[c.segment]++;

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

  return {
    customers: rfmCustomers.sort((a, b) => b.fScore + b.mScore + b.rScore - (a.fScore + a.mScore + a.rScore)),
    segments,
    averageRecency: Math.round(avg(recencies)),
    averageFrequency: Math.round(avg(frequencies) * 10) / 10,
    averageMonetary: Math.round(avg(monetaries)),
  };
}

function classifyRFMSegment(r: number, f: number, m: number): RFMSegment {
  const _rfm = r * 100 + f * 10 + m;
  if (r >= 4 && f >= 4 && m >= 4) return 'champions';
  if (r >= 3 && f >= 3 && m >= 3) return 'loyal';
  if (r >= 3 && f >= 2 && m >= 3) return 'potential_loyal';
  if (r >= 4 && f <= 2) return 'recent';
  if (r >= 3 && f <= 2) return 'promising';
  if (r === 2 && f >= 3) return 'needs_attention';
  if (r === 2 && f <= 2) return 'about_to_sleep';
  if (r === 1 && f >= 2) return 'at_risk';
  return 'lost';
}

// ==================== 6. DEMAND FORECASTING ====================

async function _fetchDemandForecast(): Promise<ForecastProduct[]> {
  await requirePermission('analytics.view');

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const cutoffStr = eightWeeksAgo.toISOString().split('T')[0];

  // Weekly sales per product for last 8 weeks
  const weeklyData = await db
    .select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      sku: saleItems.sku,
      weekNum: sql<string>`extract(week from ${saleRecords.date}::timestamp)`,
      yearNum: sql<string>`extract(year from ${saleRecords.date}::timestamp)`,
      totalQty: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleId))
    .where(gte(saleRecords.date, sql`${cutoffStr}::timestamp`))
    .groupBy(
      saleItems.productId,
      saleItems.productName,
      saleItems.sku,
      sql`extract(week from ${saleRecords.date}::timestamp)`,
      sql`extract(year from ${saleRecords.date}::timestamp)`,
    )
    .orderBy(
      saleItems.productId,
      sql`extract(year from ${saleRecords.date}::timestamp)`,
      sql`extract(week from ${saleRecords.date}::timestamp)`,
    );

  // Get all products for stock info
  const allProducts = await db.select().from(products).where(isNotDeleted(products));
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  // Group by product
  const byProduct = new Map<string, { name: string; sku: string; weeks: number[] }>();
  for (const row of weeklyData) {
    if (!byProduct.has(row.productId)) {
      byProduct.set(row.productId, { name: row.productName, sku: row.sku, weeks: [] });
    }
    byProduct.get(row.productId)!.weeks.push(numVal(row.totalQty));
  }

  const forecasts: ForecastProduct[] = [];

  for (const [productId, data] of byProduct) {
    const prod = productMap.get(productId);
    if (!prod) continue;

    const weeks = data.weeks;
    if (weeks.length < 2) continue; // Need at least 2 weeks of data

    // Pad to 8 weeks if less data
    while (weeks.length < 8) weeks.unshift(0);
    const last8 = weeks.slice(-8);

    // Weighted moving average (recent weeks weighted more)
    const weights = [1, 1, 1.5, 1.5, 2, 2, 3, 3]; // more weight on recent
    const weightedSum = last8.reduce((s, v, i) => s + v * weights[i], 0);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const weeklyAvg = weightedSum / totalWeight;

    const avgDailySales = weeklyAvg / 7;

    // Trend: compare last 4 weeks vs previous 4 weeks
    const firstHalf = last8.slice(0, 4).reduce((s, v) => s + v, 0) / 4;
    const secondHalf = last8.slice(4).reduce((s, v) => s + v, 0) / 4;
    const trendPct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : secondHalf > 0 ? 100 : 0;

    const trend: 'up' | 'down' | 'stable' = trendPct > 10 ? 'up' : trendPct < -10 ? 'down' : 'stable';

    // Apply trend to forecast
    const trendMultiplier = 1 + (trendPct / 100) * 0.5; // dampen the trend
    const forecastWeekly = weeklyAvg * trendMultiplier;

    const stock = numVal(String(prod.currentStock));
    const daysOfStock = avgDailySales > 0 ? Math.floor(stock / avgDailySales) : 999;

    // Confidence based on data consistency
    const stdDev = Math.sqrt(last8.reduce((s, v) => s + (v - weeklyAvg) ** 2, 0) / last8.length);
    const cv = weeklyAvg > 0 ? stdDev / weeklyAvg : 1;
    const confidence: 'high' | 'medium' | 'low' = cv < 0.3 ? 'high' : cv < 0.6 ? 'medium' : 'low';

    forecasts.push({
      productId,
      productName: data.name,
      sku: data.sku,
      category: prod.category ?? '',
      currentStock: stock,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      trend,
      trendPercentage: Math.round(trendPct * 10) / 10,
      forecastNextWeek: Math.round(forecastWeekly),
      forecastNextMonth: Math.round(forecastWeekly * 4),
      daysOfStock,
      confidence,
      historicalWeekly: last8,
    });
  }

  return forecasts.sort((a, b) => a.daysOfStock - b.daysOfStock);
}

// ==================== 8. INVENTORY AGING ANALYSIS ====================

async function _fetchInventoryAging(): Promise<InventoryAgingAnalysis> {
  await requirePermission('analytics.view');

  // All active products
  const allProducts = await db.select().from(products).where(isNotDeleted(products));

  // Last sale date per product
  const lastSaleRows = await db
    .select({
      productId: saleItems.productId,
      lastSaleDate: sql<string>`max(${saleRecords.date})`,
    })
    .from(saleItems)
    .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleId))
    .groupBy(saleItems.productId);

  const lastSaleMap = new Map(lastSaleRows.map((r) => [r.productId, r.lastSaleDate]));
  const now = Date.now();

  const agingProducts: AgingProduct[] = allProducts
    .filter((p) => p.currentStock > 0)
    .map((p) => {
      const stock = p.currentStock;
      const cost = numVal(p.costPrice as string);
      const lastSale = lastSaleMap.get(p.id);
      const daysSinceLastSale = lastSale ? Math.floor((now - new Date(lastSale).getTime()) / 86_400_000) : null;

      let bucket: AgingBucket = '0-30';
      const days = daysSinceLastSale ?? 999;
      if (days > 90) bucket = '90+';
      else if (days > 60) bucket = '60-90';
      else if (days > 30) bucket = '30-60';

      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku ?? '',
        category: p.category ?? 'Sin categoría',
        currentStock: stock,
        costPrice: cost,
        stockValue: stock * cost,
        daysSinceLastSale,
        bucket,
        expirationDate: p.expirationDate ? String(p.expirationDate) : null,
        isPerishable: p.isPerishable ?? false,
      };
    })
    .sort((a, b) => (b.daysSinceLastSale ?? 999) - (a.daysSinceLastSale ?? 999));

  const buckets: InventoryAgingAnalysis['buckets'] = {
    '0-30': { count: 0, value: 0, skuCount: 0 },
    '30-60': { count: 0, value: 0, skuCount: 0 },
    '60-90': { count: 0, value: 0, skuCount: 0 },
    '90+': { count: 0, value: 0, skuCount: 0 },
  };

  let totalStockValue = 0;
  let deadStockCount = 0;

  for (const p of agingProducts) {
    buckets[p.bucket].count += p.currentStock;
    buckets[p.bucket].value += p.stockValue;
    buckets[p.bucket].skuCount += 1;
    totalStockValue += p.stockValue;
    if ((p.daysSinceLastSale ?? 999) > 90) deadStockCount++;
  }

  return { products: agingProducts, buckets, totalStockValue, deadStockCount };
}

// ==================== 9. PRODUCT MARGIN REPORT ====================

async function _fetchProductMargins(periodDays = 30): Promise<ProductMarginReport> {
  await requirePermission('analytics.view');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Revenue + quantity per product in period
  const salesRows = await db
    .select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      sku: saleItems.sku,
      totalRevenue: sql<string>`coalesce(sum(${saleItems.subtotal}::numeric), 0)`,
      totalQuantity: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleId))
    .where(gte(saleRecords.date, sql`${cutoffStr}::timestamp`))
    .groupBy(saleItems.productId, saleItems.productName, saleItems.sku)
    .orderBy(desc(sql`sum(${saleItems.subtotal}::numeric)`));

  // Current product data (cost, category)
  const allProducts = await db.select().from(products).where(isNotDeleted(products));
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  const marginProducts: ProductMarginRow[] = [];
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;

  const catMap = new Map<string, { revenue: number; cost: number; profit: number }>();

  for (const row of salesRows) {
    const productData = productMap.get(row.productId);
    const costPrice = productData ? numVal(productData.costPrice) : 0;
    const unitPrice = productData ? numVal(productData.unitPrice) : 0;
    const revenue = numVal(row.totalRevenue);
    const qty = numVal(row.totalQuantity);
    const cost = costPrice * qty;
    const profit = revenue - cost;
    const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
    const category = productData?.category || 'Sin categoría';

    marginProducts.push({
      productId: row.productId,
      productName: row.productName ?? '',
      sku: row.sku ?? '',
      category,
      costPrice,
      unitPrice,
      marginPercent: Math.round(marginPercent * 10) / 10,
      unitsSold: qty,
      totalRevenue: revenue,
      totalCost: cost,
      totalProfit: profit,
    });

    totalRevenue += revenue;
    totalCost += cost;
    totalProfit += profit;

    const cat = catMap.get(category) ?? { revenue: 0, cost: 0, profit: 0 };
    cat.revenue += revenue;
    cat.cost += cost;
    cat.profit += profit;
    catMap.set(category, cat);
  }

  const byCategory = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.profit,
      margin: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    products: marginProducts,
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0,
    },
    byCategory,
  };
}

// ==================== EXPORTS WITH LOGGING ====================
export const fetchABCAnalysis = withLogging('analytics.fetchABCAnalysis', _fetchABCAnalysis);
export const fetchReorderSuggestions = withLogging('analytics.fetchReorderSuggestions', _fetchReorderSuggestions);
export const createAutoReorderPedido = withLogging('analytics.createAutoReorderPedido', _createAutoReorderPedido);
export const sendDailyTelegramReport = withLogging('analytics.sendDailyTelegramReport', _sendDailyTelegramReport);
export const sendWeeklyTelegramReport = withLogging('analytics.sendWeeklyTelegramReport', _sendWeeklyTelegramReport);
export const generateCFDI = withLogging('analytics.generateCFDI', _generateCFDI);
export const fetchCFDIRecords = withLogging('analytics.fetchCFDIRecords', _fetchCFDIRecords);
export const cancelCFDI = withLogging('analytics.cancelCFDI', _cancelCFDI);
export const fetchRFMAnalysis = withLogging('analytics.fetchRFMAnalysis', _fetchRFMAnalysis);
export const fetchDemandForecast = withLogging('analytics.fetchDemandForecast', _fetchDemandForecast);
export const fetchInventoryAging = withLogging('analytics.fetchInventoryAging', _fetchInventoryAging);
export const fetchProductMargins = withLogging('analytics.fetchProductMargins', _fetchProductMargins);
