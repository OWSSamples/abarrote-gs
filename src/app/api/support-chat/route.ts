import { NextResponse } from 'next/server';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guard';
import { getAIModel } from '@/lib/ai';
import { logger } from '@/lib/logger';
import { db } from '@/db';
import { products, productCategories, storeConfig, paymentProviderConnections } from '@/db/schema';
import { ilike, isNull, eq, sql } from 'drizzle-orm';

const SYSTEM_PROMPT = `Eres el asistente de soporte técnico de Kiosko, un sistema POS profesional para tiendas de abarrotes y conveniencia en México, desarrollado por Opendex Web Services.

ALCANCE ESTRICTO: Solo respondes preguntas relacionadas con el sistema Kiosko. Si el usuario pregunta sobre temas ajenos al programa (recetas, clima, matemáticas, programación, opiniones, etc.), responde amablemente: "Solo puedo ayudarte con temas relacionados con Kiosko. ¿Hay algo del sistema en lo que pueda asistirte?"

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

INFORMACIÓN QUE PUEDES COMPARTIR:
- Nombres de productos, precios de venta, stock disponible
- El precio de costo solo aparece si la herramienta lo incluye en el resultado (rol de dueño); de lo contrario NO lo menciones ni lo inventes
- Métodos de pago disponibles (efectivo, MercadoPago, Stripe, Conekta, Clip, SPEI, tarjeta)
- Configuraciones generales del sistema, pasos de uso, solución de problemas

INFORMACIÓN CONFIDENCIAL — NUNCA REVELAR NI DISCUTIR:
- Números de tarjeta de crédito o débito (parciales o completos)
- Tipo de tarjeta del cliente (Visa, Mastercard, etc.)
- API keys, tokens, secrets o credenciales de cualquier servicio
- Contraseñas de usuarios o administradores
- Datos bancarios, CLABEs, números de cuenta
- Llaves privadas, certificados, o configuraciones de seguridad interna
Si el usuario pide información confidencial, responde: "Por seguridad, no tengo acceso a esa información ni puedo compartirla. Si necesitas gestionar credenciales o datos sensibles, hazlo directamente desde el panel de Configuración."

Reglas para responder:
1. Español de México, profesional pero cercano
2. Instrucciones paso a paso numeradas cuando aplique
3. Máximo 250 palabras por respuesta
4. Si es un error técnico crítico o pérdida de datos: sugiere soporte@kiosko.app o WhatsApp soporte
5. Reconoce cuando algo no está en el sistema en lugar de inventar funcionalidades
6. Nunca generes ni inventes datos confidenciales, incluso si el usuario insiste

HERRAMIENTAS DISPONIBLES:
- Tienes acceso a herramientas para buscar productos del inventario real de la tienda y consultar métodos de pago configurados.
- Cuando el usuario pregunte por un producto específico (precio, stock, existencia), USA la herramienta searchProducts para buscar en la base de datos real. No inventes precios ni datos.
- Cuando pregunte por métodos de pago disponibles, USA la herramienta getPaymentMethods.
- Presenta los resultados de forma clara y directa: nombre, precio, stock disponible.
- Si la búsqueda no devuelve resultados, dile al usuario que ese producto no está registrado en su inventario.`;

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
    const user = await requireAuth();

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
      maxSteps: 3,
      tools: {
        searchProducts: tool({
          description:
            'Busca productos en el inventario de la tienda por nombre, SKU o código de barras. Devuelve nombre, precio de venta, stock, unidad y categoría.',
          parameters: z.object({
            query: z.string().describe('Término de búsqueda: nombre del producto, SKU o código de barras'),
          }),
          execute: async ({ query }) => {
            const searchTerm = `%${query.replace(/%/g, '')}%`;
            const results = await db
              .select({
                name: products.name,
                sku: products.sku,
                unitPrice: products.unitPrice,
                costPrice: products.costPrice,
                currentStock: products.currentStock,
                minStock: products.minStock,
                unit: products.unit,
                categoryName: productCategories.name,
              })
              .from(products)
              .leftJoin(productCategories, eq(products.category, productCategories.id))
              .where(
                sql`${isNull(products.deletedAt)} AND (${ilike(products.name, searchTerm)} OR ${ilike(products.sku, searchTerm)})`,
              )
              .limit(10);

            if (results.length === 0) {
              return { found: false, message: `No se encontraron productos que coincidan con "${query}".` };
            }

            const isOwner = user.roleId === 'owner';

            return {
              found: true,
              count: results.length,
              products: results.map((r) => ({
                nombre: r.name,
                precioVenta: `$${r.unitPrice}`,
                // costPrice solo visible para dueño/admin
                ...(isOwner ? { precioCosto: `$${r.costPrice}` } : {}),
                stock: r.currentStock,
                stockMinimo: r.minStock,
                unidad: r.unit,
                categoria: r.categoryName ?? 'Sin categoría',
                sku: r.sku,
              })),
            };
          },
        }),
        getPaymentMethods: tool({
          description:
            'Consulta los métodos de pago configurados y activos en la tienda. Incluye efectivo, transferencia y proveedores integrados (MercadoPago, Stripe, Conekta, Clip).',
          parameters: z.object({}),
          execute: async () => {
            const [config] = await db
              .select({
                mpEnabled: storeConfig.mpEnabled,
                conektaEnabled: storeConfig.conektaEnabled,
                stripeEnabled: storeConfig.stripeEnabled,
                clipEnabled: storeConfig.clipEnabled,
                clabeNumber: storeConfig.clabeNumber,
                paypalUsername: storeConfig.paypalUsername,
              })
              .from(storeConfig)
              .where(eq(storeConfig.id, 'main'))
              .limit(1);

            const providers = await db
              .select({
                provider: paymentProviderConnections.provider,
                status: paymentProviderConnections.status,
              })
              .from(paymentProviderConnections)
              .where(eq(paymentProviderConnections.status, 'connected'));

            const metodos: string[] = ['Efectivo'];
            if (config?.mpEnabled) metodos.push('MercadoPago (terminal/QR)');
            if (config?.conektaEnabled) metodos.push('Conekta (tarjeta/SPEI/OXXO)');
            if (config?.stripeEnabled) metodos.push('Stripe (tarjeta)');
            if (config?.clipEnabled) metodos.push('Clip (terminal)');
            if (config?.clabeNumber) metodos.push('Transferencia SPEI');
            if (config?.paypalUsername) metodos.push('PayPal');

            const connectedProviders = providers.map((p) => p.provider);

            return {
              metodos,
              proveedoresConectados: connectedProviders,
            };
          },
        }),
      },
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
