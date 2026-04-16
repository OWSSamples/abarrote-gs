import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guard';
import { getAIModel } from '@/lib/ai';
import { logger } from '@/lib/logger';

const SYSTEM_PROMPT = `Eres el asistente de soporte técnico de Abarrote GS, un sistema POS profesional para tiendas de abarrotes y conveniencia en México.

Conoces todas las funcionalidades del sistema:
- POS: Ventas con código de barras o búsqueda manual, modo offline automático, descuentos, devoluciones, múltiples métodos de pago (MercadoPago, Stripe, Conekta, Clip, SPEI, efectivo, tarjeta débito/crédito)
- Inventario: Gestión de stock, alertas de bajo stock y caducidad, categorías, proveedores, mermas, auditoría, ajustes masivos
- Caja: Apertura/cierre de turno, corte de caja, registro de gastos con OCR de recibos, diferencias de efectivo
- Clientes: Perfiles, fiado (crédito con abonos parciales), historial de compras, sistema de puntos y lealtad con recompensas configurables
- Reportes y Analytics: Dashboard financiero, ventas por período, comparativas, exportación CSV/Excel, KPIs de inventario
- Configuración: RFC/régimen fiscal, tickets personalizados (diseñador drag-and-drop), pantalla del cliente segundo monitor, notificaciones Telegram
- Hardware: Impresora térmica ESC/POS (TCP/IP o USB), cajón de dinero, báscula serial, escáner de código de barras
- IA: Descripción automática de productos, OCR de recibos/facturas para gastos, chat de soporte (tú)
- Pagos integrados: Terminal MercadoPago Point, QR dinámico, links de pago
- Servicios: Recargas telefónicas Telmex/Telcel/etc., pago de servicios CFE/agua

Reglas para responder:
1. Español de México, profesional pero cercano
2. Instrucciones paso a paso numeradas cuando aplique
3. Máximo 250 palabras por respuesta
4. Si es un error técnico crítico o pérdida de datos: sugiere soporte@abarrote.gs o WhatsApp soporte
5. Reconoce cuando algo no está en el sistema en lugar de inventar funcionalidades
6. Si te preguntan algo fuera del sistema, redirige amablemente al tema de soporte`;

const requestSchema = z.object({
  message: z.string().min(1).max(2000).trim(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
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
      return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 });
    }

    const { message, history } = parsed.data;

    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      maxOutputTokens: 400,
    });

    logger.info('Support chat response generated', {
      action: 'ai_support_chat',
      historyLength: history.length,
      messageLength: message.length,
    });

    return NextResponse.json({ reply: text.trim() });
  } catch (error: unknown) {
    logger.error('Support chat failed', {
      action: 'ai_support_chat_error',
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { error: 'Error en el asistente de IA. Intenta de nuevo o contacta soporte técnico.' },
      { status: 500 },
    );
  }
}
