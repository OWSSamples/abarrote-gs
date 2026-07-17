export { getAvailableProviders } from './provider-catalog';
export type { ServiceCategory, ServiciosProviderCatalogEntry } from './provider-catalog';
export { getActiveProvider, resetProvider } from './provider-registry';
export type { ServiciosProviderConfig } from './provider-registry';
export type {
  ServiciosProvider,
  TopupRequest,
  BillPaymentRequest,
  ProviderResponse,
  TransactionStatus,
  ProviderBalance,
  CarrierInfo,
  ServiceInfo,
} from './provider-adapter';
export { normalizePhoneNumber, isValidMexicanPhone, validateReferenceNumber } from './provider-adapter';
