import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/infrastructure/qstash';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// POST /api/jobs/stock-alert
// ══════════════════════════════════════════════════════════════
//
// Sends a stock-critical Telegram notification.
// Offloaded from the sale flow so the cashier doesn't wait
// for Telegram API latency.
//
// Payload: { productName: string, currentStock: number, minStock: number }

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('upstash-signature') ?? '';

  const isValid = await verifyQStashSignature(signature, body);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: { productName: string; currentStock: number; minStock: number };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!payload.productName || typeof payload.currentStock !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const { sendNotificationDirect } = await import('@/infrastructure/qstash/handlers');
    await sendNotificationDirect(
      `<b>REPORTE DE STOCK CRÍTICO</b>\n\n` +
      `Producto: ${escapeHTML(payload.productName)}\n` +
      `Stock actual: ${payload.currentStock}\n` +
      `Mínimo sugerido: ${payload.minStock}`,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Stock alert job failed', {
      action: 'job_stock_alert_error',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

function escapeHTML(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
