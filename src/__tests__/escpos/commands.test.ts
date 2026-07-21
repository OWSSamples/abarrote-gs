import { describe, it, expect } from 'vitest';
import {
  ESC,
  GS,
  LF,
  INIT,
  LINE_FEED,
  feedLines,
  CUT_PARTIAL,
  CUT_FULL,
  ALIGN_LEFT,
  ALIGN_CENTER,
  ALIGN_RIGHT,
  BOLD_ON,
  BOLD_OFF,
  UNDERLINE_ON,
  UNDERLINE_OFF,
  DOUBLE_HEIGHT_ON,
  DOUBLE_HEIGHT_OFF,
  DOUBLE_SIZE_ON,
  DOUBLE_SIZE_OFF,
  NORMAL_SIZE,
  FONT_A,
  FONT_B,
  horizontalRule,
  doubleRule,
  DRAWER_KICK_PIN2,
  DRAWER_KICK_PIN5,
  barcodeCode128,
  encodeText,
  SET_CP858,
  concatBytes,
  formatRow,
} from '@/lib/escpos/commands';

describe('escpos/commands', () => {
  describe('control command constants', () => {
    it('exposes the standard control bytes', () => {
      expect(ESC).toBe(0x1b);
      expect(GS).toBe(0x1d);
      expect(LF).toBe(0x0a);
    });

    it('INIT resets the printer with ESC @', () => {
      expect(Array.from(INIT)).toEqual([ESC, 0x40]);
    });

    it('LINE_FEED is a single LF byte', () => {
      expect(Array.from(LINE_FEED)).toEqual([LF]);
    });

    it('cut commands use GS V with correct mode', () => {
      expect(Array.from(CUT_PARTIAL)).toEqual([GS, 0x56, 0x01]);
      expect(Array.from(CUT_FULL)).toEqual([GS, 0x56, 0x00]);
    });
  });

  describe('feedLines', () => {
    it('emits ESC d n for the requested line count', () => {
      expect(Array.from(feedLines(4))).toEqual([ESC, 0x64, 4]);
    });

    it('supports zero lines', () => {
      expect(Array.from(feedLines(0))).toEqual([ESC, 0x64, 0]);
    });
  });

  describe('text formatting constants', () => {
    it('alignment commands differ only in the final byte', () => {
      expect(Array.from(ALIGN_LEFT)).toEqual([ESC, 0x61, 0x00]);
      expect(Array.from(ALIGN_CENTER)).toEqual([ESC, 0x61, 0x01]);
      expect(Array.from(ALIGN_RIGHT)).toEqual([ESC, 0x61, 0x02]);
    });

    it('bold toggles via ESC E', () => {
      expect(Array.from(BOLD_ON)).toEqual([ESC, 0x45, 0x01]);
      expect(Array.from(BOLD_OFF)).toEqual([ESC, 0x45, 0x00]);
    });

    it('underline toggles via ESC -', () => {
      expect(Array.from(UNDERLINE_ON)).toEqual([ESC, 0x2d, 0x01]);
      expect(Array.from(UNDERLINE_OFF)).toEqual([ESC, 0x2d, 0x00]);
    });

    it('double height toggles via ESC !', () => {
      expect(Array.from(DOUBLE_HEIGHT_ON)).toEqual([ESC, 0x21, 0x10]);
      expect(Array.from(DOUBLE_HEIGHT_OFF)).toEqual([ESC, 0x21, 0x00]);
    });

    it('double size and normal size use GS !', () => {
      expect(Array.from(DOUBLE_SIZE_ON)).toEqual([GS, 0x21, 0x11]);
      expect(Array.from(DOUBLE_SIZE_OFF)).toEqual([GS, 0x21, 0x00]);
      expect(Array.from(NORMAL_SIZE)).toEqual([GS, 0x21, 0x00]);
    });

    it('font selection uses ESC M', () => {
      expect(Array.from(FONT_A)).toEqual([ESC, 0x4d, 0x00]);
      expect(Array.from(FONT_B)).toEqual([ESC, 0x4d, 0x01]);
    });
  });

  describe('horizontalRule', () => {
    it('defaults to 48 dashes', () => {
      const rule = horizontalRule();
      expect(rule.length).toBe(48);
      expect(Array.from(rule).every((b) => b === '-'.charCodeAt(0))).toBe(true);
    });

    it('respects a custom character and width', () => {
      const rule = horizontalRule('*', 10);
      expect(rule.length).toBe(10);
      expect(Array.from(rule).every((b) => b === '*'.charCodeAt(0))).toBe(true);
    });
  });

  describe('doubleRule', () => {
    it('produces a row of equals signs', () => {
      const rule = doubleRule(12);
      expect(rule.length).toBe(12);
      expect(Array.from(rule).every((b) => b === '='.charCodeAt(0))).toBe(true);
    });

    it('defaults to width 48', () => {
      expect(doubleRule().length).toBe(48);
    });
  });

  describe('cash drawer kicks', () => {
    it('differ only in the pin selector byte', () => {
      expect(Array.from(DRAWER_KICK_PIN2)).toEqual([ESC, 0x70, 0x00, 0x19, 0x78]);
      expect(Array.from(DRAWER_KICK_PIN5)).toEqual([ESC, 0x70, 0x01, 0x19, 0x78]);
    });
  });

  describe('barcodeCode128', () => {
    it('wraps the data with CODE128 set B and the correct length header', () => {
      const bytes = barcodeCode128('AB');
      const encoded = new TextEncoder().encode('AB');
      // 4 command headers (3 bytes each) + length byte + code set (2) + data
      expect(bytes.length).toBe(12 + 1 + 2 + encoded.length);
      // length byte = data length + 2 (for the code-set prefix)
      expect(bytes[12]).toBe(encoded.length + 2);
      // code set B prefix
      expect(bytes[13]).toBe(0x7b);
      expect(bytes[14]).toBe(0x42);
      // payload
      expect(bytes[15]).toBe('A'.charCodeAt(0));
      expect(bytes[16]).toBe('B'.charCodeAt(0));
    });

    it('starts with the GS h height command', () => {
      const bytes = barcodeCode128('123');
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([GS, 0x68, 0x50]);
    });
  });

  describe('encodeText', () => {
    it('passes ASCII through unchanged', () => {
      expect(Array.from(encodeText('Hi!'))).toEqual([0x48, 0x69, 0x21]);
    });

    it('maps accented Spanish characters to CP858 code points', () => {
      expect(Array.from(encodeText('á'))).toEqual([0xa0]);
      expect(Array.from(encodeText('é'))).toEqual([0x82]);
      expect(Array.from(encodeText('í'))).toEqual([0xa1]);
      expect(Array.from(encodeText('ó'))).toEqual([0xa2]);
      expect(Array.from(encodeText('ú'))).toEqual([0xa3]);
      expect(Array.from(encodeText('ñ'))).toEqual([0xa4]);
      expect(Array.from(encodeText('Ñ'))).toEqual([0xa5]);
      expect(Array.from(encodeText('¿'))).toEqual([0xa8]);
      expect(Array.from(encodeText('¡'))).toEqual([0xad]);
      expect(Array.from(encodeText('ü'))).toEqual([0x81]);
    });

    it('falls back to ? for unmapped non-ASCII characters', () => {
      expect(Array.from(encodeText('€'))).toEqual([0x3f]);
      expect(Array.from(encodeText('😀'))).toEqual([0x3f, 0x3f]);
    });

    it('returns an empty array for an empty string', () => {
      expect(encodeText('').length).toBe(0);
    });

    it('SET_CP858 selects the CP858 code page', () => {
      expect(Array.from(SET_CP858)).toEqual([ESC, 0x74, 0x13]);
    });
  });

  describe('concatBytes', () => {
    it('joins arrays preserving order', () => {
      const out = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])]);
      expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns an empty array when given no data', () => {
      expect(concatBytes([]).length).toBe(0);
      expect(concatBytes([new Uint8Array([]), new Uint8Array([])]).length).toBe(0);
    });
  });

  describe('formatRow', () => {
    it('pads between the left label and right value to fill the width', () => {
      const row = new TextDecoder().decode(formatRow('Total:', '$10.00', 20));
      expect(row.length).toBe(20);
      expect(row.startsWith('Total:')).toBe(true);
      expect(row.endsWith('$10.00')).toBe(true);
    });

    it('collapses to a single space when content exceeds the width', () => {
      const row = new TextDecoder().decode(formatRow('A very long label', 'value', 10));
      expect(row).toBe('A very long label value');
    });

    it('defaults to width 48', () => {
      const row = formatRow('L', 'R');
      expect(row.length).toBe(48);
    });
  });
});
