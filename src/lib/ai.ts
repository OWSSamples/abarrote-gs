import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { db } from '@/db';
import { storeConfig, aiProviderConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

// ── Per-provider base URLs (all use OpenAI-compatible protocol) ──────────
export const PROVIDER_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  mistral: 'https://api.mistral.ai/v1',
};

export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openrouter: 'nvidia/nemotron-3-super:free',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  mistral: 'mistral-small-latest',
};

/**
 * Creates a Vercel AI SDK model instance for any supported provider.
 * Uses @ai-sdk/openai for OpenAI direct (better streaming support),
 * and @ai-sdk/openai-compatible for all other providers.
 */
export function createModelForProvider(providerId: string, apiKey: string, model: string) {
  if (providerId === 'openai') {
    return createOpenAI({ apiKey })(model);
  }

  const baseURL = PROVIDER_BASE_URLS[providerId];
  if (!baseURL) throw new Error(`Proveedor de IA desconocido: ${providerId}`);

  const extraHeaders =
    providerId === 'openrouter'
      ? { 'HTTP-Referer': 'https://abarrote.gs', 'X-Title': 'Abarrote GS' }
      : undefined;

  return createOpenAICompatible({
    name: providerId,
    baseURL,
    headers: extraHeaders,
    apiKey,
  })(model);
}

/**
 * Loads the active AI model from the database.
 * Priority: ai_provider_configs[activeProvider] → legacy store_config.aiApiKeyEnc
 * Returns null if AI is disabled or not configured.
 */
export async function getAIModel() {
  try {
    const [config] = await db
      .select({
        aiEnabled: storeConfig.aiEnabled,
        aiProvider: storeConfig.aiProvider,
        aiApiKeyEnc: storeConfig.aiApiKeyEnc,
        aiModel: storeConfig.aiModel,
      })
      .from(storeConfig)
      .where(eq(storeConfig.id, 'main'))
      .limit(1);

    if (!config?.aiEnabled) return null;

    const providerId = config.aiProvider || 'openrouter';

    // Try new per-provider config table first
    const [providerRow] = await db
      .select()
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.id, providerId))
      .limit(1);

    if (providerRow?.apiKeyEnc) {
      const apiKey = decrypt(providerRow.apiKeyEnc);
      const model = providerRow.selectedModel || PROVIDER_DEFAULT_MODELS[providerId] || 'gpt-4o-mini';
      return createModelForProvider(providerId, apiKey, model);
    }

    // Fallback: legacy single-provider config in store_config
    if (config.aiApiKeyEnc) {
      const apiKey = decrypt(config.aiApiKeyEnc);
      const model = config.aiModel || PROVIDER_DEFAULT_MODELS['openrouter'];
      return createModelForProvider('openrouter', apiKey, model);
    }

    return null;
  } catch (error) {
    logger.error('Failed to load AI model', {
      action: 'ai_model_load_error',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

