import { describe, it, expect } from 'vitest';
import { escapeTelegramHtml, escapeHtml, escapeXml } from '@/lib/text-escape';

describe('text-escape', () => {
  describe('escapeTelegramHtml', () => {
    it('escapes &, < and >', () => {
      expect(escapeTelegramHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    });

    it('escapes ampersand before angle brackets', () => {
      expect(escapeTelegramHtml('<&>')).toBe('&lt;&amp;&gt;');
    });

    it('leaves quotes untouched', () => {
      expect(escapeTelegramHtml(`"'`)).toBe(`"'`);
    });

    it('returns empty string for falsy input', () => {
      expect(escapeTelegramHtml('')).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('escapes &, <, >, " and \'', () => {
      expect(escapeHtml(`<a href="x">O'Brien & Co</a>`)).toBe(
        '&lt;a href=&quot;x&quot;&gt;O&#39;Brien &amp; Co&lt;/a&gt;',
      );
    });
  });

  describe('escapeXml', () => {
    it('escapes &, <, > and " but not \'', () => {
      expect(escapeXml(`Ventas "2024" & <más> 'ok'`)).toBe(
        `Ventas &quot;2024&quot; &amp; &lt;más&gt; 'ok'`,
      );
    });
  });
});
