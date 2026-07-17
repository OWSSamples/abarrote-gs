const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_LIKE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function normalizeEmailAddress(value: string): string {
  return value.trim().replace(ZERO_WIDTH_CHARS, '').toLowerCase();
}

export function isValidEmailAddress(value: string): boolean {
  const normalized = normalizeEmailAddress(value);
  if (normalized.length === 0 || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    return false;
  }

  const [localPart, domain] = normalized.split('@');
  if (!localPart || !domain || localPart.length > 64 || domain.length > 253) {
    return false;
  }

  return domain
    .split('.')
    .every((label) => label.length > 0 && label.length <= 63 && !label.startsWith('-') && !label.endsWith('-'));
}

export function getEmailDomain(value: string): string | undefined {
  const normalized = normalizeEmailAddress(value);
  if (!isValidEmailAddress(normalized)) return undefined;
  return normalized.split('@')[1];
}

export function maskEmailAddress(value: string): string {
  const normalized = normalizeEmailAddress(value);
  const [localPart = '', domain = ''] = normalized.split('@');
  const [domainName = '', ...domainRest] = domain.split('.');
  const localPrefix = localPart[0] || '*';
  const domainPrefix = domainName[0] || '*';
  const suffix = domainRest.length ? `.${domainRest[domainRest.length - 1]}` : '';

  return `${localPrefix}***@${domainPrefix}***${suffix}`;
}

export function redactEmailLikeValues(value: string): string {
  return value.replace(EMAIL_LIKE_PATTERN, (match) => maskEmailAddress(match));
}

export async function hashIdentifierForLog(value: string): Promise<string> {
  const normalized = normalizeEmailAddress(value);
  if (!normalized) return '';

  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    return `len:${normalized.length}`;
  }

  try {
    const data = new TextEncoder().encode(normalized);
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .slice(0, 6)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `len:${normalized.length}`;
  }
}
