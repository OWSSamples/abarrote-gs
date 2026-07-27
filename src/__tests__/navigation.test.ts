import { describe, it, expect } from 'vitest';
import { sectionToPath, SECTION_TO_PATH } from '@/lib/navigation';

describe('Navigation helpers', () => {
  describe('SECTION_TO_PATH', () => {
    it('maps overview to /dashboard', () => {
      expect(SECTION_TO_PATH['overview']).toBe('/dashboard');
    });

    it('maps all sales paths', () => {
      expect(SECTION_TO_PATH['sales']).toBe('/dashboard/sales');
      expect(SECTION_TO_PATH['sales-history']).toBe('/dashboard/sales');
      expect(SECTION_TO_PATH['sales-corte']).toBe('/dashboard/sales/corte');
      expect(SECTION_TO_PATH['pagos-mp']).toBe('/dashboard/sales/pagos-mp');
    });

    it('maps all product/inventory paths', () => {
      expect(SECTION_TO_PATH['catalog']).toBe('/dashboard/products');
      expect(SECTION_TO_PATH['inventory']).toBe('/dashboard/products/inventory');
      expect(SECTION_TO_PATH['inventory-priority']).toBe('/dashboard/products/priority');
      expect(SECTION_TO_PATH['mermas']).toBe('/dashboard/products/mermas');
      expect(SECTION_TO_PATH['pedidos']).toBe('/dashboard/products/pedidos');
    });

    it('maps customer paths', () => {
      expect(SECTION_TO_PATH['customers']).toBe('/dashboard/customers');
      expect(SECTION_TO_PATH['fiado']).toBe('/dashboard/customers/fiado');
    });

    it('maps finance paths', () => {
      expect(SECTION_TO_PATH['expenses']).toBe('/dashboard/finance/expenses');
      expect(SECTION_TO_PATH['suppliers']).toBe('/dashboard/finance/suppliers');
    });

    it('maps analytics paths', () => {
      expect(SECTION_TO_PATH['analytics']).toBe('/dashboard/analytics');
      expect(SECTION_TO_PATH['reports']).toBe('/dashboard/analytics/reports');
    });

    it('maps system paths', () => {
      expect(SECTION_TO_PATH['settings']).toBe('/dashboard/settings');
      expect(SECTION_TO_PATH['roles']).toBe('/dashboard/settings/roles');
    });

    it('maps "others" section paths', () => {
      expect(SECTION_TO_PATH['promotions']).toBe('/dashboard/others/promotions');
      expect(SECTION_TO_PATH['categories']).toBe('/dashboard/others/categories');
    });
  });

  describe('sectionToPath()', () => {
    it('returns correct path for known sections', () => {
      expect(sectionToPath('overview')).toBe('/dashboard');
      expect(sectionToPath('fiado')).toBe('/dashboard/customers/fiado');
      expect(sectionToPath('roles')).toBe('/dashboard/settings/roles');
    });

    it('returns /dashboard as fallback for unknown sections', () => {
      expect(sectionToPath('nonexistent')).toBe('/dashboard');
      expect(sectionToPath('')).toBe('/dashboard');
    });

    it('all paths start with /dashboard', () => {
      for (const path of Object.values(SECTION_TO_PATH)) {
        expect(path).toMatch(/^\/dashboard/);
      }
    });
  });
});
