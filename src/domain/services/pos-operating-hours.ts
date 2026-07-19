export const SUPPORTED_BUSINESS_TIMEZONES = [
  'America/Mexico_City',
  'America/Cancun',
  'America/Monterrey',
  'America/Chihuahua',
  'America/Hermosillo',
  'America/Tijuana',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Los_Angeles',
] as const;

interface SalesScheduleConfig {
  salesScheduleEnabled: boolean;
  salesOpenTime: string;
  closeSystemTime: string;
  businessTimezone: string;
}

function formatTimeInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

export function resolveBusinessTimezone(timeZone: string): string {
  return (SUPPORTED_BUSINESS_TIMEZONES as readonly string[]).includes(timeZone)
    ? timeZone
    : 'America/Mexico_City';
}

export function getCurrentTimeInTimezone(date: Date, timeZone: string): string {
  return formatTimeInZone(date, resolveBusinessTimezone(timeZone));
}

export function getCurrentDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveBusinessTimezone(timeZone),
  }).format(date);
}

export function getPreviousIsoDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isTimeWithinOperatingWindow(currentTime: string, openTime: string, closeTime: string): boolean {
  if (openTime === closeTime) return true;
  if (openTime < closeTime) return currentTime >= openTime && currentTime < closeTime;
  return currentTime >= openTime || currentTime < closeTime;
}

export function evaluateSalesSchedule(config: SalesScheduleConfig, date = new Date()) {
  const currentTime = getCurrentTimeInTimezone(date, config.businessTimezone);
  const allowed =
    !config.salesScheduleEnabled ||
    isTimeWithinOperatingWindow(currentTime, config.salesOpenTime, config.closeSystemTime);

  return { allowed, currentTime };
}
