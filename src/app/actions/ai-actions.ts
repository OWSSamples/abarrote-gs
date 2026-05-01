'use server';

import { db } from '@/db';
import { aiProviderConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/crypto';
import { requireAuth } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';
import { cache } from '@/infrastructure/redis';
import { z } from 'zod';
import { createModelForProvider, PROVIDER_DEFAULT_MODELS } from '@/lib/ai';
import { generateText } from 'ai';

// ── Get all configured providers (safe — no encrypted keys exposed) ──────
export async function getAIProvidersAction(): Promise<
  { id: string; hasKey: boolean; enabled: boolean; selectedModel: string }[]
> {
  await requireAuth();

  const rows = await db.select().from(aiProviderConfigs);
  return rows.map((r) => ({
    id: r.id,
    hasKey: !!r.apiKeyEnc,
    enabled: r.enabled,
    selectedModel: r.selectedModel,
  }));
}

// ── Save / update a specific provider's config ───────────────────────────
const saveProviderSchema = z.object({
  providerId: z.string().min(1).max(32),
  apiKey: z.string().optional(),
  selectedModel: z.string().min(1).max(256),
});

export async function saveProviderConfigAction(
  input: z.infer<typeof saveProviderSchema>
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const parsed = saveProviderSchema.parse(input);

  const [existing] = await db
    .select({ apiKeyEnc: aiProviderConfigs.apiKeyEnc })
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.id, parsed.providerId))
    .limit(1);

  const now = new Date();

  if (existing) {
    const hasKey = !!(parsed.apiKey || existing.apiKeyEnc);
    const patch: Record<string, unknown> = {
      selectedModel: parsed.selectedModel,
      enabled: hasKey,
      updatedAt: now,
    };
    if (parsed.apiKey) patch.apiKeyEnc = encrypt(parsed.apiKey);

    await db.update(aiProviderConfigs).set(patch).where(eq(aiProviderConfigs.id, parsed.providerId));
  } else {
    if (!parsed.apiKey) {
      return { success: false, error: 'Se requiere una API key para configurar este proveedor.' };
    }
    await db.insert(aiProviderConfigs).values({
      id: parsed.providerId,
      apiKeyEnc: encrypt(parsed.apiKey),
      enabled: true,
      selectedModel: parsed.selectedModel,
      updatedAt: now,
    });
  }

  // Invalidate cached store config in case the active provider points here.
  await cache.invalidatePattern('config:');

  logger.info('AI provider config saved', { action: 'ai_provider_saved', providerId: parsed.providerId });
  return { success: true };
}

// ── Test a specific provider's connection ─────────────────────────────────
export async function testProviderAction(
  providerId: string
): Promise<{ success: boolean; message: string }> {
  await requireAuth();

  try {
    const [row] = await db
      .select()
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.id, providerId))
      .limit(1);

    if (!row?.apiKeyEnc) {
      return { success: false, message: 'No hay API key configurada para este proveedor.' };
    }

    const apiKey = decrypt(row.apiKeyEnc);
    const model = row.selectedModel || PROVIDER_DEFAULT_MODELS[providerId] || 'gpt-4o-mini';
    const modelInstance = createModelForProvider(providerId, apiKey, model);

    const { text } = await generateText({
      model: modelInstance,
      prompt: 'Responde únicamente con la palabra "OK".',
      maxOutputTokens: 10,
    });

    return {
      success: true,
      message: `Conexión exitosa — Respuesta: "${text.trim().substring(0, 60)}"`,
    };
  } catch (error) {
    logger.error('AI provider test failed', {
      action: 'ai_provider_test_failed',
      providerId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al conectar con el proveedor.',
    };
  }
}

// ── Remove a provider's key (disable it) ─────────────────────────────────
export async function deleteProviderConfigAction(
  providerId: string
): Promise<{ success: boolean }> {
  await requireAuth();

  await db
    .update(aiProviderConfigs)
    .set({ apiKeyEnc: null, enabled: false, updatedAt: new Date() })
    .where(eq(aiProviderConfigs.id, providerId));

  await cache.invalidatePattern('config:');

  logger.info('AI provider config removed', { action: 'ai_provider_removed', providerId });
  return { success: true };
}

// ── Fetch live model catalogue from a provider's API ─────────────────────
// Used by the UI dropdown so the list always matches the provider's real
// catalogue (avoids the user selecting a fictitious model id).
type ModelOption = { label: string; value: string; free?: boolean };

const PROVIDER_MODELS_ENDPOINT: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1/models',
  openai: 'https://api.openai.com/v1/models',
  groq: 'https://api.groq.com/openai/v1/models',
  deepseek: 'https://api.deepseek.com/v1/models',
  mistral: 'https://api.mistral.ai/v1/models',
};

export async function listProviderModelsAction(
  providerId: string
): Promise<{ success: boolean; models: ModelOption[]; error?: string }> {
  await requireAuth();

  const endpoint = PROVIDER_MODELS_ENDPOINT[providerId];
  if (!endpoint) return { success: true, models: [] };

  try {
    const [row] = await db
      .select()
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.id, providerId))
      .limit(1);
    if (!row?.apiKeyEnc) {
      return { success: false, models: [], error: 'Configura primero la API key.' };
    }
    const apiKey = decrypt(row.apiKeyEnc);

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { success: false, models: [], error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { data?: Array<{ id: string; name?: string; pricing?: { prompt?: string } }> };
    const items = Array.isArray(json.data) ? json.data : [];
    const models: ModelOption[] = items
      .map((m) => {
        const isFree =
          m.id.endsWith(':free') ||
          (m.pricing?.prompt !== undefined && parseFloat(m.pricing.prompt) === 0);
        return {
          label: m.name ? `${m.name}${isFree ? ' — Gratis' : ''}` : m.id,
          value: m.id,
          free: isFree,
        };
      })
      // Free models first, then alpha by label
      .sort((a, b) => {
        if (a.free !== b.free) return a.free ? -1 : 1;
        return a.label.localeCompare(b.label);
      });

    return { success: true, models };
  } catch (error) {
    logger.error('Failed to fetch provider model catalogue', {
      action: 'ai_provider_models_fetch_failed',
      providerId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return {
      success: false,
      models: [],
      error: error instanceof Error ? error.message : 'No fue posible obtener la lista de modelos.',
    };
  }
}
