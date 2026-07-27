export function isMissingStorePluginsTable(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = candidate.code ?? candidate.cause?.code;
  const message = `${candidate.message ?? ''} ${candidate.cause?.message ?? ''}`.toLowerCase();

  return code === '42P01' || (message.includes('store_plugins') && message.includes('does not exist'));
}
