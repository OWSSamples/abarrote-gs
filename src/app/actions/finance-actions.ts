'use server';

import { requirePermission, validateId } from '@/lib/auth/guard';
import { validateSchema, createGastoSchema, updateGastoSchema, createProveedorSchema, updateProveedorSchema, createPedidoSchema, updatePedidoStatusSchema, idSchema } from '@/lib/validation/schemas';
import { db } from '@/db';
import { gastos, proveedores, pedidos, pedidoItems, products } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type { Gasto, GastoCategoria, Proveedor, PedidoRecord } from '@/types';
import { numVal } from './_helpers';

// ==================== GASTOS ====================

export async function fetchGastos(): Promise<Gasto[]> {
  await requirePermission('expenses.view');
  const rows = await db.select().from(gastos).orderBy(desc(gastos.fecha));
  return rows.map((r) => ({
    id: r.id,
    concepto: r.concepto,
    categoria: r.categoria as GastoCategoria,
    monto: numVal(r.monto),
    fecha: r.fecha.toISOString(),
    notas: r.notas,
    comprobante: r.comprobante,
  }));
}

export async function createGasto(data: Omit<Gasto, 'id'>): Promise<Gasto> {
  await requirePermission('expenses.create');
  validateSchema(createGastoSchema, data, 'createGasto');
  const id = `gasto-${crypto.randomUUID()}`;

  await db.insert(gastos).values({
    id,
    concepto: data.concepto,
    categoria: data.categoria,
    monto: String(data.monto),
    fecha: new Date(data.fecha),
    notas: data.notas,
    comprobante: data.comprobante,
  });

  return { ...data, id };
}

export async function updateGasto(id: string, data: Partial<Gasto>): Promise<void> {
  await requirePermission('expenses.create');
  validateSchema(idSchema, id, 'updateGasto.id');
  validateSchema(updateGastoSchema, data, 'updateGasto');
  const updateData: Record<string, unknown> = {};
  if (data.concepto !== undefined) updateData.concepto = data.concepto;
  if (data.categoria !== undefined) updateData.categoria = data.categoria;
  if (data.monto !== undefined) updateData.monto = String(data.monto);
  if (data.fecha !== undefined) updateData.fecha = new Date(data.fecha);
  if (data.notas !== undefined) updateData.notas = data.notas;
  if (data.comprobante !== undefined) updateData.comprobante = data.comprobante;
  if (Object.keys(updateData).length > 0) {
    await db.update(gastos).set(updateData).where(eq(gastos.id, id));
  }
}

export async function deleteGasto(id: string): Promise<void> {
  await requirePermission('expenses.delete');
  validateId(id, 'Gasto ID');
  await db.delete(gastos).where(eq(gastos.id, id));
}

// ==================== PROVEEDORES ====================

export async function fetchProveedores(): Promise<Proveedor[]> {
  await requirePermission('suppliers.view');
  const rows = await db.select().from(proveedores).orderBy(proveedores.nombre);
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    contacto: r.contacto,
    telefono: r.telefono,
    email: r.email,
    direccion: r.direccion,
    categorias: r.categorias ?? [],
    notas: r.notas,
    activo: r.activo,
    ultimoPedido: r.ultimoPedido?.toISOString() ?? null,
  }));
}

export async function createProveedor(
  data: Omit<Proveedor, 'id' | 'ultimoPedido'>
): Promise<Proveedor> {
  await requirePermission('suppliers.edit');
  validateSchema(createProveedorSchema, data, 'createProveedor');
  const id = `prov-${crypto.randomUUID()}`;
  await db.insert(proveedores).values({
    id,
    nombre: data.nombre,
    contacto: data.contacto,
    telefono: data.telefono,
    email: data.email,
    direccion: data.direccion,
    categorias: data.categorias,
    notas: data.notas,
    activo: data.activo,
  });
  return { ...data, id, ultimoPedido: null };
}

export async function updateProveedor(id: string, data: Partial<Proveedor>): Promise<void> {
  await requirePermission('suppliers.edit');
  validateSchema(idSchema, id, 'updateProveedor.id');
  validateSchema(updateProveedorSchema, data, 'updateProveedor');
  const updateData: Record<string, unknown> = {};
  if (data.nombre !== undefined) updateData.nombre = data.nombre;
  if (data.contacto !== undefined) updateData.contacto = data.contacto;
  if (data.telefono !== undefined) updateData.telefono = data.telefono;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.direccion !== undefined) updateData.direccion = data.direccion;
  if (data.categorias !== undefined) updateData.categorias = data.categorias;
  if (data.notas !== undefined) updateData.notas = data.notas;
  if (data.activo !== undefined) updateData.activo = data.activo;
  if (Object.keys(updateData).length > 0) {
    await db.update(proveedores).set(updateData).where(eq(proveedores.id, id));
  }
}

export async function deleteProveedor(id: string): Promise<void> {
  await requirePermission('suppliers.edit');
  validateId(id, 'Proveedor ID');
  await db.delete(proveedores).where(eq(proveedores.id, id));
}

// ==================== PEDIDOS ====================

export async function fetchPedidos(): Promise<PedidoRecord[]> {
  await requirePermission('suppliers.view');
  const rows = await db.select().from(pedidos).orderBy(desc(pedidos.fecha)).limit(50);
  if (rows.length === 0) return [];

  const pedidoIds = rows.map(r => r.id);
  const allItems = await db.select().from(pedidoItems).where(sql`${pedidoItems.pedidoId} IN ${pedidoIds}`);
  
  const itemsByPedidoId = new Map<string, any[]>();
  for (const item of allItems) {
    const list = itemsByPedidoId.get(item.pedidoId) || [];
    list.push({
      productId: item.productId,
      productName: item.productName,
      cantidad: item.cantidad,
    });
    itemsByPedidoId.set(item.pedidoId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    proveedor: row.proveedor,
    productos: itemsByPedidoId.get(row.id) || [],
    notas: row.notas,
    fecha: row.fecha.toISOString(),
    estado: row.estado as 'pendiente' | 'enviado' | 'recibido',
  }));
}

export async function createPedido(
  data: Omit<PedidoRecord, 'id' | 'fecha' | 'estado'>
): Promise<PedidoRecord> {
  await requirePermission('suppliers.edit');
  const id = `pedido-${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(pedidos).values({
    id,
    proveedor: data.proveedor,
    notas: data.notas,
    fecha: now,
    estado: 'pendiente',
  });

  for (const prod of data.productos) {
    await db.insert(pedidoItems).values({
      id: `pi-${crypto.randomUUID()}`,
      pedidoId: id,
      productId: prod.productId,
      productName: prod.productName,
      cantidad: prod.cantidad,
    });
  }

  return {
    ...data,
    id,
    fecha: now.toISOString(),
    estado: 'pendiente',
  };
}

export async function updatePedidoStatus(id: string, estado: 'pendiente' | 'enviado' | 'recibido'): Promise<void> {
  await requirePermission('suppliers.edit');
  validateSchema(updatePedidoStatusSchema, { id, estado }, 'updatePedidoStatus');
  await db.update(pedidos).set({ estado }).where(eq(pedidos.id, id));
}

export async function receivePedido(pedidoId: string): Promise<void> {
  await requirePermission('suppliers.edit');
  validateId(pedidoId, 'Pedido ID');
  await db.update(pedidos).set({ estado: 'recibido' }).where(eq(pedidos.id, pedidoId));
  const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedidoId, pedidoId));
  for (const item of items) {
    await db
      .update(products)
      .set({
        currentStock: sql`current_stock + ${item.cantidad}`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, item.productId));
  }
}
