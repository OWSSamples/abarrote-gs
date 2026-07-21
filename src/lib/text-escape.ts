// ══════════════════════════════════════════════════════════════
// Text escaping helpers
// ══════════════════════════════════════════════════════════════
//
// Shared, dependency-free string-escaping utilities. Kept in one
// place so the (previously duplicated) escaping logic stays
// consistent across Telegram messages, transactional emails and
// spreadsheet/XML generation.

/**
 * Escapes the characters that would break Telegram HTML parse mode
 * (`&`, `<`, `>`). Empty/undefined input yields an empty string.
 */
export function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Escapes a string for safe interpolation into HTML content or
 * attributes (`&`, `<`, `>`, `"`, `'`).
 */
export function escapeHtml(value: string): string {
  return escapeTelegramHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Escapes a string for use inside XML text/attribute values
 * (`&`, `<`, `>`, `"`), as required by the SpreadsheetML/XLSX writers.
 */
export function escapeXml(value: string): string {
  return escapeTelegramHtml(value).replace(/"/g, '&quot;');
}
