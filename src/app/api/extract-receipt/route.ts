import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guard';
import { getAIModel } from '@/lib/ai';
import { logger } from '@/lib/logger';

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

    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Falta la URL del comprobante' }, { status: 400 });
    }

    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'No se pudo descargar el archivo' }, { status: 400 });
    }
    const buffer = await fileRes.arrayBuffer();

    const isPdf = url.toLowerCase().endsWith('.pdf') || fileRes.headers.get('content-type')?.includes('pdf');
    const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

    const promptText = `
      Eres un asistente experto en contabilidad para una tienda de abarrotes en México.
      Analiza el siguiente ticket, factura o recibo comercial.
      Extrae los siguientes datos con máxima precisión:

      - concepto: un resumen corto y descriptivo de lo que se compró (ej: "Insumos de limpieza", "Mercancía Sabritas").
      - monto: el monto total final cobrado, en número decimal (ej: 1540.50). Si no hay total, intenta sumar las líneas.
      - fecha: la fecha de la compra en formato AAAA-MM-DD. Si no la encuentras, usa la fecha de hoy.
      - categoria: elige estrictamente una de: "renta", "servicios", "proveedores", "salarios", "mantenimiento", "impuestos", "otro".
        Infiere la mejor según el contenido (ej: mercancía -> proveedores, CFE/agua -> servicios).
      - items: si puedes identificar líneas individuales del ticket, extrae cada una con nombre, cantidad y precio unitario.
        Si no puedes distinguir las líneas, devuelve un array vacío.
    `;

    const { object } = await generateObject({
      model,
      schema: z.object({
        concepto: z.string().describe('El concepto de la compra resumido'),
        monto: z.number().describe('El costo total o pago total de la factura o ticket'),
        fecha: z.string().describe('La fecha de la compra o facturación YYYY-MM-DD'),
        categoria: z
          .enum(['renta', 'servicios', 'proveedores', 'salarios', 'mantenimiento', 'impuestos', 'otro'])
          .describe('Categoría calculada según la tienda o rubro de los productos'),
        items: z
          .array(
            z.object({
              nombre: z.string().describe('Nombre del producto o servicio'),
              cantidad: z.number().describe('Cantidad comprada'),
              precioUnitario: z.number().describe('Precio unitario'),
            }),
          )
          .describe('Líneas individuales del ticket, si se pueden identificar'),
      }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'file', data: buffer, mediaType: mimeType },
          ],
        },
      ],
    });

    logger.info('Receipt extracted via AI', {
      action: 'ai_receipt_extracted',
      concepto: object.concepto,
      monto: object.monto,
      itemCount: object.items.length,
    });

    return NextResponse.json({ data: object });
  } catch (error: unknown) {
    logger.error('Receipt extraction failed', {
      action: 'ai_receipt_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Error procesando el recibo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
