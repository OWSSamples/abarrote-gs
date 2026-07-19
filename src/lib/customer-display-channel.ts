const CUSTOMER_DISPLAY_CHANNEL_PREFIX = 'customer_display';

function requireStoreId(storeId: string): string {
  const normalizedStoreId = storeId.trim();
  if (!normalizedStoreId) {
    throw new Error('No se pudo determinar el negocio para la pantalla del cliente.');
  }

  return normalizedStoreId;
}

export function getCustomerDisplayChannelName(storeId: string): string {
  return `${CUSTOMER_DISPLAY_CHANNEL_PREFIX}:${requireStoreId(storeId)}`;
}

export function getCustomerDisplayWindowName(storeId: string): string {
  return `${CUSTOMER_DISPLAY_CHANNEL_PREFIX}_${requireStoreId(storeId)}`;
}
