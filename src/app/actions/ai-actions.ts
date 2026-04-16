'use server';

import { db } from '@/db';
import { aiProviderConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/crypto';
import { requireAuth } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';
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

  logger.info('AI provider config removed', { action: 'ai_provider_removed', providerId });
  return { success: true };
}
