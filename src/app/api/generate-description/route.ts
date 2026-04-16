import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guard';
import { getAIModel } from '@/lib/ai';
import { logger } from '@/lib/logger';

const requestSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  costPrice: z.number().positive().optional(),
  unitPrice: z.number().positive().optional(),
  unit: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAuth();

    const model = await getAIModel();
    if (!model) {
      return NextResponse.json(
        { error: 'IA no configurada. Ve a Configuración → Inteligencia Artificial para activarla.' },
        { status: 422 },
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos del producto incompletos' }, { status: 400 });
    }

    const { name, category, unitPrice, unit } = parsed.data;

    const prompt = `Eres un experto en productos de abarrotes y tiendas de conveniencia en México.
Genera una descripción comercial corta (máximo 2 oraciones, 80 palabras) para este producto:

Producto: ${name}
Categoría: ${category}
${unitPrice ? `Precio: $${unitPrice} MXN` : ''}
${unit ? `Unidad: ${unit}` : ''}

Reglas:
- Escribe en español de México
- Tono profesional pero cercano
- Menciona beneficios o características clave del producto
- NO incluyas el precio en la descripción
- NO uses emojis
- NO repitas el nombre del producto al inicio`;

    const { text } = await generateText({
      model,
      prompt,
      maxOutputTokens: 150,
    });

    logger.info('Product description generated', {
      action: 'ai_product_description',
      productName: name,
    });

    return NextResponse.json({ description: text.trim() });
  } catch (error: unknown) {
    logger.error('Product description generation failed', {
      action: 'ai_product_description_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Error generando descripción', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
