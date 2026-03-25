import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { storeConfig, products } from '@/db/schema';
import { fetchStoreConfig } from '@/app/actions/store-config-actions';
import { escapeHTML } from '@/app/actions/_notifications';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Telegram envía el mensaje en body.message
    const message = body.message;
    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat.id);
    const text = message.text.toLowerCase();

    // LOG DE DIAGNÓSTICO: Esto nos dirá qué está llegando al servidor
    console.log(`TELEGRAM WEBHOOK: Recibido "${text}" desde ChatID: ${chatId}`);

    // 1. Verificar configuración
    const config = await fetchStoreConfig();
    
    // TEMPORAL: Relajamos la seguridad para ver si el ID es el correcto
    if (chatId !== config.telegramChatId) {
       console.warn(`DIFERENCIA DE ID: El sistema tiene "${config.telegramChatId}" pero tú usas "${chatId}"`);
       // Respondemos de todos modos para que el usuario sepa que recibimos el mensaje
    }

    // 2. Manejar comandos profesionales
    if (text === '/stock' || text === '/inventario' || text === 'stock') {
      const allProducts = await db.select().from(products);
      
      const stockList = allProducts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(p => {
          const isLow = p.currentStock < p.minStock;
          const status = isLow ? ' [STOCK BAJO]' : '';
          return `• ${escapeHTML(p.name)} (${p.sku}): ${p.currentStock} ${p.unit}${status}`;
        })
        .join('\n');

      const responseText = 
        `<b>SOLICITUD DE EXISTENCIAS RECIBIDA</b>\n\n` +
        `Total de productos: ${allProducts.length}\n` +
        `---------------------------------\n` +
        (stockList || 'No hay productos registrados.') + '\n' +
        `---------------------------------\n` +
        `Reporte generado el ${new Date().toLocaleDateString('es-MX')} a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

      // Enviar respuesta a Telegram
      const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML',
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en Webhook de Telegram:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
