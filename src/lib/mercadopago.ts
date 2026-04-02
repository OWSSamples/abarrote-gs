// Mercado Pago Point Integration API
// Docs: https://www.mercadopago.com.mx/developers/es/docs/mp-point/integration-api

export interface MercadoPagoConfig {
  publicKey?: string;
  deviceId: string;
  enabled: boolean;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  description: string;
  external_reference: string;
  status: 'open' | 'on_terminal' | 'processed' | 'canceled' | 'error' | 'expired';
  payment?: {
    id: number;
    type: string;
    status: string;
    status_detail: string;
  };
}

export interface PaymentIntentRequest {
  amount: number;
  description: string;
  external_reference: string;
  print_on_terminal?: boolean;
}

const MP_BACKEND_URL = '/api/mercadopago';

/**
 * Crea un intento de cobro a través del Backend seguro de Next.js
 */
export async function createPaymentIntent(
  config: MercadoPagoConfig,
  request: PaymentIntentRequest
): Promise<PaymentIntent> {
  const response = await fetch(MP_BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create_point_intent',
      deviceId: config.deviceId,
      amount: request.amount,
      description: request.description,
      external_reference: request.external_reference,
      print_on_terminal: request.print_on_terminal ?? true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Error al crear cobro en Kiosco Backend: ${response.status}`);
  }

  return response.json();
}

/**
 * Consulta el estado de un intento de cobro usando el Kiosco Backend
 */
export async function getPaymentIntentStatus(
  config: MercadoPagoConfig,
  paymentIntentId: string
): Promise<PaymentIntent> {
  const response = await fetch(MP_BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get_point_status',
      paymentIntentId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error Kiosco Backend (${response.status}) status`);
  }

  return response.json();
}

/**
 * Cancela un intento de cobro pendiente en la terminal
 */
export async function cancelPaymentIntent(
  config: MercadoPagoConfig,
  deviceId: string
): Promise<void> {
  const response = await fetch(MP_BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'cancel_point_intent',
      deviceId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error al cancelar cobro desde Kiosco Backend: ${response.status}`);
  }
}

/**
 * Obtiene la lista de dispositivos Point asociados a la cuenta
 */
export async function getDevices(): Promise<{ id: string; operating_mode: string; pos_id: number }[]> {
  const response = await fetch(MP_BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get_devices',
    }),
  });

  if (!response.ok) {
    throw new Error(`Error al obtener dispositivos desde Kiosco Backend: ${response.status}`);
  }

  const data = await response.json();
  return data.devices || [];
}

/**
 * Obtiene la configuración de MP.
 * Priority: storeConfig from DB (passed via props) > localStorage (legacy fallback)
 */
export function getMPConfig(): MercadoPagoConfig {
  if (typeof window === 'undefined') {
    return { deviceId: '', enabled: false };
  }
  try {
    // Legacy localStorage fallback
    const stored = localStorage.getItem('mp_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Strip sensitive fields from localStorage
      const { accessToken: _a, ...clean } = parsed;
      return { deviceId: clean.deviceId || '', publicKey: clean.publicKey || '', enabled: clean.enabled || false };
    }
  } catch {
    // ignore
  }
  return { deviceId: '', enabled: false };
}

/**
 * Builds MP config from the DB-backed storeConfig values.
 * This is the primary source of truth — call this with storeConfig data.
 */
export function getMPConfigFromStore(storeConfig: {
  mpDeviceId?: string;
  mpPublicKey?: string;
  mpEnabled?: boolean;
}): MercadoPagoConfig {
  return {
    deviceId: storeConfig.mpDeviceId || '',
    publicKey: storeConfig.mpPublicKey || '',
    enabled: storeConfig.mpEnabled ?? false,
  };
}

/**
 * Guarda la configuración de MP en localStorage (legacy — prefer DB storeConfig)
 */
export function saveMPConfig(config: MercadoPagoConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('mp_config', JSON.stringify({
    deviceId: config.deviceId,
    publicKey: config.publicKey,
    enabled: config.enabled,
  }));
}

/**
 * Status labels en español
 */
export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'Enviando a terminal...',
    on_terminal: 'Esperando pago en terminal...',
    processed: 'Pago procesado',
    canceled: 'Cobro cancelado',
    error: 'Error en el cobro',
    expired: 'Cobro expirado',
  };
  return labels[status] || status;
}
