'use server';

import { db } from '@/db';
import { storeConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';
import { requireAuth } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getAIModel } from '@/lib/ai';
import { generateText } from 'ai';

const saveAIConfigSchema = z.object({
  aiEnabled: z.boolean(),
  aiProvider: z.string().min(1),
  aiApiKey: z.string().optional(),
  aiModel: z.string().min(1),
});

export async function saveAIConfigAction(input: z.infer<typeof saveAIConfigSchema>) {
  await requireAuth();

  const parsed = saveAIConfigSchema.parse(input);

  const update: Record<string, unknown> = {
    aiEnabled: parsed.aiEnabled,
    aiProvider: parsed.aiProvider,
    aiModel: parsed.aiModel,
    updatedAt: new Date(),
  };

  // Only re-encrypt if a new API key was provided (non-empty string)
  if (parsed.aiApiKey && parsed.aiApiKey.length > 0) {
    update.aiApiKeyEnc = encrypt(parsed.aiApiKey);
  }

  await db.update(storeConfig).set(update).where(eq(storeConfig.id, 'main'));

  logger.info('AI configuration updated', {
    action: 'ai_config_updated',
    enabled: parsed.aiEnabled,
    provider: parsed.aiProvider,
    model: parsed.aiModel,
  });

  return { success: true };
}

export async function testAIConnectionAction(): Promise<{ success: boolean; message: string }> {
  await requireAuth();

  try {
    const model = await getAIModel();
    if (!model) {
      return { success: false, message: 'IA no configurada. Guarda tu API Key primero.' };
    }

    const { text } = await generateText({
      model,
      prompt: 'Responde únicamente con la palabra "OK" para confirmar que la conexión funciona.',
      maxOutputTokens: 10,
    });

    if (text.toLowerCase().includes('ok')) {
      return { success: true, message: 'Conexión exitosa con OpenRouter' };
    }

    return { success: true, message: `Conexión exitosa. Respuesta: ${text.substring(0, 50)}` };
  } catch (error) {
    logger.error('AI connection test failed', {
      action: 'ai_connection_test_error',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido al conectar con OpenRouter',
    };
  }
}
