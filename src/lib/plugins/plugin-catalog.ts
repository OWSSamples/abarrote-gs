export type SystemPluginCategory = 'delivery' | 'services' | 'payments' | 'operations';
export type SystemPluginInstallMode = 'oauth' | 'managed' | 'external';
export type SystemPluginStatus = 'installed' | 'configuring' | 'disabled';

export interface SystemPluginDefinition {
  id: string;
  providerId?: string;
  name: string;
  vendor: string;
  category: SystemPluginCategory;
  summary: string;
  description: string;
  installMode: SystemPluginInstallMode;
  available: boolean;
  authorizePath?: string;
  docsUrl?: string;
  capabilities: string[];
  permissions: string[];
}

export const SYSTEM_PLUGIN_CATALOG: readonly SystemPluginDefinition[] = [
  {
    id: 'plugin.delivery.ubereats',
    providerId: 'ubereats',
    name: 'Uber Eats',
    vendor: 'Uber Direct / Uber Eats Marketplace',
    category: 'delivery',
    summary: 'Pedidos de marketplace conectados por OAuth y webhooks seguros.',
    description:
      'Recibe pedidos de Uber Eats, valida eventos, conserva auditoría por tienda y opera estados de preparación desde Kiosko.',
    installMode: 'oauth',
    available: true,
    authorizePath: '/api/integrations/uber/authorize',
    docsUrl: 'https://developer.uber.com/docs/eats',
    capabilities: ['Pedidos entrantes', 'Estados operativos', 'Webhook seguro', 'OAuth por tienda'],
    permissions: ['Leer pedidos del canal', 'Actualizar preparación', 'Guardar eventos de auditoría'],
  },
  {
    id: 'plugin.delivery.rappi',
    providerId: 'rappi',
    name: 'Rappi',
    vendor: 'Rappi Marketplace',
    category: 'delivery',
    summary: 'Pedidos y catálogo Rappi conectados como plugin por tienda.',
    description:
      'Habilita la recepción de pedidos Rappi y la operación de estados cuando el proveedor autorice la conexión.',
    installMode: 'managed',
    available: false,
    docsUrl: 'https://www.rappi.com.mx/',
    capabilities: ['Pedidos entrantes', 'Estados operativos', 'Sincronización futura de catálogo'],
    permissions: ['Leer pedidos Rappi', 'Actualizar estados de preparación'],
  },
  {
    id: 'plugin.servicios.turecarga',
    providerId: 'turecarga',
    name: 'TuRecarga',
    vendor: 'TuRecarga',
    category: 'services',
    summary: 'Recargas y pagos de servicios como plugin operativo.',
    description:
      'Activa recargas, CFE, telefonía e internet solo cuando el plugin esté instalado y conectado para el negocio.',
    installMode: 'managed',
    available: false,
    capabilities: ['Recargas telefónicas', 'Pago de servicios', 'Webhook de estado'],
    permissions: ['Procesar transacciones', 'Consultar estado del proveedor'],
  },
  {
    id: 'plugin.servicios.infopago',
    providerId: 'infopago',
    name: 'Infopago',
    vendor: 'Infopago',
    category: 'services',
    summary: 'Agregador de pagos de servicios como plugin del sistema.',
    description:
      'Permite operar servicios externos desde Kiosko únicamente cuando el plugin esté instalado por tienda.',
    installMode: 'managed',
    available: false,
    capabilities: ['Catálogo de servicios', 'Procesamiento externo', 'Auditoría por tienda'],
    permissions: ['Procesar transacciones', 'Consultar servicios soportados'],
  },
  {
    id: 'plugin.servicios.billpocket',
    providerId: 'billpocket',
    name: 'Billpocket Servicios',
    vendor: 'Billpocket',
    category: 'services',
    summary: 'Servicios externos gestionados como plugin aislado.',
    description:
      'Se habilita por negocio y deja de estar disponible si el plugin no está instalado o configurado.',
    installMode: 'managed',
    available: false,
    capabilities: ['Recargas', 'Pagos de servicio', 'Cancelaciones de proveedor'],
    permissions: ['Procesar transacciones', 'Recibir confirmaciones externas'],
  },
];

export function getSystemPlugin(pluginId: string): SystemPluginDefinition | null {
  return SYSTEM_PLUGIN_CATALOG.find((plugin) => plugin.id === pluginId) ?? null;
}
