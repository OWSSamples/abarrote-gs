/**
 * Domain Layer - Clean Architecture
 * 
 * This module contains the core business logic of the POS system.
 * It has NO dependencies on infrastructure (DB, Redis, APIs).
 * 
 * Structure:
 * - entities/      → Business objects with identity (Product, Sale)
 * - value-objects/ → Immutable values without identity (Money, Quantity)
 * - repositories/  → Interfaces for persistence (implemented elsewhere)
 * - services/      → Stateless business logic that spans entities
 * 
 * Usage:
 * ```typescript
 * import { Money, Product, Sale, PricingService } from '@/domain';
 * 
 * const price = Money.fromPesos(100);
 * const iva = PricingService.calculateIva(price);
 * ```
 */

// Value Objects
export * from './value-objects';

// Entities
export * from './entities';

// Repository Interfaces
export * from './repositories';

// Domain Services
export * from './services';
