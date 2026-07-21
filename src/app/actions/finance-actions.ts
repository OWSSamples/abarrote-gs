'use server';

import { requirePermission, validateId } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import {
  validateSchema,
  createGastoSchema,
  updateGastoSchema,
  createProveedorSchema,
  updateProveedorSchema,
  updatePedidoStatusSchema,
  idSchema,
} from '@/lib/validation/schemas';
import { db } from '@/db';
import { gastos, proveedores, pedidos, pedidoItems, products } from '@/db/schema';
import { and, eq, desc, inArray } from 'drizzle-orm';
import type { Gasto, GastoCategoria, Proveedor, PedidoRecord } from '@/types';
import { numVal } from './_helpers';
import { adjustStock } from './_stock';
import { withLogging } from '@/lib/errors';
import { isNotDeleted } from '@/infrastructure/soft-delete';
import { withRateLimit } from '@/infrastructure/redis';
import { sendNotification } from './_notifications';
import { gastoEvent } from './_notification-events';

// ==================== GASTOS ====================

async function _fetchGastos(): Promise<Gasto[]> {
  await requirePermission('expenses.view');
  const { storeId } = await requireStoreScope();
  const rows = await db
    .select()
    .from(gastos)
    .where(eq(gastos.storeId, storeId))
    .orderBy(desc(gastos.fecha))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    concepto: r.concepto,
    categoria: r.categoria as GastoCategoria,
    monto: numVal(r.monto),
    fecha: r.fecha.toISOString(),
    notas: r.notas,
    comprobante: r.comprobante,
    comprobanteUrl: r.comprobanteUrl,
  }));
}

async function _createGasto(data: Omit<Gasto, 'id'>): Promise<Gasto> {
  await requirePermission('expenses.create');
  const { storeId } = await requireStoreScope();
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
    comprobanteUrl: data.comprobanteUrl,
    storeId,
  });

  // Telegram notification (fire-and-forget)
  sendNotification(
    gastoEvent({
      concepto: data.concepto,
      categoria: data.categoria,
      monto: data.monto,
      notas: data.notas || undefined,
    }),
  );

  return { ...data, id };
}

async function _updateGasto(id: string, data: Partial<Gasto>): Promise<void> {
  await requirePermission('expenses.create');
  const { storeId } = await requireStoreScope();
  validateSchema(idSchema, id, 'updateGasto.id');
  validateSchema(updateGastoSchema, data, 'updateGasto');
  const updateData: Record<string, unknown> = {};
  if (data.concepto !== undefined) updateData.concepto = data.concepto;
  if (data.categoria !== undefined) updateData.categoria = data.categoria;
  if (data.monto !== undefined) updateData.monto = String(data.monto);
  if (data.fecha !== undefined) updateData.fecha = new Date(data.fecha);
  if (data.notas !== undefined) updateData.notas = data.notas;
  if (data.comprobante !== undefined) updateData.comprobante = data.comprobante;
  if (data.comprobanteUrl !== undefined) updateData.comprobanteUrl = data.comprobanteUrl;
  if (Object.keys(updateData).length > 0) {
    await db.update(gastos).set(updateData).where(and(eq(gastos.id, id), eq(gastos.storeId, storeId)));
  }
}

async function _deleteGasto(id: string): Promise<void> {
  await requirePermission('expenses.delete');
  const { storeId } = await requireStoreScope();
  validateId(id, 'Gasto ID');
  await db.delete(gastos).where(and(eq(gastos.id, id), eq(gastos.storeId, storeId)));
}

// ==================== PROVEEDORES ====================

async function _fetchProveedores(): Promise<Proveedor[]> {
  await requirePermission('suppliers.view');
  const { storeId } = await requireStoreScope();
  const rows = await db
    .select()
    .from(proveedores)
    .where(and(eq(proveedores.storeId, storeId), isNotDeleted(proveedores)))
    .orderBy(proveedores.nombre)
    .limit(200);
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

async function _createProveedor(data: Omit<Proveedor, 'id' | 'ultimoPedido'>): Promise<Proveedor> {
  await requirePermission('suppliers.edit');
  const { storeId } = await requireStoreScope();
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
    storeId,
  });
  return { ...data, id, ultimoPedido: null };
}

async function _updateProveedor(id: string, data: Partial<Proveedor>): Promise<void> {
  await requirePermission('suppliers.edit');
  const { storeId } = await requireStoreScope();
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
    await db
      .update(proveedores)
      .set(updateData)
      .where(and(eq(proveedores.id, id), eq(proveedores.storeId, storeId)));
  }
}

async function _deleteProveedor(id: string): Promise<void> {
  await requirePermission('suppliers.edit');
  const { storeId } = await requireStoreScope();
  validateId(id, 'Proveedor ID');
  await db
    .update(proveedores)
    .set({ deletedAt: new Date() })
    .where(and(eq(proveedores.id, id), eq(proveedores.storeId, storeId), isNotDeleted(proveedores)));
}

// ==================== PEDIDOS ====================

async function _fetchPedidos(): Promise<PedidoRecord[]> {
  await requirePermission('suppliers.view');
  const { storeId } = await requireStoreScope();
  const rows = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.storeId, storeId))
    .orderBy(desc(pedidos.fecha))
    .limit(50);
  if (rows.length === 0) return [];

  const pedidoIds = rows.map((r) => r.id);
  const allItems = await db
    .select()
    .from(pedidoItems)
    .where(and(eq(pedidoItems.storeId, storeId), inArray(pedidoItems.pedidoId, pedidoIds)));

  const itemsByPedidoId = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByPedidoId.get(item.pedidoId) || [];
    list.push(item);
    itemsByPedidoId.set(item.pedidoId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    proveedor: row.proveedor,
    productos: (itemsByPedidoId.get(row.id) || []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      cantidad: item.cantidad,
    })),
    notas: row.notas,
    fecha: row.fecha.toISOString(),
    estado: row.estado as 'pendiente' | 'enviado' | 'recibido',
  }));
}

async function _createPedido(data: Omit<PedidoRecord, 'id' | 'fecha' | 'estado'>): Promise<PedidoRecord> {
  await requirePermission('suppliers.edit');
  const { storeId } = await requireStoreScope();
  const id = `pedido-${crypto.randomUUID()}`;
  const now = new Date();

  const productIds = [...new Set(data.productos.map((product) => product.productId))];
  const ownedProducts = productIds.length > 0
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.storeId, storeId), inArray(products.id, productIds)))
    : [];
  if (ownedProducts.length !== productIds.length) {
    throw new Error('El pedido contiene productos que no pertenecen a tu negocio.');
  }

  await db.insert(pedidos).values({
    id,
    proveedor: data.proveedor,
    notas: data.notas,
    fecha: now,
    estado: 'pendiente',
    storeId,
  });

  for (const prod of data.productos) {
    await db.insert(pedidoItems).values({
      id: `pi-${crypto.randomUUID()}`,
      pedidoId: id,
      productId: prod.productId,
      productName: prod.productName,
      cantidad: prod.cantidad,
      storeId,
    });
  }

  return {
    ...data,
    id,
    fecha: now.toISOString(),
    estado: 'pendiente',
  };
}

async function _updatePedidoStatus(id: string, estado: 'pendiente' | 'enviado' | 'recibido'): Promise<void> {
  await requirePermission('suppliers.edit');
  const { storeId } = await requireStoreScope();
  validateSchema(updatePedidoStatusSchema, { id, estado }, 'updatePedidoStatus');
  await db.update(pedidos).set({ estado }).where(and(eq(pedidos.id, id), eq(pedidos.storeId, storeId)));
}

async function _receivePedido(pedidoId: string): Promise<void> {
  const user = await requirePermission('suppliers.edit');
  const { storeId } = await requireStoreScope();
  validateId(pedidoId, 'Pedido ID');
  const [pedido] = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.storeId, storeId)))
    .limit(1);
  if (!pedido) return;

  await db
    .update(pedidos)
    .set({ estado: 'recibido' })
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.storeId, storeId)));
  const items = await db
    .select()
    .from(pedidoItems)
    .where(and(eq(pedidoItems.pedidoId, pedidoId), eq(pedidoItems.storeId, storeId)));

  for (const item of items) {
    const [productRow] = await db
      .select({ costPrice: products.costPrice })
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.storeId, storeId)))
      .limit(1);
    if (!productRow) {
      throw new Error('El pedido contiene un producto que no pertenece a tu negocio.');
    }
    const unitCost = Number(productRow.costPrice);

    await adjustStock(item.productId, item.cantidad, {
      meta: {
        type: 'restock',
        source: 'pedido',
        sourceId: pedidoId,
        sourceLabel: `Pedido a ${pedido.proveedor}`,
        unitCost,
        notes: pedido.notas || `Recepción de pedido ${pedidoId.slice(-6)}`,
        userId: user.uid,
        userName: user.email ?? null,
        storeId,
      },
    });
  }
}

// ==================== WRAPPED EXPORTS ====================

export const fetchGastos = withLogging('finance.fetchGastos', _fetchGastos);
export const createGasto = withRateLimit('finance.createGasto', withLogging('finance.createGasto', _createGasto));
export const updateGasto = withLogging('finance.updateGasto', _updateGasto);
export const deleteGasto = withRateLimit('finance.deleteGasto', withLogging('finance.deleteGasto', _deleteGasto));
export const fetchProveedores = withLogging('finance.fetchProveedores', _fetchProveedores);
export const createProveedor = withRateLimit(
  'finance.createProveedor',
  withLogging('finance.createProveedor', _createProveedor),
);
export const updateProveedor = withLogging('finance.updateProveedor', _updateProveedor);
export const deleteProveedor = withRateLimit(
  'finance.deleteProveedor',
  withLogging('finance.deleteProveedor', _deleteProveedor),
);
export const fetchPedidos = withLogging('finance.fetchPedidos', _fetchPedidos);
export const createPedido = withRateLimit('finance.createPedido', withLogging('finance.createPedido', _createPedido));
export const updatePedidoStatus = withLogging('finance.updatePedidoStatus', _updatePedidoStatus);
export const receivePedido = withLogging('finance.receivePedido', _receivePedido);
