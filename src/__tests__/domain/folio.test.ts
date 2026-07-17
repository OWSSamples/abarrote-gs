import { describe, it, expect } from 'vitest';
import { Folio } from '@/domain/value-objects/Folio';

describe('Folio Value Object', () => {
  describe('generate()', () => {
    it('creates a folio with date prefix and zero-padded sequence', () => {
      const folio = Folio.generate('20260404', 42);
      expect(folio.toString()).toBe('20260404-0042');
    });

    it('pads single-digit sequence numbers', () => {
      const folio = Folio.generate('20260101', 1);
      expect(folio.toString()).toBe('20260101-0001');
    });

    it('handles sequence numbers above 9999', () => {
      const folio = Folio.generate('20260101', 12345);
      expect(folio.toString()).toBe('20260101-12345');
    });

  });

  describe('fromString()', () => {
    it('reconstructs a standard folio', () => {
      const folio = Folio.fromString('20260404-0042');
      expect(folio.toString()).toBe('20260404-0042');
    });

    it('throws on empty string', () => {
      expect(() => Folio.fromString('')).toThrow('Invalid folio string');
    });

    it('throws on null/undefined', () => {
      expect(() => Folio.fromString(null as unknown as string)).toThrow('Invalid folio string');
      expect(() => Folio.fromString(undefined as unknown as string)).toThrow('Invalid folio string');
    });
  });

  describe('getDatePrefix()', () => {
    it('extracts date prefix from standard folio', () => {
      const folio = Folio.generate('20260404', 1);
      expect(folio.getDatePrefix()).toBe('20260404');
    });

  });

  describe('getSequenceNumber()', () => {
    it('extracts sequence number from standard folio', () => {
      const folio = Folio.generate('20260404', 42);
      expect(folio.getSequenceNumber()).toBe(42);
    });

  });

  describe('equals()', () => {
    it('returns true for folios with same value', () => {
      const f1 = Folio.generate('20260404', 42);
      const f2 = Folio.fromString('20260404-0042');
      expect(f1.equals(f2)).toBe(true);
    });

    it('returns false for folios with different values', () => {
      const f1 = Folio.generate('20260404', 42);
      const f2 = Folio.generate('20260404', 43);
      expect(f1.equals(f2)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('toJSON returns the string value', () => {
      const folio = Folio.generate('20260404', 42);
      expect(folio.toJSON()).toBe('20260404-0042');
    });

    it('survives JSON round-trip via fromString', () => {
      const original = Folio.generate('20260404', 42);
      const json = JSON.stringify({ folio: original });
      const parsed = JSON.parse(json);
      const restored = Folio.fromString(parsed.folio);
      expect(original.equals(restored)).toBe(true);
    });
  });
});
