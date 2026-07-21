import 'server-only';

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, saleItems, saleRecords } from '@/db/schema';
import { isNotDeleted } from '@/infrastructure/soft-delete';
import { getStoreConfigForStore } from '@/server/store-config-service';
import { isTenantActive } from '@/server/tenant-status-service';
import { escapeTelegramHtml } from '@/lib/text-escape';

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface DailyStoreReport {
  shouldSend: boolean;
  message: string;
  statusMessage: string;
}

export async function buildDailyStoreReport(storeId: string): Promise<DailyStoreReport> {
  if (!(await isTenantActive(storeId))) {
    return { shouldSend: false, message: '', statusMessage: 'Negocio no disponible' };
  }
  const config = await getStoreConfigForStore(storeId);
  if (!config?.enableNotifications || !config.telegramToken || !config.telegramChatId) {
    return { shouldSend: false, message: '', statusMessage: 'Notificaciones no configuradas' };
  }

  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });
  const todayStr = dateFormatter.format(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = dateFormatter.format(yesterdayDate);

  const [todaySales, yesterdaySales, lowStock, topProducts] = await Promise.all([
    db
      .select({
        total: sql<string>`coalesce(sum(${saleRecords.total}::numeric), 0)`,
        count: sql<string>`count(*)`,
        efectivo: sql<string>`coalesce(sum(case when ${saleRecords.paymentMethod} = 'efectivo' then ${saleRecords.total}::numeric else 0 end), 0)`,
        tarjeta: sql<string>`coalesce(sum(case when ${saleRecords.paymentMethod} = 'tarjeta' then ${saleRecords.total}::numeric else 0 end), 0)`,
        transferencia: sql<string>`coalesce(sum(case when ${saleRecords.paymentMethod} = 'transferencia' then ${saleRecords.total}::numeric else 0 end), 0)`,
      })
      .from(saleRecords)
      .where(and(eq(saleRecords.storeId, storeId), sql`${saleRecords.date}::date = ${todayStr}`)),
    db
      .select({ total: sql<string>`coalesce(sum(${saleRecords.total}::numeric), 0)` })
      .from(saleRecords)
      .where(and(eq(saleRecords.storeId, storeId), sql`${saleRecords.date}::date = ${yesterdayStr}`)),
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          isNotDeleted(products),
          sql`${products.currentStock}::numeric <= ${products.minStock}::numeric`,
        ),
      ),
    db
      .select({
        productName: saleItems.productName,
        qty: sql<string>`sum(${saleItems.quantity})`,
        revenue: sql<string>`sum(${saleItems.subtotal}::numeric)`,
      })
      .from(saleItems)
      .innerJoin(
        saleRecords,
        and(eq(saleRecords.id, saleItems.saleId), eq(saleRecords.storeId, saleItems.storeId)),
      )
      .where(
        and(
          eq(saleItems.storeId, storeId),
          eq(saleRecords.storeId, storeId),
          sql`${saleRecords.date}::date = ${todayStr}`,
        ),
      )
      .groupBy(saleItems.productName)
      .orderBy(desc(sql`sum(${saleItems.subtotal}::numeric)`))
      .limit(5),
  ]);

  const today = todaySales[0];
  const totalToday = numberValue(today?.total);
  const totalYesterday = numberValue(yesterdaySales[0]?.total);
  const difference = totalYesterday > 0 ? (((totalToday - totalYesterday) / totalYesterday) * 100).toFixed(1) : '0';
  const trend = numberValue(difference) > 0 ? 'ALZA' : numberValue(difference) < 0 ? 'BAJA' : 'SIN CAMBIO';
  const topList = topProducts
    .map(
      (product, index) =>
        `  ${index + 1}. ${escapeTelegramHtml(product.productName)} - ${numberValue(product.qty)} uds ($${numberValue(product.revenue).toFixed(0)})`,
    )
    .join('\n');
  const lowStockList = lowStock
    .slice(0, 5)
    .map((product) => `  ${escapeTelegramHtml(product.name)} - ${product.currentStock} uds`)
    .join('\n');

  const message = `<b>Reporte del dia - ${escapeTelegramHtml(config.storeName)}</b>
<b>Fecha:</b> ${todayStr}

<b>Ventas del dia:</b> $${totalToday.toFixed(2)}
<b>Vs ayer:</b> $${totalYesterday.toFixed(2)} (${trend} ${difference}%)
<b>Transacciones:</b> ${numberValue(today?.count)}

<b>Desglose:</b>
  Efectivo: $${numberValue(today?.efectivo).toFixed(2)}
  Tarjeta: $${numberValue(today?.tarjeta).toFixed(2)}
  Transferencia: $${numberValue(today?.transferencia).toFixed(2)}

<b>Top 5 productos:</b>
${topList || '  Sin ventas hoy'}

<b>Stock bajo (${lowStock.length}):</b>
${lowStockList || '  Todo en orden'}`;

  return { shouldSend: true, message, statusMessage: 'Reporte enviado' };
}
