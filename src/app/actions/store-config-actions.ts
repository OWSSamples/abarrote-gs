'use server';

import { requireOwner } from '@/lib/auth/guard';
import { db } from '@/db';
import { storeConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { StoreConfig } from '@/types';
import { DEFAULT_STORE_CONFIG } from '@/types';
import { numVal } from './_helpers';

// ==================== STORE CONFIG ====================

function isMissingColumnError(error: unknown): boolean {
  const msg = String(error);
  return (
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('inventory_general_columns') ||
    msg.includes('ticket_template') ||
    msg.includes('default_margin')
  );
}

function mapStoreConfigRow(
  row: Omit<StoreConfig, 'telegramToken' | 'telegramChatId' | 'printerIp' | 'cashDrawerPort' | 'scalePort' | 'logoUrl' | 'inventoryGeneralColumns' | 'defaultMargin' | 'ticketTemplateVenta' | 'ticketTemplateProveedor'> & {
    telegramToken?: string | null;
    telegramChatId?: string | null;
    printerIp?: string | null;
    cashDrawerPort?: string | null;
    scalePort?: string | null;
    logoUrl?: string | null;
    inventoryGeneralColumns?: string | null;
    defaultMargin?: string | null;
    ticketTemplateVenta?: string | null;
    ticketTemplateProveedor?: string | null;
    updatedAt?: Date;
  }
): StoreConfig {
  return {
    id: row.id,
    storeName: row.storeName,
    legalName: row.legalName,
    address: row.address,
    city: row.city,
    postalCode: row.postalCode,
    phone: row.phone,
    rfc: row.rfc,
    regimenFiscal: row.regimenFiscal,
    regimenDescription: row.regimenDescription,
    ivaRate: row.ivaRate,
    currency: row.currency,
    lowStockThreshold: row.lowStockThreshold,
    expirationWarningDays: row.expirationWarningDays,
    printReceipts: row.printReceipts,
    autoBackup: row.autoBackup,
    ticketFooter: row.ticketFooter,
    ticketServicePhone: row.ticketServicePhone,
    ticketVigencia: row.ticketVigencia,
    storeNumber: row.storeNumber,
    ticketBarcodeFormat: row.ticketBarcodeFormat,
    enableNotifications: row.enableNotifications,
    telegramToken: row.telegramToken ?? undefined,
    telegramChatId: row.telegramChatId ?? undefined,
    printerIp: row.printerIp ?? undefined,
    cashDrawerPort: row.cashDrawerPort ?? undefined,
    scalePort: row.scalePort ?? undefined,
    loyaltyEnabled: row.loyaltyEnabled,
    pointsPerPeso: row.pointsPerPeso,
    pointsValue: row.pointsValue,
    logoUrl: row.logoUrl ?? undefined,
    inventoryGeneralColumns: row.inventoryGeneralColumns ?? DEFAULT_STORE_CONFIG.inventoryGeneralColumns,
    defaultMargin: row.defaultMargin ?? DEFAULT_STORE_CONFIG.defaultMargin,
    ticketTemplateVenta: row.ticketTemplateVenta ?? undefined,
    ticketTemplateProveedor: row.ticketTemplateProveedor ?? undefined,
  };
}

export async function fetchStoreConfig(): Promise<StoreConfig> {
  try {
    const rows = await db.select().from(storeConfig).limit(1);
    if (rows.length === 0) {
      await db.insert(storeConfig).values({ id: 'main' });
      return DEFAULT_STORE_CONFIG;
    }
    return mapStoreConfigRow(rows[0]);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    const rows = await db.select({
      id: storeConfig.id,
      storeName: storeConfig.storeName,
      legalName: storeConfig.legalName,
      address: storeConfig.address,
      city: storeConfig.city,
      postalCode: storeConfig.postalCode,
      phone: storeConfig.phone,
      rfc: storeConfig.rfc,
      regimenFiscal: storeConfig.regimenFiscal,
      regimenDescription: storeConfig.regimenDescription,
      ivaRate: storeConfig.ivaRate,
      currency: storeConfig.currency,
      lowStockThreshold: storeConfig.lowStockThreshold,
      expirationWarningDays: storeConfig.expirationWarningDays,
      printReceipts: storeConfig.printReceipts,
      autoBackup: storeConfig.autoBackup,
      ticketFooter: storeConfig.ticketFooter,
      ticketServicePhone: storeConfig.ticketServicePhone,
      ticketVigencia: storeConfig.ticketVigencia,
      storeNumber: storeConfig.storeNumber,
      ticketBarcodeFormat: storeConfig.ticketBarcodeFormat,
      enableNotifications: storeConfig.enableNotifications,
      telegramToken: storeConfig.telegramToken,
      telegramChatId: storeConfig.telegramChatId,
      printerIp: storeConfig.printerIp,
      cashDrawerPort: storeConfig.cashDrawerPort,
      scalePort: storeConfig.scalePort,
      loyaltyEnabled: storeConfig.loyaltyEnabled,
      pointsPerPeso: storeConfig.pointsPerPeso,
      pointsValue: storeConfig.pointsValue,
      logoUrl: storeConfig.logoUrl,
      defaultMargin: storeConfig.defaultMargin,
      ticketTemplateVenta: storeConfig.ticketTemplateVenta,
      ticketTemplateProveedor: storeConfig.ticketTemplateProveedor,
    }).from(storeConfig).limit(1);

    if (rows.length === 0) {
      await db.insert(storeConfig).values({ id: 'main' });
      return DEFAULT_STORE_CONFIG;
    }
    return mapStoreConfigRow(rows[0]);
  }
}

export async function saveStoreConfig(data: Partial<StoreConfig>): Promise<StoreConfig> {
  await requireOwner();
  const { id, ...rest } = data;
  const persist = async (values: Partial<StoreConfig>) => {
    const result = await db.update(storeConfig).set({ ...values, updatedAt: new Date() }).where(eq(storeConfig.id, 'main'));
    if (!result.rowCount || result.rowCount === 0) {
      await db.insert(storeConfig).values({ id: 'main', ...values });
    }
  };

  try {
    await persist(rest);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    const { inventoryGeneralColumns: _ignored, ticketTemplateVenta: _tv, ticketTemplateProveedor: _tp, ...legacyRest } = rest;
    await persist(legacyRest);
  }

  return fetchStoreConfig();
}
