'use server';

import { requirePermission, requireAuth, validateId } from '@/lib/auth/guard';
import { db } from '@/db';
import { products, mermaRecords, inventoryAudits, inventoryAuditItems } from '@/db/schema';
import { eq, gte, lte, and, desc, sql } from 'drizzle-orm';
import type { Product, InventoryAlert, KPIData, MermaRecord } from '@/types';
import type { InventoryAudit, InventoryAuditItem } from '@/types';
import { numVal } from './_helpers';
import { sendNotification } from './_notifications';
import { fetchAllProducts } from './product-actions';

// ==================== INVENTORY ALERTS (computed) ====================

export async function fetchInventoryAlerts(): Promise<InventoryAlert[]> {
  await requireAuth();
  const allProducts = await fetchAllProducts();
  const now = new Date();
  const alerts: InventoryAlert[] = [];

  for (const product of allProducts) {
    const isLowStock = product.currentStock < product.minStock;
    const isExpiring = product.expirationDate
      ? new Date(product.expirationDate).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000
      : false;
    const isExpired = product.expirationDate
      ? new Date(product.expirationDate) < now
      : false;

    if (isLowStock || isExpiring || isExpired) {
      const severity: 'critical' | 'warning' | 'info' = isExpired
        ? 'critical'
        : isLowStock && product.currentStock <= product.minStock * 0.25
          ? 'critical'
          : isLowStock || isExpiring
            ? 'warning'
            : 'info';

      const alertType: 'low_stock' | 'expiration' | 'expired' = isExpired
        ? 'expired'
        : isLowStock
          ? 'low_stock'
          : 'expiration';

      let message = '';
      if (isExpired) message = 'Producto vencido';
      else if (isExpiring && product.expirationDate) {
        const days = Math.ceil((new Date(product.expirationDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        message = days <= 1 ? 'Vence mañana' : `Vence en ${days} días`;
      }
      if (isLowStock) message = message ? `${message} - Stock bajo` : 'Stock bajo';

      alerts.push({
        id: `alert-${product.id}`,
        product,
        alertType,
        severity,
        message,
        createdAt: now.toISOString(),
      });
    }
  }

  return alerts.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

// ==================== KPI (computed) ====================

export async function fetchKPIData(): Promise<KPIData> {
  await requireAuth();
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(yesterday);
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { saleRecords } = await import('@/db/schema');

  // Todas las queries son independientes — se ejecutan en paralelo
  const [
    todaySalesResult,
    yesterdaySalesResult,
    lowStockResult,
    expiringResult,
    mermaResult,
    inventoryResult,
  ] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(total::numeric), 0)` })
      .from(saleRecords)
      .where(sql`date::date = ${todayStr}`),
    db.select({ total: sql<string>`coalesce(sum(total::numeric), 0)` })
      .from(saleRecords)
      .where(sql`date::date = ${yesterdayStr}`),
    db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(sql`current_stock < min_stock`),
    db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          sql`expiration_date is not null`,
          lte(products.expirationDate, sevenDaysLater.toISOString().split('T')[0]),
          gte(products.expirationDate, todayStr)
        )
      ),
    db.select({ total: sql<string>`coalesce(sum(value::numeric), 0)` })
      .from(mermaRecords)
      .where(gte(mermaRecords.date, thirtyDaysAgo)),
    db.select({ total: sql<string>`coalesce(sum(unit_price::numeric * current_stock), 0)` })
      .from(products),
  ]);

  const dailySales = numVal(todaySalesResult[0]?.total);
  const yesterdaySales = numVal(yesterdaySalesResult[0]?.total);
  const dailySalesChange = yesterdaySales > 0
    ? Math.round(((dailySales - yesterdaySales) / yesterdaySales) * 100 * 10) / 10
    : 0;
  const lowStockProducts = Number(lowStockResult[0]?.count ?? 0);
  const expiringProducts = Number(expiringResult[0]?.count ?? 0);
  const totalMermaValue = numVal(mermaResult[0]?.total);
  const totalInventoryValue = numVal(inventoryResult[0]?.total);
  const mermaRate = totalInventoryValue > 0
    ? Math.round((totalMermaValue / totalInventoryValue) * 100 * 10) / 10
    : 0;

  return {
    dailySales,
    dailySalesChange,
    lowStockProducts,
    expiringProducts,
    mermaRate,
    mermaRateChange: 0,
  };
}

// ==================== MERMAS ====================

export async function fetchMermaRecords(): Promise<MermaRecord[]> {
  await requirePermission('inventory.edit');
  const rows = await db.select().from(mermaRecords).orderBy(desc(mermaRecords.date));
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    quantity: r.quantity,
    reason: r.reason as 'expiration' | 'damage' | 'spoilage' | 'other',
    date: r.date.toISOString(),
    value: numVal(r.value),
  }));
}

export async function createMerma(data: Omit<MermaRecord, 'id'>): Promise<MermaRecord> {
  await requirePermission('inventory.edit');
  validateId(data.productId, 'Product ID');
  const id = `merma-${Date.now()}`;
  await db.insert(mermaRecords).values({
    id,
    productId: data.productId,
    productName: data.productName,
    quantity: data.quantity,
    reason: data.reason,
    date: new Date(data.date),
    value: String(data.value),
  });

  await db
    .update(products)
    .set({
      currentStock: sql`greatest(0, current_stock - ${data.quantity})`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, data.productId));

  return { ...data, id };
}

// ==================== INVENTORY AUDITS ====================

export async function fetchInventoryAudits(): Promise<InventoryAudit[]> {
  await requirePermission('inventory.edit');
  const rows = await db.select().from(inventoryAudits).orderBy(desc(inventoryAudits.date));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date.toISOString(),
    auditor: r.auditor,
    status: r.status as 'draft' | 'completed',
    notes: r.notes,
  }));
}

export async function createInventoryAudit(data: {
  title: string;
  auditor: string;
  notes: string;
}): Promise<string> {
  await requirePermission('inventory.edit');
  const id = `audit-${Date.now()}`;
  await db.insert(inventoryAudits).values({
    id,
    title: data.title,
    auditor: data.auditor,
    notes: data.notes,
    date: new Date(),
    status: 'draft',
  });
  return id;
}

export async function getInventoryAudit(id: string): Promise<InventoryAudit | null> {
  await requirePermission('inventory.edit');
  validateId(id, 'Audit ID');
  const rows = await db.select().from(inventoryAudits).where(eq(inventoryAudits.id, id));
  if (rows.length === 0) return null;
  const audit = rows[0];
  const items = await db.select().from(inventoryAuditItems).where(eq(inventoryAuditItems.auditId, id));

  return {
    id: audit.id,
    title: audit.title,
    date: audit.date.toISOString(),
    auditor: audit.auditor,
    status: audit.status as 'draft' | 'completed',
    notes: audit.notes,
    items: items.map(i => ({
      id: i.id,
      auditId: i.auditId,
      productId: i.productId,
      productName: i.productName,
      expectedStock: i.expectedStock,
      countedStock: i.countedStock,
      difference: i.difference,
      adjustmentValue: numVal(i.adjustmentValue),
    })),
  };
}

export async function saveAuditItem(data: Omit<InventoryAuditItem, 'id'>): Promise<void> {
  await requirePermission('inventory.edit');
  validateId(data.auditId, 'Audit ID');
  validateId(data.productId, 'Product ID');
  const id = `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  await db.insert(inventoryAuditItems).values({
    id,
    auditId: data.auditId,
    productId: data.productId,
    productName: data.productName,
    expectedStock: data.expectedStock,
    countedStock: data.countedStock,
    difference: data.difference,
    adjustmentValue: String(data.adjustmentValue),
  });
}

export async function completeInventoryAudit(id: string): Promise<void> {
  await requirePermission('inventory.edit');
  validateId(id, 'Audit ID');
  const audit = await getInventoryAudit(id);
  if (!audit || audit.status === 'completed') return;

  for (const item of audit.items || []) {
    if (item.difference !== 0) {
      await db.update(products)
        .set({ currentStock: item.countedStock, updatedAt: new Date() })
        .where(eq(products.id, item.productId));

      if (item.difference < 0) {
        await createMerma({
          productId: item.productId,
          productName: item.productName,
          quantity: Math.abs(item.difference),
          reason: 'other',
          date: new Date().toISOString(),
          value: Math.abs(item.adjustmentValue),
        });
      }
    }
  }

  await db.update(inventoryAudits)
    .set({ status: 'completed' })
    .where(eq(inventoryAudits.id, id));

  await sendNotification(
    `<b>REPORTE DE AUDITORÍA FINALIZADA</b>\n\n` +
    `Título: ${escapeHTML(audit.title)}\n` +
    `Auditor: ${escapeHTML(audit.auditor)}\n` +
    `Resultado: Se revisaron ${audit.items?.length || 0} productos.`
  );
}

export async function sendStockReport(): Promise<void> {
  await requirePermission('inventory.view');
  const allProducts = await fetchAllProducts();
  const { escapeHTML } = await import('./_notifications');

  const stockList = allProducts
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => {
      const isLow = p.currentStock < p.minStock;
      const status = isLow ? ' [STOCK BAJO]' : '';
      return `• ${escapeHTML(p.name)} (${p.sku}): ${p.currentStock} ${p.unit}${status}`;
    })
    .join('\n');

  await sendNotification(
    `<b>REPORTE DE EXISTENCIAS DE INVENTARIO</b>\n\n` +
    `Total de productos: ${allProducts.length}\n` +
    `---------------------------------\n` +
    `${stockList}\n` +
    `---------------------------------\n` +
    `Fecha: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
  );
}
