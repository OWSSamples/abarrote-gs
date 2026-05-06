/** Maps old section keys (used by SidebarNav, CustomTopBar) to App Router paths */
export const SECTION_TO_PATH: Record<string, string> = {
  overview: '/dashboard',
  sales: '/dashboard/sales',
  'sales-history': '/dashboard/sales',
  'sales-corte': '/dashboard/sales/corte',
  'pagos-mp': '/dashboard/sales/pagos-mp',
  catalog: '/dashboard/products',
  inventory: '/dashboard/products/inventory',
  'inventory-priority': '/dashboard/products/priority',
  'inventory-audit': '/dashboard/products/audit',
  mermas: '/dashboard/products/mermas',
  pedidos: '/dashboard/products/pedidos',
  customers: '/dashboard/customers',
  fiado: '/dashboard/customers/fiado',
  expenses: '/dashboard/finance/expenses',
  suppliers: '/dashboard/finance/suppliers',
  analytics: '/dashboard/analytics',
  reports: '/dashboard/analytics/reports',
  settings: '/dashboard/settings',
  roles: '/dashboard/settings/roles',
  notifications: '/dashboard/notifications',
  promotions: '/dashboard/others/promotions',
  categories: '/dashboard/others/categories',
  servicios: '/dashboard/others/servicios',
};

/** Converts a section key to its corresponding URL path */
export function sectionToPath(section: string): string {
  return SECTION_TO_PATH[section] || '/dashboard';
}
