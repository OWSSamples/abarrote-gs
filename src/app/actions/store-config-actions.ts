'use server';

import { requireOwner } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { db } from '@/db';
import { storeConfig } from '@/db/schema';
import { eq, getTableColumns } from 'drizzle-orm';
import type { StoreConfig, TicketDesignConfig, CustomerDisplayMessageStyle } from '@/types';
import {
  DEFAULT_STORE_CONFIG,
  DEFAULT_TICKET_DESIGN,
  DEFAULT_TICKET_DESIGN_PROVEEDOR,
  DEFAULT_CUSTOMER_DISPLAY_MESSAGE_STYLE,
} from '@/types';
import { validateSchema, saveStoreConfigSchema } from '@/lib/validation/schemas';
import { cache } from '@/infrastructure/redis';
import { emitDomainEvent } from '@/domain/events';

// ==================== STORE CONFIG ====================

/** All valid column keys derived from the Drizzle schema — single source of truth. */
const ALL_DB_COLUMNS = new Set(Object.keys(getTableColumns(storeConfig)));
const DB_COLUMN_NAME_TO_KEY = (() => {
  const map = new Map<string, string>();
  const columns = getTableColumns(storeConfig) as Record<string, { name?: string }>;
  for (const [key, col] of Object.entries(columns)) {
    const dbName = col?.name;
    if (typeof dbName === 'string' && dbName.length > 0) {
      map.set(dbName, key);
    }
  }
  return map;
})();

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code ?? candidate.cause?.code;
}

function getErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const candidate = error as { message?: string; cause?: { message?: string } };
  return `${candidate.message ?? ''} ${candidate.cause?.message ?? ''}`.trim().toLowerCase();
}

function isUndefinedColumnError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === '42703') return true;

  const text = getErrorText(error);
  return text.includes('does not exist') || text.includes('undefined column');
}

function getMissingColumnName(error: unknown): string | undefined {
  const text = getErrorText(error);
  const quoted = text.match(/column\s+"([a-zA-Z0-9_]+)"\s+does not exist/);
  if (quoted?.[1]) return quoted[1];
  const unquoted = text.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/);
  return unquoted?.[1];
}

/** Core columns present since the initial migration (safe fallback for un-migrated DBs).
 * DO NOT add columns from later migrations here — this set must match the baseline DB.
 * The auto-prune mechanism handles any remaining mismatches gracefully. */
const CORE_DB_COLUMNS = new Set([
  'storeName',
  'legalName',
  'address',
  'city',
  'postalCode',
  'phone',
  'rfc',
  'regimenFiscal',
  'regimenDescription',
  'ivaRate',
  'pricesIncludeIva',
  'currency',
  'lowStockThreshold',
  'expirationWarningDays',
  'printReceipts',
  'autoBackup',
  'ticketFooter',
  'ticketServicePhone',
  'ticketVigencia',
  'storeNumber',
  'ticketBarcodeFormat',
  'enableNotifications',
  'telegramToken',
  'telegramChatId',
  'printerIp',
  'cashDrawerPort',
  'scalePort',
  'loyaltyEnabled',
  'pointsPerPeso',
  'pointsValue',
  'logoUrl',
  'customerDisplayEnabled',
  'customerDisplayWelcome',
  'customerDisplayFarewell',
  'customerDisplayPromoText',
  'customerDisplayPromoImage',
  'customerDisplayIdleAnimation',
  'customerDisplayTransitionSpeed',
  'customerDisplayPromoAnimation',
  'customerDisplayShowClock',
  'customerDisplayTheme',
  'customerDisplayIdleCarousel',
  'customerDisplayCarouselInterval',
  'customerDisplayLogo',
  'customerDisplayFontScale',
  'customerDisplayAutoReturnSec',
  'customerDisplayAccentColor',
  'customerDisplaySoundEnabled',
  'customerDisplayOrientation',
]);

function parseTicketDesign(
  raw: string | null | undefined,
  defaults: TicketDesignConfig = DEFAULT_TICKET_DESIGN,
): TicketDesignConfig {
  if (!raw) return { ...defaults };
  try {
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

function parseMessageStyle(raw: string | null | undefined): CustomerDisplayMessageStyle {
  const defaults = DEFAULT_CUSTOMER_DISPLAY_MESSAGE_STYLE;
  if (!raw)
    return {
      ...defaults,
      welcome: { ...defaults.welcome },
      farewell: { ...defaults.farewell },
      promo: { ...defaults.promo },
    };
  try {
    const parsed = JSON.parse(raw);
    return {
      welcome: { ...defaults.welcome, ...(parsed.welcome ?? {}) },
      farewell: { ...defaults.farewell, ...(parsed.farewell ?? {}) },
      promo: { ...defaults.promo, ...(parsed.promo ?? {}) },
    };
  } catch {
    return {
      ...defaults,
      welcome: { ...defaults.welcome },
      farewell: { ...defaults.farewell },
      promo: { ...defaults.promo },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStoreConfigRow(row: any): StoreConfig {
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
    cfdiPacProvider: row.cfdiPacProvider ?? DEFAULT_STORE_CONFIG.cfdiPacProvider,
    cfdiPacEnvironment: row.cfdiPacEnvironment ?? DEFAULT_STORE_CONFIG.cfdiPacEnvironment,
    cfdiPacAuthType: row.cfdiPacAuthType ?? DEFAULT_STORE_CONFIG.cfdiPacAuthType,
    cfdiPacApiUrl: row.cfdiPacApiUrl ?? DEFAULT_STORE_CONFIG.cfdiPacApiUrl,
    cfdiPacApiKey: row.cfdiPacApiKey ?? DEFAULT_STORE_CONFIG.cfdiPacApiKey,
    cfdiPacApiSecret: row.cfdiPacApiSecret ?? DEFAULT_STORE_CONFIG.cfdiPacApiSecret,
    cfdiPacCancelPath: row.cfdiPacCancelPath ?? DEFAULT_STORE_CONFIG.cfdiPacCancelPath,
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
    // Servicios provider
    serviciosProvider: row.serviciosProvider ?? 'local',
    serviciosApiKey: row.serviciosApiKey ?? undefined,
    serviciosApiSecret: row.serviciosApiSecret ?? undefined,
    serviciosSandbox: row.serviciosSandbox ?? true,
    customerDisplayEnabled: row.customerDisplayEnabled ?? DEFAULT_STORE_CONFIG.customerDisplayEnabled,
    customerDisplayWelcome: row.customerDisplayWelcome ?? DEFAULT_STORE_CONFIG.customerDisplayWelcome,
    customerDisplayFarewell: row.customerDisplayFarewell ?? DEFAULT_STORE_CONFIG.customerDisplayFarewell,
    customerDisplayPromoText: row.customerDisplayPromoText ?? DEFAULT_STORE_CONFIG.customerDisplayPromoText,
    customerDisplayPromoImage: row.customerDisplayPromoImage ?? DEFAULT_STORE_CONFIG.customerDisplayPromoImage,
    closeSystemTime: (row.closeSystemTime as string) ?? DEFAULT_STORE_CONFIG.closeSystemTime,
    autoCorteTime: (row.autoCorteTime as string) ?? DEFAULT_STORE_CONFIG.autoCorteTime,
    defaultStartingFund: Number(row.defaultStartingFund) || DEFAULT_STORE_CONFIG.defaultStartingFund,
    customerDisplayIdleAnimation: row.customerDisplayIdleAnimation ?? DEFAULT_STORE_CONFIG.customerDisplayIdleAnimation,
    customerDisplayTransitionSpeed:
      row.customerDisplayTransitionSpeed ?? DEFAULT_STORE_CONFIG.customerDisplayTransitionSpeed,
    customerDisplayPromoAnimation:
      row.customerDisplayPromoAnimation ?? DEFAULT_STORE_CONFIG.customerDisplayPromoAnimation,
    customerDisplayShowClock: row.customerDisplayShowClock ?? DEFAULT_STORE_CONFIG.customerDisplayShowClock,
    customerDisplayTheme: row.customerDisplayTheme ?? DEFAULT_STORE_CONFIG.customerDisplayTheme,
    customerDisplayIdleCarousel: row.customerDisplayIdleCarousel ?? DEFAULT_STORE_CONFIG.customerDisplayIdleCarousel,
    customerDisplayCarouselInterval:
      row.customerDisplayCarouselInterval ?? DEFAULT_STORE_CONFIG.customerDisplayCarouselInterval,
    customerDisplayLogo: row.customerDisplayLogo ?? DEFAULT_STORE_CONFIG.customerDisplayLogo,
    customerDisplayFontScale: row.customerDisplayFontScale ?? DEFAULT_STORE_CONFIG.customerDisplayFontScale,
    customerDisplayAutoReturnSec: row.customerDisplayAutoReturnSec ?? DEFAULT_STORE_CONFIG.customerDisplayAutoReturnSec,
    customerDisplayAccentColor: row.customerDisplayAccentColor ?? DEFAULT_STORE_CONFIG.customerDisplayAccentColor,
    customerDisplaySoundEnabled: row.customerDisplaySoundEnabled ?? DEFAULT_STORE_CONFIG.customerDisplaySoundEnabled,
    customerDisplayOrientation: row.customerDisplayOrientation ?? DEFAULT_STORE_CONFIG.customerDisplayOrientation,
    customerDisplayMessageStyle: parseMessageStyle(row.customerDisplayMessageStyle),
    ticketDesignVenta: parseTicketDesign(row.ticketDesignVenta),
    ticketDesignCorte: parseTicketDesign(row.ticketDesignCorte, {
      ...DEFAULT_TICKET_DESIGN,
      headerNote: 'CORTE DE CAJA',
      showItemCount: false,
      showDiscount: false,
      showUnitDetail: false,
    }),
    ticketDesignProveedor: parseTicketDesign(row.ticketDesignProveedor, DEFAULT_TICKET_DESIGN_PROVEEDOR),
    // Email (AWS SES)
    emailEnabled: row.emailEnabled ?? DEFAULT_STORE_CONFIG.emailEnabled,
    emailFrom: row.emailFrom ?? undefined,
    emailFromName: row.emailFromName ?? undefined,
    emailReplyTo: row.emailReplyTo ?? undefined,
    emailRecipients: row.emailRecipients ?? undefined,
    emailAccentColor: row.emailAccentColor ?? undefined,
    // Email — per-type toggles
    emailTicketEnabled: row.emailTicketEnabled ?? DEFAULT_STORE_CONFIG.emailTicketEnabled,
    emailDailyReportEnabled: row.emailDailyReportEnabled ?? DEFAULT_STORE_CONFIG.emailDailyReportEnabled,
    emailWeeklyReportEnabled: row.emailWeeklyReportEnabled ?? DEFAULT_STORE_CONFIG.emailWeeklyReportEnabled,
    emailStockAlertEnabled: row.emailStockAlertEnabled ?? DEFAULT_STORE_CONFIG.emailStockAlertEnabled,
    emailRefundAlertEnabled: row.emailRefundAlertEnabled ?? DEFAULT_STORE_CONFIG.emailRefundAlertEnabled,
    emailExpenseAlertEnabled: row.emailExpenseAlertEnabled ?? DEFAULT_STORE_CONFIG.emailExpenseAlertEnabled,
    emailSecurityAlertEnabled: row.emailSecurityAlertEnabled ?? DEFAULT_STORE_CONFIG.emailSecurityAlertEnabled,
    // Email — schedule & customization
    emailDailyReportTime: row.emailDailyReportTime ?? DEFAULT_STORE_CONFIG.emailDailyReportTime,
    emailWeeklyReportDay: row.emailWeeklyReportDay ?? DEFAULT_STORE_CONFIG.emailWeeklyReportDay,
    emailWeeklyReportTime: row.emailWeeklyReportTime ?? DEFAULT_STORE_CONFIG.emailWeeklyReportTime,
    emailFooterText: row.emailFooterText ?? undefined,
    emailSignature: row.emailSignature ?? undefined,
    // Email — premium features
    emailCcRecipients: row.emailCcRecipients ?? undefined,
    emailBccRecipients: row.emailBccRecipients ?? undefined,
    emailSubjectPrefix: row.emailSubjectPrefix ?? undefined,
    emailDigestEnabled: row.emailDigestEnabled ?? DEFAULT_STORE_CONFIG.emailDigestEnabled,
    emailDigestIntervalMinutes: row.emailDigestIntervalMinutes ?? DEFAULT_STORE_CONFIG.emailDigestIntervalMinutes,
    emailMaxAlertsPerHour: row.emailMaxAlertsPerHour ?? DEFAULT_STORE_CONFIG.emailMaxAlertsPerHour,
    emailAutoRetry: row.emailAutoRetry ?? DEFAULT_STORE_CONFIG.emailAutoRetry,
    emailMaxRetries: row.emailMaxRetries ?? DEFAULT_STORE_CONFIG.emailMaxRetries,
    emailAttachPdfTicket: row.emailAttachPdfTicket ?? DEFAULT_STORE_CONFIG.emailAttachPdfTicket,
    emailAttachExcelReport: row.emailAttachExcelReport ?? DEFAULT_STORE_CONFIG.emailAttachExcelReport,
    emailMonthlyReportEnabled: row.emailMonthlyReportEnabled ?? DEFAULT_STORE_CONFIG.emailMonthlyReportEnabled,
    emailMonthlyReportDay: row.emailMonthlyReportDay ?? DEFAULT_STORE_CONFIG.emailMonthlyReportDay,
    // AI / OpenRouter
    aiEnabled: row.aiEnabled ?? DEFAULT_STORE_CONFIG.aiEnabled,
    aiProvider: row.aiProvider ?? DEFAULT_STORE_CONFIG.aiProvider,
    aiApiKeyEnc: row.aiApiKeyEnc ?? undefined,
    aiModel: row.aiModel ?? DEFAULT_STORE_CONFIG.aiModel,
  };
}

async function _fetchStoreConfig(): Promise<StoreConfig> {
  // L1/L2 cache — store config rarely changes (5 min TTL)
  const cached = await cache.get<StoreConfig>('config:store');
  if (cached) return cached;

  try {
    const rows = await db.select().from(storeConfig).limit(1);
    if (rows.length === 0) {
      await db.insert(storeConfig).values({ id: 'main' });
      return DEFAULT_STORE_CONFIG;
    }
    const config = mapStoreConfigRow(rows[0]);
    await cache.set('config:store', config, { ttlMs: 300_000 }); // 5 min
    return config;
  } catch (error) {
    if (!isUndefinedColumnError(error)) throw error;

    // Fallback: progressively remove columns that don't exist in the DB.
    // Start with CORE_DB_COLUMNS (no PAC, no email, no AI columns).
    const allColumns = getTableColumns(storeConfig) as Record<string, unknown>;
    const candidateKeys = [...CORE_DB_COLUMNS].filter((k) => k in allColumns);
    let lastError: unknown = error;

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const selectObj: Record<string, unknown> = {};
        selectObj['id'] = storeConfig.id;
        const tableColumns = storeConfig as unknown as Record<string, unknown>;
        for (const key of candidateKeys) {
          if (key in allColumns) {
            selectObj[key] = tableColumns[key];
          }
        }
        const rows = await db
          .select(selectObj as Parameters<typeof db.select>[0])
          .from(storeConfig)
          .limit(1);

        if (rows.length === 0) {
          await db.insert(storeConfig).values({ id: 'main' });
          return DEFAULT_STORE_CONFIG;
        }
        return mapStoreConfigRow(rows[0]);
      } catch (retryError) {
        lastError = retryError;
        if (!isUndefinedColumnError(retryError)) throw retryError;
        const missingCol = getMissingColumnName(retryError);
        if (!missingCol) throw retryError;
        // Map DB column name (snake_case) to JS key (camelCase)
        const jsKey = DB_COLUMN_NAME_TO_KEY.get(missingCol);
        if (jsKey) {
          const idx = candidateKeys.indexOf(jsKey);
          if (idx !== -1) candidateKeys.splice(idx, 1);
          continue;
        }
        throw retryError;
      }
    }
    throw lastError;
  }
}

async function _saveStoreConfig(data: Partial<StoreConfig>): Promise<StoreConfig> {
  const user = await requireOwner();

  /** Build a dbValues object containing only keys present in the given column set. */
  const JSON_FIELDS = new Set([
    'ticketDesignVenta',
    'ticketDesignCorte',
    'ticketDesignProveedor',
    'customerDisplayMessageStyle',
  ]);

  // Pre-serialize JSON fields so Zod sees strings, not objects
  const serialized: Record<string, unknown> = { ...data };
  for (const key of JSON_FIELDS) {
    if (key in serialized && typeof serialized[key] === 'object' && serialized[key] !== null) {
      serialized[key] = JSON.stringify(serialized[key]);
    }
  }

  validateSchema(saveStoreConfigSchema, serialized, 'saveStoreConfig');

  const { id: _id, ...fields } = serialized;
  const buildDbValues = (allowedKeys: Set<string>): Record<string, unknown> => {
    const dbValues: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'id' || !allowedKeys.has(key)) continue;
      if (key === 'defaultStartingFund' && value !== undefined) {
        dbValues[key] = String(value);
      } else if (JSON_FIELDS.has(key) && typeof value === 'object' && value !== null) {
        dbValues[key] = JSON.stringify(value);
      } else {
        dbValues[key] = value;
      }
    }
    return dbValues;
  };

  const persist = async (dbValues: Record<string, unknown>) => {
    const result = await db.update(storeConfig).set(dbValues).where(eq(storeConfig.id, 'main'));
    if (!result.rowCount || result.rowCount === 0) {
      await db.insert(storeConfig).values({ id: 'main', ...dbValues });
    }
  };

  const persistWithAutoPrune = async (dbValues: Record<string, unknown>) => {
    const pruned = { ...dbValues };
    // Hard cap prevents endless loop on unexpected errors.
    for (let i = 0; i < 20; i++) {
      try {
        await persist(pruned);
        return;
      } catch (error) {
        if (!isUndefinedColumnError(error)) throw error;
        const missingDbColumn = getMissingColumnName(error);
        if (!missingDbColumn) throw error;
        const key = DB_COLUMN_NAME_TO_KEY.get(missingDbColumn);
        if (!key || !(key in pruned)) throw error;
        delete pruned[key];
      }
    }
    throw new Error('No fue posible guardar configuración: demasiadas columnas faltantes en la base de datos.');
  };

  try {
    await persistWithAutoPrune(buildDbValues(ALL_DB_COLUMNS));
  } catch (error) {
    if (!isUndefinedColumnError(error)) throw error;
    // Fallback: only use core columns guaranteed to exist since initial migration
    await persistWithAutoPrune(buildDbValues(CORE_DB_COLUMNS));
  }

  // Invalidate cached config so next read picks up changes
  await cache.invalidatePattern('config:');

  const changedKeys = Object.keys(fields);
  for (const key of changedKeys) {
    emitDomainEvent({
      type: 'config.changed',
      payload: { field: key, before: undefined, after: (fields as Record<string, unknown>)[key] },
      metadata: { userId: user.uid, userEmail: user.email ?? '' },
    });
  }

  return _fetchStoreConfig();
}

// ==================== EXPORTS ====================

export const fetchStoreConfig = withLogging('storeConfig.fetchStoreConfig', _fetchStoreConfig);
export const saveStoreConfig = withLogging('storeConfig.saveStoreConfig', _saveStoreConfig);
