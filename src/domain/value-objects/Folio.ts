/**
 * Folio Value Object
 * 
 * Represents a unique sale identifier following business rules:
 * - Format: YYYYMMDD-NNNN (date + sequential number)
 * - Offline folios: OFF-TIMESTAMP (temporary until synced)
 * 
 * @example
 * const folio = Folio.generate('20260404', 42);
 * console.log(folio.toString()); // "20260404-0042"
 */
export class Folio {
  private constructor(
    private readonly value: string,
    private readonly isOffline: boolean = false,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Create a standard folio from date prefix and sequence number
   */
  static generate(datePrefix: string, sequenceNumber: number): Folio {
    const padded = String(sequenceNumber).padStart(4, '0');
    return new Folio(`${datePrefix}-${padded}`, false);
  }

  /**
   * Create a temporary offline folio
   */
  static generateOffline(): Folio {
    return new Folio(`OFF-${Date.now()}`, true);
  }

  /**
   * Reconstruct from stored string value
   */
  static fromString(value: string): Folio {
    if (!value || typeof value !== 'string') {
      throw new Error('Folio: Invalid folio string');
    }
    const isOffline = value.startsWith('OFF-');
    return new Folio(value, isOffline);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Check if this is a temporary offline folio that needs syncing
   */
  isTemporary(): boolean {
    return this.isOffline;
  }

  /**
   * Extract the date portion (for standard folios)
   */
  getDatePrefix(): string | null {
    if (this.isOffline) return null;
    const parts = this.value.split('-');
    return parts[0] ?? null;
  }

  /**
   * Extract the sequence number (for standard folios)
   */
  getSequenceNumber(): number | null {
    if (this.isOffline) return null;
    const parts = this.value.split('-');
    return parts[1] ? parseInt(parts[1], 10) : null;
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
