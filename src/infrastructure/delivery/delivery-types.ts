/**
 * Delivery Domain Types
 *
 * Este archivo es el CONTRATO del módulo de delivery.
 * Todos los providers (Rappi, Uber Eats, futuros) deben
 * normalizar sus datos a estas interfaces.
 *
 * Diseñado para extracción a microservicio: no importa nada
 * de Next.js ni de la DB. Solo tipos puros.
 */

// ══════════════════════════════════════════════════════════════
// Enums
// ══════════════════════════════════════════════════════════════

export type DeliveryProvider = 'rappi' | 'ubereats';

export type DeliveryOrderStatus =
  | 'pending'      // Recibido, esperando aceptación del tendero
  | 'accepted'     // Tendero aceptó
  | 'preparing'    // En preparación
  | 'ready'        // Listo para recoger
  | 'picked_up'    // Repartidor lo tomó
  | 'delivered'    // Entregado al cliente
  | 'cancelled'    // Cancelado (por cualquier parte)
  | 'rejected';    // Rechazado por el tendero

export type DeliveryPaymentMethod =
  | 'online'       // Pagado en la app
  | 'cash'         // Pago en efectivo al repartidor
  | 'card_on_delivery'; // Tarjeta al repartidor

// ══════════════════════════════════════════════════════════════
// Canonical Order (formato normalizado, independiente del provider)
// ══════════════════════════════════════════════════════════════

export interface DeliveryOrderItem {
  externalId: string;        // ID del item en el provider
  name: string;              // Nombre del producto
  quantity: number;
  unitPrice: number;         // En MXN
  subtotal: number;
  notes?: string;            // Instrucciones especiales del cliente
  modifiers?: DeliveryModifier[];
}

export interface DeliveryModifier {
  name: string;
  price: number;
}

export interface DeliveryAddress {
  street?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
  references?: string;
  lat?: number;
  lng?: number;
}

export interface DeliveryCustomer {
  name: string;
  phone?: string;
  address: DeliveryAddress;
}

export interface DeliveryOrder {
  /** ID único en Kiosko (UUID generado al recibir) */
  id: string;
  /** ID original del provider (Rappi order_id, Uber Eats order_id) */
  externalId: string;
  provider: DeliveryProvider;
  storeId: string;
  status: DeliveryOrderStatus;
  customer: DeliveryCustomer;
  items: DeliveryOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: DeliveryPaymentMethod;
  /** Tiempo estimado de preparación en minutos */
  estimatedPrepMinutes?: number;
  notes?: string;
  /** Payload crudo del provider, para auditoría */
  rawPayload: Record<string, unknown>;
  receivedAt: Date;
  acceptedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

// ══════════════════════════════════════════════════════════════
// Provider Connection (lo que guarda el tendero al conectar)
// ══════════════════════════════════════════════════════════════

export interface DeliveryProviderConnection {
  storeId: string;
  provider: DeliveryProvider;
  status: 'connected' | 'disconnected' | 'suspended';
  /** API key o token del tendero, encriptado en DB */
  accessTokenEnc: string;
  /** Secret para verificar firma del webhook */
  webhookSecretEnc?: string;
  /** ID de la tienda en el provider (Rappi store_id, Uber Eats store_uuid) */
  providerStoreId: string;
  environment: 'sandbox' | 'production';
  connectedAt: Date;
}

// ══════════════════════════════════════════════════════════════
// Provider Interface (contrato que cada adapter debe implementar)
// Cuando se extraiga a microservicio, este contrato se convierte en API REST/gRPC
// ══════════════════════════════════════════════════════════════

export interface IDeliveryProvider {
  readonly provider: DeliveryProvider;

  /** Verifica la firma del webhook entrante */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;

  /** Normaliza el payload crudo del provider a DeliveryOrder */
  parseWebhookPayload(raw: Record<string, unknown>, storeId: string): DeliveryOrder | null;

  /** Notifica al provider que aceptamos el pedido */
  acceptOrder(orderId: string, prepMinutes: number, connection: DeliveryProviderConnection): Promise<void>;

  /** Notifica al provider que rechazamos el pedido */
  rejectOrder(orderId: string, reason: string, connection: DeliveryProviderConnection): Promise<void>;

  /** Marca el pedido como listo para recoger */
  markReady(orderId: string, connection: DeliveryProviderConnection): Promise<void>;

  /** Valida las credenciales del tendero */
  validateCredentials(accessToken: string, providerStoreId: string): Promise<{ valid: boolean; storeName?: string }>;
}

// ══════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════

export interface DeliveryActionResult {
  success: boolean;
  message: string;
  order?: DeliveryOrder;
}
