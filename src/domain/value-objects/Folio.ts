/**
 * Folio Value Object
 *
 * Represents a unique sale identifier following business rules:
 * - Format: YYYYMMDD-NNNN (date + sequential number)
 *
 * @example
 * const folio = Folio.generate('20260404', 42);
 * console.log(folio.toString()); // "20260404-0042"
 */
export class Folio {
  private constructor(private readonly value: string) {}

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Create a standard folio from date prefix and sequence number
   */
  static generate(datePrefix: string, sequenceNumber: number): Folio {
    const padded = String(sequenceNumber).padStart(4, '0');
    return new Folio(`${datePrefix}-${padded}`);
  }

  /**
   * Reconstruct from stored string value
   */
  static fromString(value: string): Folio {
    if (!value || typeof value !== 'string') {
      throw new Error('Folio: Invalid folio string');
    }
    return new Folio(value);
  }

  /**
   * Extract the date portion (for standard folios)
   */
  getDatePrefix(): string | null {
    const match = /^(\d{8})-(\d+)$/.exec(this.value);
    return match?.[1] ?? null;
  }

  /**
   * Extract the sequence number (for standard folios)
   */
  getSequenceNumber(): number | null {
    const match = /^(\d{8})-(\d+)$/.exec(this.value);
    return match?.[2] ? parseInt(match[2], 10) : null;
  }

  equals(other: Folio): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
