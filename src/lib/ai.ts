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
  openrouter: 'nvidia/nemotron-3-super-120b-a12b:free',
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
      ? { 'HTTP-Referer': 'https://kiosko.app', 'X-Title': 'Kiosko POS' }
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
 *
 * Resolution order:
 *   1. `store_config.ai_enabled` must be true.
 *   2. `ai_provider_configs[active]` is the source of truth (per-provider key + model).
 *   3. If that row has no key but the legacy single-provider columns
 *      (`store_config.ai_api_key_enc` + `ai_model`) ARE populated, we
 *      auto-backfill them into `ai_provider_configs` and use them. This
 *      handles deployments where the consolidation migration never ran or
 *      the user configured AI before the multi-provider table existed.
 *
 * Returns null only if the user has not configured ANY API key for the
 * currently-active provider.
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

    if (!config?.aiEnabled) {
      logger.info('AI disabled', { action: 'ai_model_disabled' });
      return null;
    }

    const providerId = config.aiProvider || 'openrouter';

    const [providerRow] = await db
      .select()
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.id, providerId))
      .limit(1);

    if (providerRow?.apiKeyEnc) {
      const apiKey = decrypt(providerRow.apiKeyEnc);
      const model =
        providerRow.selectedModel ||
        PROVIDER_DEFAULT_MODELS[providerId] ||
        'gpt-4o-mini';
      return createModelForProvider(providerId, apiKey, model);
    }

    // Legacy fallback / auto-migration. Only valid when the active provider
    // matches the legacy columns (which always stored OpenRouter keys).
    if (config.aiApiKeyEnc && providerId === 'openrouter') {
      const legacyModel =
        config.aiModel || PROVIDER_DEFAULT_MODELS['openrouter'];

      // Attempt to upsert into ai_provider_configs so we don't keep falling
      // back. Best-effort: failures are non-fatal.
      try {
        await db
          .insert(aiProviderConfigs)
          .values({
            id: 'openrouter',
            apiKeyEnc: config.aiApiKeyEnc,
            enabled: true,
            selectedModel: legacyModel,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: aiProviderConfigs.id,
            set: {
              apiKeyEnc: config.aiApiKeyEnc,
              selectedModel: legacyModel,
              enabled: true,
              updatedAt: new Date(),
            },
          });
        logger.info('Backfilled legacy AI key into ai_provider_configs', {
          action: 'ai_legacy_backfill',
          providerId: 'openrouter',
        });
      } catch (backfillError) {
        logger.warn('Legacy AI backfill failed (non-fatal)', {
          action: 'ai_legacy_backfill_failed',
          error: backfillError instanceof Error ? backfillError.message : 'unknown',
        });
      }

      const apiKey = decrypt(config.aiApiKeyEnc);
      return createModelForProvider('openrouter', apiKey, legacyModel);
    }

    logger.warn('Active AI provider has no API key configured', {
      action: 'ai_model_no_key',
      providerId,
      hasLegacyKey: !!config.aiApiKeyEnc,
    });
    return null;
  } catch (error) {
    logger.error('Failed to load AI model', {
      action: 'ai_model_load_error',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

