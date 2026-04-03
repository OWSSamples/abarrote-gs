'use server';

import { requireOwner } from '@/lib/auth/guard';
import { db } from '@/db';
import { storeConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { StoreConfig } from '@/types';
import { DEFAULT_STORE_CONFIG } from '@/types';
import { numVal } from './_helpers';
import { validateSchema, saveStoreConfigSchema } from '@/lib/validation/schemas';

// ==================== STORE CONFIG ====================

function isMissingColumnError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('inventory_general_columns') ||
    msg.includes('ticket_template') ||
    msg.includes('default_margin') ||
    msg.includes('default_starting_fund') ||
    msg.includes('clabe_number') ||
    msg.includes('paypal_username') ||
    msg.includes('cobrar_qr_url') ||
    msg.includes('mp_device_id') ||
    msg.includes('mp_public_key') ||
    msg.includes('mp_enabled') ||
    msg.includes('conekta_enabled') ||
    msg.includes('conekta_public_key') ||
    msg.includes('stripe_enabled') ||
    msg.includes('stripe_public_key') ||
    msg.includes('clip_enabled') ||
    msg.includes('clip_api_key') ||
    msg.includes('clip_serial_number')
  );
}

function mapStoreConfigRow(
  row: Omit<StoreConfig, 'telegramToken' | 'telegramChatId' | 'printerIp' | 'cashDrawerPort' | 'scalePort' | 'logoUrl' | 'inventoryGeneralColumns' | 'defaultMargin' | 'ticketTemplateVenta' | 'ticketTemplateProveedor' | 'clabeNumber' | 'paypalUsername' | 'cobrarQrUrl' | 'mpDeviceId' | 'mpPublicKey' | 'mpEnabled' | 'closeSystemTime' | 'autoCorteTime' | 'defaultStartingFund'> & {
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
    clabeNumber?: string | null;
    paypalUsername?: string | null;
    cobrarQrUrl?: string | null;
    mpDeviceId?: string | null;
    mpPublicKey?: string | null;
    mpEnabled?: boolean | null;
    conektaEnabled?: boolean | null;
    conektaPublicKey?: string | null;
    stripeEnabled?: boolean | null;
    stripePublicKey?: string | null;
    clipEnabled?: boolean | null;
    clipApiKey?: string | null;
    clipSerialNumber?: string | null;
    customerDisplayEnabled?: boolean | null;
    customerDisplayWelcome?: string | null;
    customerDisplayFarewell?: string | null;
    customerDisplayPromoText?: string | null;
    customerDisplayPromoImage?: string | null;
    closeSystemTime?: string | null;
    autoCorteTime?: string | null;
    defaultStartingFund?: string | number | null;
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
    pricesIncludeIva: row.pricesIncludeIva ?? DEFAULT_STORE_CONFIG.pricesIncludeIva,
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
    clabeNumber: row.clabeNumber ?? undefined,
    paypalUsername: row.paypalUsername ?? undefined,
    cobrarQrUrl: row.cobrarQrUrl ?? undefined,
    mpDeviceId: row.mpDeviceId ?? undefined,
    mpPublicKey: row.mpPublicKey ?? undefined,
    mpEnabled: row.mpEnabled ?? DEFAULT_STORE_CONFIG.mpEnabled,
    conektaEnabled: row.conektaEnabled ?? DEFAULT_STORE_CONFIG.conektaEnabled,
    conektaPublicKey: row.conektaPublicKey ?? undefined,
    stripeEnabled: row.stripeEnabled ?? DEFAULT_STORE_CONFIG.stripeEnabled,
    stripePublicKey: row.stripePublicKey ?? undefined,
    clipEnabled: row.clipEnabled ?? DEFAULT_STORE_CONFIG.clipEnabled,
    clipApiKey: row.clipApiKey ?? undefined,
    clipSerialNumber: row.clipSerialNumber ?? undefined,
    customerDisplayEnabled: row.customerDisplayEnabled ?? DEFAULT_STORE_CONFIG.customerDisplayEnabled,
    customerDisplayWelcome: row.customerDisplayWelcome ?? DEFAULT_STORE_CONFIG.customerDisplayWelcome,
    customerDisplayFarewell: row.customerDisplayFarewell ?? DEFAULT_STORE_CONFIG.customerDisplayFarewell,
    customerDisplayPromoText: row.customerDisplayPromoText ?? DEFAULT_STORE_CONFIG.customerDisplayPromoText,
    customerDisplayPromoImage: row.customerDisplayPromoImage ?? DEFAULT_STORE_CONFIG.customerDisplayPromoImage,
    closeSystemTime: (row.closeSystemTime as string) ?? DEFAULT_STORE_CONFIG.closeSystemTime,
    autoCorteTime: (row.autoCorteTime as string) ?? DEFAULT_STORE_CONFIG.autoCorteTime,
    defaultStartingFund: Number(row.defaultStartingFund) || DEFAULT_STORE_CONFIG.defaultStartingFund,
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
      pricesIncludeIva: storeConfig.pricesIncludeIva,
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
  validateSchema(saveStoreConfigSchema, data, 'saveStoreConfig');
  const { id, ...rest } = data;
  const persist = async (values: Partial<StoreConfig>) => {
    // Strip fields that don't exist as DB columns
    const { defaultStartingFund, closeSystemTime: _cst, autoCorteTime: _act, ...rest } = values;
    const dbValues: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (defaultStartingFund !== undefined) {
      dbValues.defaultStartingFund = String(defaultStartingFund);
    }
    const result = await db.update(storeConfig).set(dbValues).where(eq(storeConfig.id, 'main'));
    if (!result.rowCount || result.rowCount === 0) {
      await db.insert(storeConfig).values({ id: 'main', ...dbValues });
    }
  };

  try {
    await persist(rest);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    // Fallback: Filter out all modern columns that might be missing in older DB tables
    const { 
      inventoryGeneralColumns: _ignored1, 
      ticketTemplateVenta: _ignored2, 
      ticketTemplateProveedor: _ignored3, 
      defaultMargin: _ignored4,
      defaultStartingFund: _ignored5,
      clabeNumber: _ignored6,
      paypalUsername: _ignored7,
      cobrarQrUrl: _ignored8,
      mpDeviceId: _ignored9,
      mpPublicKey: _ignored10,
      mpEnabled: _ignored11,
      conektaEnabled: _ignored12,
      conektaPublicKey: _ignored13,
      stripeEnabled: _ignored14,
      stripePublicKey: _ignored15,
      clipEnabled: _ignored16,
      clipApiKey: _ignored17,
      clipSerialNumber: _ignored18,
      ...legacyRest 
    } = rest;
    await persist(legacyRest);
  }

  return fetchStoreConfig();
}
