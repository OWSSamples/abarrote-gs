'use server';

import { requirePermission, sanitize, validateNumber } from '@/lib/auth/guard';
import { db } from '@/db';
import { servicios } from '@/db/schema';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import type { Servicio, ServicioEstado } from '@/types';
import { sendNotification, escapeHTML } from './_notifications';
import { SERVICIO_CATALOGO } from './servicios-catalogo';
import { validateSchema, createRecargaSchema, createPagoServicioSchema, idSchema } from '@/lib/validation/schemas';

// ==================== HELPERS ====================

function mapRow(r: typeof servicios.$inferSelect): Servicio {
  return {
    id: r.id,
    tipo: r.tipo as 'recarga' | 'servicio',
    categoria: r.categoria,
    nombre: r.nombre,
    monto: Number(r.monto),
    comision: Number(r.comision),
    numeroReferencia: r.numeroReferencia,
    folio: r.folio,
    estado: r.estado as ServicioEstado,
    cajero: r.cajero,
    fecha: r.fecha.toISOString(),
  };
}

/** Atomic folio generation using a sequence */
async function generateFolio(): Promise<string> {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS servicios_folio_seq START 1`);

  // Sync sequence to current max folio (first time only)
  const maxResult = await db.execute(
    sql`SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 'SRV-(.*)') AS INTEGER)), 0) AS max_num FROM servicios`,
  );
  const maxNum = Number((maxResult as unknown as { rows: { max_num: number }[] }).rows?.[0]?.max_num) || 0;

  await db.execute(sql`SELECT setval('servicios_folio_seq', GREATEST(${maxNum}, (SELECT last_value FROM servicios_folio_seq)), true)`);

  const result = await db.execute(sql`SELECT nextval('servicios_folio_seq') AS seq`);
  const seq = Number((result as unknown as { rows: { seq: string }[] }).rows?.[0]?.seq) || Date.now();

  return `SRV-${String(seq).padStart(6, '0')}`;
}

// ==================== QUERIES ==

export async function fetchServicios(filtro?: {
  tipo?: 'recarga' | 'servicio';
  desde?: string;
  hasta?: string;
}): Promise<Servicio[]> {
  await requirePermission('servicios.view');

  const conditions = [];
  if (filtro?.tipo) {
    conditions.push(eq(servicios.tipo, filtro.tipo));
  }
  if (filtro?.desde) {
    conditions.push(gte(servicios.fecha, new Date(filtro.desde)));
  }
  if (filtro?.hasta) {
    conditions.push(lte(servicios.fecha, new Date(filtro.hasta)));
  }

  const rows = conditions.length > 0
    ? await db.select().from(servicios).where(and(...conditions)).orderBy(desc(servicios.fecha))
    : await db.select().from(servicios).orderBy(desc(servicios.fecha));

  return rows.map(mapRow);
}

export async function fetchServiciosResumen(): Promise<{
  totalHoy: number;
  comisionesHoy: number;
  recargasHoy: number;
  pagosHoy: number;
}> {
  await requirePermission('servicios.view');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      tipo: servicios.tipo,
      total: sql<string>`COALESCE(SUM(monto::numeric), 0)`,
      comisiones: sql<string>`COALESCE(SUM(comision::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(servicios)
    .where(and(
      gte(servicios.fecha, todayStart),
      eq(servicios.estado, 'completado'),
    ))
    .groupBy(servicios.tipo);

  const recargaRow = rows.find((r) => r.tipo === 'recarga');
  const servicioRow = rows.find((r) => r.tipo === 'servicio');

  return {
    totalHoy: Number(recargaRow?.total ?? 0) + Number(servicioRow?.total ?? 0),
    comisionesHoy: Number(recargaRow?.comisiones ?? 0) + Number(servicioRow?.comisiones ?? 0),
    recargasHoy: Number(recargaRow?.count ?? 0),
    pagosHoy: Number(servicioRow?.count ?? 0),
  };
}

// ==================== MUTATIONS ====================

export async function createRecarga(data: {
  categoria: string;
  nombre: string;
  monto: number;
  numeroReferencia: string;
  cajero: string;
}): Promise<Servicio> {
  const user = await requirePermission('servicios.create');
  validateSchema(createRecargaSchema, data, 'createRecarga');

  const nombre = sanitize(data.nombre);
  const categoria = sanitize(data.categoria);
  const numeroReferencia = sanitize(data.numeroReferencia);
  const cajero = sanitize(data.cajero);
  const monto = validateNumber(data.monto, { min: 10, max: 5000, label: 'Monto de recarga' });

  if (!numeroReferencia || numeroReferencia.length < 10) {
    throw new Error('El número de teléfono debe tener al menos 10 dígitos');
  }

  // Calculate commission from catalog
  const catalogEntry = SERVICIO_CATALOGO.recargas.find((r) => r.id === categoria);
  const comisionPct = catalogEntry?.comisionPct ?? 4;
  const comision = Math.round(monto * (comisionPct / 100) * 100) / 100;

  const id = `srv-${crypto.randomUUID()}`;
  const folio = await generateFolio();

  const [row] = await db.insert(servicios).values({
    id,
    tipo: 'recarga',
    categoria,
    nombre,
    monto: String(monto),
    comision: String(comision),
    numeroReferencia,
    folio,
    estado: 'completado',
    cajero,
    fecha: new Date(),
  }).returning();

  logger.info('Recarga created', { folio, categoria, monto, cajero: user.uid });

  // Telegram notification
  await sendNotification(
    `📱 <b>RECARGA REALIZADA</b>\n\n` +
    `Operador: ${escapeHTML(nombre)}\n` +
    `Número: ${escapeHTML(numeroReferencia)}\n` +
    `Monto: $${monto.toFixed(2)}\n` +
    `Comisión: $${comision.toFixed(2)}\n` +
    `Folio: ${escapeHTML(folio)}\n` +
    `Cajero: ${escapeHTML(cajero)}`,
  );

  revalidatePath('/dashboard');
  return mapRow(row);
}

export async function createPagoServicio(data: {
  categoria: string;
  nombre: string;
  monto: number;
  numeroReferencia: string;
  cajero: string;
}): Promise<Servicio> {
  const user = await requirePermission('servicios.create');
  validateSchema(createPagoServicioSchema, data, 'createPagoServicio');

  const nombre = sanitize(data.nombre);
  const categoria = sanitize(data.categoria);
  const numeroReferencia = sanitize(data.numeroReferencia);
  const cajero = sanitize(data.cajero);
  const monto = validateNumber(data.monto, { min: 1, max: 50000, label: 'Monto del pago' });

  if (!numeroReferencia || numeroReferencia.length < 5) {
    throw new Error('El número de referencia/cuenta debe tener al menos 5 caracteres');
  }

  // Fixed commission from catalog
  const catalogEntry = SERVICIO_CATALOGO.servicios.find((s) => s.id === categoria);
  const comision = catalogEntry?.comisionFija ?? 8;

  const id = `srv-${crypto.randomUUID()}`;
  const folio = await generateFolio();

  const [row] = await db.insert(servicios).values({
    id,
    tipo: 'servicio',
    categoria,
    nombre,
    monto: String(monto),
    comision: String(comision),
    numeroReferencia,
    folio,
    estado: 'completado',
    cajero,
    fecha: new Date(),
  }).returning();

  logger.info('Pago de servicio created', { folio, categoria, monto, cajero: user.uid });

  await sendNotification(
    `🏠 <b>PAGO DE SERVICIO</b>\n\n` +
    `Servicio: ${escapeHTML(nombre)}\n` +
    `Referencia: ${escapeHTML(numeroReferencia)}\n` +
    `Monto: $${monto.toFixed(2)}\n` +
    `Comisión ganada: $${comision.toFixed(2)}\n` +
    `Folio: ${escapeHTML(folio)}\n` +
    `Cajero: ${escapeHTML(cajero)}`,
  );

  revalidatePath('/dashboard');
  return mapRow(row);
}

export async function cancelarServicio(id: string): Promise<void> {
  await requirePermission('servicios.edit');
  validateSchema(idSchema, id, 'cancelarServicio:id');

  const rows = await db.select().from(servicios).where(eq(servicios.id, id));
  if (rows.length === 0) throw new Error('Servicio no encontrado');
  if (rows[0].estado === 'cancelado') throw new Error('Este servicio ya fue cancelado');

  await db.update(servicios)
    .set({ estado: 'cancelado' })
    .where(eq(servicios.id, id));

  logger.info('Servicio cancelled', { id, folio: rows[0].folio });
  revalidatePath('/dashboard');
}
