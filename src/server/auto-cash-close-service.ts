import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cortesCaja, gastos, saleRecords } from '@/db/schema';
import { withLock } from '@/infrastructure/redis';
import { getStoreConfigForStore } from '@/server/store-config-service';
import {
  getCurrentDateInTimezone,
  getCurrentTimeInTimezone,
  getPreviousIsoDate,
  resolveBusinessTimezone,
} from '@/domain/services/pos-operating-hours';

interface AutoCashCloseConfig {
  autoCorteEnabled: boolean;
  autoCorteTime: string;
  salesOpenTime: string;
  businessTimezone: string;
  defaultStartingFund: number;
}

export type AutoCashCloseResult = 'disabled' | 'not_due' | 'already_closed' | 'no_sales' | 'created';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const CASH_METHODS = ['efectivo'];
const CARD_METHODS = [
  'tarjeta',
  'tarjeta_web',
  'tarjeta_manual',
  'oxxo_conekta',
  'oxxo_stripe',
  'tarjeta_clip',
  'clip_terminal',
];
const TRANSFER_METHODS = [
  'transferencia',
  'spei',
  'spei_conekta',
  'spei_stripe',
  'paypal',
  'qr_cobro',
  'puntos',
];

function sumPaymentMethods(rows: (typeof saleRecords.$inferSelect)[], methods: readonly string[]): number {
  const accepted = new Set(methods);
  return rows
    .filter((sale) => accepted.has(sale.paymentMethod))
    .reduce((total, sale) => total + numeric(sale.total), 0);
}

export async function runAutoCashCloseForStore(
  storeId: string,
  suppliedConfig?: AutoCashCloseConfig,
): Promise<AutoCashCloseResult> {
  const storedConfig = suppliedConfig ?? (await getStoreConfigForStore(storeId));
  if (!storedConfig?.autoCorteEnabled) return 'disabled';

  const businessTimezone = resolveBusinessTimezone(storedConfig.businessTimezone);
  const now = new Date();
  const currentTime = getCurrentTimeInTimezone(now, businessTimezone);
  if (currentTime < storedConfig.autoCorteTime) return 'not_due';

  const localDate = getCurrentDateInTimezone(now, businessTimezone);
  const businessDate =
    storedConfig.autoCorteTime < storedConfig.salesOpenTime ? getPreviousIsoDate(localDate) : localDate;
  return withLock(
    `corte:auto:${storeId}:${businessDate}`,
    async () => {
      const [existingClose] = await db
        .select({ id: cortesCaja.id })
        .from(cortesCaja)
        .where(
          and(
            eq(cortesCaja.storeId, storeId),
            eq(cortesCaja.businessDate, businessDate),
          ),
        )
        .limit(1);
      if (existingClose) return 'already_closed';

      const sales = await db
        .select()
        .from(saleRecords)
        .where(
          and(
            eq(saleRecords.storeId, storeId),
            sql`(${saleRecords.date} AT TIME ZONE 'UTC' AT TIME ZONE ${businessTimezone})::date = ${businessDate}::date`,
            sql`${saleRecords.status} != 'cancelada'`,
          ),
        );
      if (sales.length === 0) return 'no_sales';

      const expenses = await db
        .select({ amount: gastos.monto })
        .from(gastos)
        .where(
          and(
            eq(gastos.storeId, storeId),
            sql`(${gastos.fecha} AT TIME ZONE 'UTC' AT TIME ZONE ${businessTimezone})::date = ${businessDate}::date`,
          ),
        );

      const cash = sumPaymentMethods(sales, CASH_METHODS);
      const card = sumPaymentMethods(sales, CARD_METHODS);
      const transfer = sumPaymentMethods(sales, TRANSFER_METHODS);
      const credit = sumPaymentMethods(sales, ['fiado']);
      const total = cash + card + transfer + credit;
      const expenseTotal = expenses.reduce((sum, expense) => sum + numeric(expense.amount), 0);
      const startingFund = numeric(storedConfig.defaultStartingFund);
      const expectedCash = startingFund + cash - expenseTotal;

      await db.insert(cortesCaja).values({
        id: `corte-${crypto.randomUUID()}`,
        fecha: now,
        businessDate,
        cajero: 'Sistema (automático)',
        ventasEfectivo: String(cash),
        ventasTarjeta: String(card),
        ventasTransferencia: String(transfer),
        ventasFiado: String(credit),
        totalVentas: String(total),
        totalTransacciones: sales.length,
        efectivoEsperado: String(expectedCash),
        efectivoContado: String(expectedCash),
        diferencia: '0',
        fondoInicial: String(startingFund),
        gastosDelDia: String(expenseTotal),
        notas: `Corte automático del día operativo ${businessDate}, programado a las ${storedConfig.autoCorteTime}`,
        status: 'cerrado',
        storeId,
      });

      return 'created';
    },
    { ttlMs: 15_000, waitMs: 2_000 },
  );
}
