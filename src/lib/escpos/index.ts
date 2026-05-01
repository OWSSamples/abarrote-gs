export { ThermalPrinter } from './thermal-printer';
export type { PrinterStatus, PrinterInfo } from './thermal-printer';
export { buildSaleTicket, buildCorteTicket, buildDrawerKick } from './ticket-builder';
export type { SaleTicketData, CorteTicketData, TicketItem } from './ticket-builder';
export {
  INIT,
  CUT_PARTIAL,
  CUT_FULL,
  DRAWER_KICK_PIN2,
  DRAWER_KICK_PIN5,
  encodeText,
  concatBytes,
  formatRow,
} from './commands';

/**
 * Resolve the drawer solenoid pin from the user-configurable
 * `cashDrawerPort` storeConfig field.
 *
 * Convention:
 * - Empty / unset / any port name → pin 2 (Epson, Star, Xprinter, Nextep std).
 * - Contains "5" or "pin5" / "pin 5" → pin 5 (Bematech, some Nextep variants).
 *
 * This lets users fix "drawer doesn't open" issues from the Hardware UI
 * without a database migration or code change.
 */
export function resolveDrawerPin(cashDrawerPort?: string | null): 2 | 5 {
  if (!cashDrawerPort) return 2;
  const v = cashDrawerPort.trim().toLowerCase();
  if (v === '5' || v === 'pin5' || v === 'pin 5' || v.includes('pin5') || v.includes('pin 5')) {
    return 5;
  }
  return 2;
}
