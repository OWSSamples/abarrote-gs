import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guard';
import { getAIModel } from '@/lib/ai';
import { logger } from '@/lib/logger';

// 8 MB hard cap on uploads (matches /api/upload + a small margin for FormData overhead).
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

/**
 * Returns { buffer, mimeType } from a multipart/form-data body containing a
 * `file` field. The legacy `{ url: string }` JSON path was removed to avoid
 * server-side request forgery (SSRF) — the server should never fetch
 * arbitrary URLs supplied by the client.
 */
async function readReceipt(req: Request): Promise<
  | { ok: true; buffer: ArrayBuffer; mimeType: string }
  | { ok: false; status: number; error: string }
> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return {
      ok: false,
      status: 400,
      error: 'Envía el comprobante como multipart/form-data con el campo "file".',
    };
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return { ok: false, status: 400, error: 'Falta el archivo a analizar.' };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      status: 400,
      error: `Tipo de archivo no soportado (${file.type || 'desconocido'}). Usa JPG, PNG, WebP o PDF.`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `El archivo excede el límite de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`,
    };
  }
  return { ok: true, buffer: await file.arrayBuffer(), mimeType: file.type };
}

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

    const read = await readReceipt(req);
    if (!read.ok) {
      return NextResponse.json({ error: read.error }, { status: read.status });
    }
    const { buffer, mimeType } = read;

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
    const message = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Receipt extraction failed', {
      action: 'ai_receipt_error',
      error: message,
    });
    // Surface the underlying error message — without it the user only sees a
    // generic toast and cannot diagnose (model 404, rate limit, bad key, etc.)
    return NextResponse.json(
      { error: `Error procesando el recibo: ${message}` },
      { status: 500 },
    );
  }
}
