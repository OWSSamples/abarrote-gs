import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { db } from '@/db';
import { storeConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

/** Default model — most popular free tier on OpenRouter */
const DEFAULT_MODEL = 'nvidia/nemotron-3-super:free';

export interface AIConfig {
  enabled: boolean;
  provider: string;
  apiKey: string;
  model: string;
}

/**
 * Loads AI configuration from the database (store_config).
 * Returns null if AI is not enabled or no API key is set.
 */
export async function getAIConfig(): Promise<AIConfig | null> {
  try {
    const [row] = await db
      .select({
        aiEnabled: storeConfig.aiEnabled,
        aiProvider: storeConfig.aiProvider,
        aiApiKeyEnc: storeConfig.aiApiKeyEnc,
        aiModel: storeConfig.aiModel,
      })
      .from(storeConfig)
      .where(eq(storeConfig.id, 'main'))
      .limit(1);

    if (!row || !row.aiEnabled || !row.aiApiKeyEnc) {
      return null;
    }

    const apiKey = decrypt(row.aiApiKeyEnc);

    return {
      enabled: row.aiEnabled,
      provider: row.aiProvider,
      apiKey,
      model: row.aiModel || DEFAULT_MODEL,
    };
  } catch (error) {
    logger.error('Failed to load AI config', {
      action: 'ai_config_load_error',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/**
 * Creates a Vercel AI SDK model instance backed by OpenRouter.
 * Returns null if AI is not configured.
 */
export async function getAIModel() {
  const config = await getAIConfig();
  if (!config) return null;

  const openrouter = createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': 'https://abarrote.gs',
      'X-Title': 'Abarrote GS',
    },
    apiKey: config.apiKey,
  });

  return openrouter(config.model);
}
