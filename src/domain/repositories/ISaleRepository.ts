import { Sale } from '../entities/Sale';
import { Folio } from '../value-objects';

/**
 * Sale Repository Interface
 * 
 * Defines the contract for sale persistence.
 * Implementation lives in infrastructure layer (server actions).
 */
export interface ISaleRepository {
  /**
   * Find sale by ID
   */
  findById(id: string): Promise<Sale | null>;

  /**
   * Find sale by folio
   */
  findByFolio(folio: Folio): Promise<Sale | null>;

  /**
   * Find recent sales (with pagination)
   */
  findRecent(limit: number, offset?: number): Promise<Sale[]>;

  /**
   * Find sales by date range
   */
  findByDateRange(start: Date, end: Date): Promise<Sale[]>;

  /**
   * Find sales by cashier
   */
  findByCajero(cajero: string, limit?: number): Promise<Sale[]>;

  /**
   * Find sales by customer
   */
  findByCustomerId(customerId: string, limit?: number): Promise<Sale[]>;

  /**
   * Find sales by payment method
   */
  findByPaymentMethod(method: string, limit?: number): Promise<Sale[]>;

  /**
   * Save a sale (insert or update)
   */
  save(sale: Sale): Promise<Sale>;

  /**
   * Cancel a sale (updates status)
   */
  cancel(id: string, reason?: string): Promise<Sale | null>;

  /**
   * Generate next folio atomically
   * Returns the folio with date prefix and sequence
   */
  generateNextFolio(): Promise<Folio>;

  /**
   * Get sales summary for a date
   */
  getSummary(date: Date): Promise<{
    totalSales: number;
    totalAmount: number;
    averageTicket: number;
    cancellations: number;
  }>;
}
