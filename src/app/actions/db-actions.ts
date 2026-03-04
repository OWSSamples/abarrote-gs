'use server';

import { db } from '@/db';
import {
  storeConfig,
  products,
  saleRecords,
  saleItems,
  mermaRecords,
  pedidos,
  pedidoItems,
  clientes,
  fiadoTransactions,
  fiadoItems,
  gastos,
  proveedores,
  cortesCaja,
  userRoles,
  roleDefinitions,
} from '@/db/schema';
import { eq, gte, lte, and, desc, sql } from 'drizzle-orm';
import type {
  Product,
  SaleRecord,
  SaleItem,
  MermaRecord,
  PedidoRecord,
  InventoryAlert,
  KPIData,
  SalesData,
  CorteCaja,
  Cliente,
  FiadoTransaction,
  Gasto,
  GastoCategoria,
  Proveedor,
  StoreConfig,
  UserRoleRecord,
  RoleDefinition,
  PermissionKey,
} from '@/types';
import { DEFAULT_STORE_CONFIG, DEFAULT_SYSTEM_ROLES } from '@/types';

// ==================== HELPERS ====================
function numVal(v: string | null | undefined): number {
  return v ? parseFloat(v) : 0;
}

let folioCounter = 0;

async function getNextFolio(): Promise<string> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(saleRecords);
  const count = Number(result[0]?.count ?? 0);
  folioCounter = count + 1;
  return `V-${String(folioCounter).padStart(6, '0')}`;
}

// ==================== PRODUCTS ====================
export async function fetchAllProducts(): Promise<Product[]> {
  const rows = await db.select().from(products).orderBy(products.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcode: r.barcode,
    currentStock: r.currentStock,
    minStock: r.minStock,
    expirationDate: r.expirationDate,
    category: r.category,
    costPrice: numVal(r.costPrice),
    unitPrice: numVal(r.unitPrice),
    isPerishable: r.isPerishable,
  }));
}

export async function createProduct(data: Omit<Product, 'id'>): Promise<Product> {
  const id = `p${Date.now()}`;
  await db.insert(products).values({
    id,
    name: data.name,
    sku: data.sku,
    barcode: data.barcode,
    currentStock: data.currentStock,
    minStock: data.minStock,
    expirationDate: data.expirationDate,
    category: data.category,
    costPrice: String(data.costPrice),
    unitPrice: String(data.unitPrice),
    isPerishable: data.isPerishable,
  });
  return { ...data, id };
}

export async function updateProductStock(productId: string, newStock: number): Promise<void> {
  await db.update(products).set({ currentStock: newStock, updatedAt: new Date() }).where(eq(products.id, productId));
}

export async function deleteProduct(productId: string): Promise<void> {
  await db.delete(products).where(eq(products.id, productId));
}

// ==================== STORE CONFIG ====================
export async function fetchStoreConfig(): Promise<StoreConfig> {
  const rows = await db.select().from(storeConfig).limit(1);
  if (rows.length === 0) {
    // Create default config if none exists
    await db.insert(storeConfig).values({ id: 'main' });
    return DEFAULT_STORE_CONFIG;
  }
  const r = rows[0];
  return {
    id: r.id,
    storeName: r.storeName,
    legalName: r.legalName,
    address: r.address,
    city: r.city,
    postalCode: r.postalCode,
    phone: r.phone,
    rfc: r.rfc,
    regimenFiscal: r.regimenFiscal,
    regimenDescription: r.regimenDescription,
    ivaRate: r.ivaRate,
    currency: r.currency,
    lowStockThreshold: r.lowStockThreshold,
    expirationWarningDays: r.expirationWarningDays,
    printReceipts: r.printReceipts,
    autoBackup: r.autoBackup,
    ticketFooter: r.ticketFooter,
    ticketServicePhone: r.ticketServicePhone,
    ticketVigencia: r.ticketVigencia,
    storeNumber: r.storeNumber,
  };
}

export async function saveStoreConfig(data: Partial<StoreConfig>): Promise<StoreConfig> {
  const { id, ...rest } = data;
  // Upsert: try update, if 0 rows affected then insert
  const result = await db.update(storeConfig).set({ ...rest, updatedAt: new Date() }).where(eq(storeConfig.id, 'main'));
  if (!result.rowCount || result.rowCount === 0) {
    await db.insert(storeConfig).values({ id: 'main', ...rest });
  }
  return fetchStoreConfig();
}

// ==================== INVENTORY ALERTS (computed) ====================
export async function fetchInventoryAlerts(): Promise<InventoryAlert[]> {
  const allProducts = await fetchAllProducts();
  const now = new Date();
  const alerts: InventoryAlert[] = [];

  for (const product of allProducts) {
    const isLowStock = product.currentStock < product.minStock;
    const isExpiring = product.expirationDate
      ? new Date(product.expirationDate).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000
      : false;
    const isExpired = product.expirationDate
      ? new Date(product.expirationDate) < now
      : false;

    if (isLowStock || isExpiring || isExpired) {
      const severity: 'critical' | 'warning' | 'info' = isExpired
        ? 'critical'
        : isLowStock && product.currentStock <= product.minStock * 0.25
        ? 'critical'
        : isLowStock || isExpiring
        ? 'warning'
        : 'info';

      const alertType: 'low_stock' | 'expiration' | 'expired' = isExpired
        ? 'expired'
        : isLowStock
        ? 'low_stock'
        : 'expiration';

      let message = '';
      if (isExpired) message = 'Producto vencido';
      else if (isExpiring && product.expirationDate) {
        const days = Math.ceil((new Date(product.expirationDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        message = days <= 1 ? 'Vence mañana' : `Vence en ${days} días`;
      }
      if (isLowStock) message = message ? `${message} - Stock bajo` : 'Stock bajo';

      alerts.push({
        id: `alert-${product.id}`,
        product,
        alertType,
        severity,
        message,
        createdAt: now.toISOString(),
      });
    }
  }

  return alerts.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

// ==================== KPI (computed) ====================
export async function fetchKPIData(): Promise<KPIData> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Today's sales
  const todaySalesResult = await db
    .select({ total: sql<string>`coalesce(sum(total::numeric), 0)` })
    .from(saleRecords)
    .where(sql`date::date = ${todayStr}`);
  const dailySales = numVal(todaySalesResult[0]?.total);

  // Yesterday's sales for comparison
  const yesterdaySalesResult = await db
    .select({ total: sql<string>`coalesce(sum(total::numeric), 0)` })
    .from(saleRecords)
    .where(sql`date::date = ${yesterdayStr}`);
  const yesterdaySales = numVal(yesterdaySalesResult[0]?.total);
  const dailySalesChange = yesterdaySales > 0
    ? Math.round(((dailySales - yesterdaySales) / yesterdaySales) * 100 * 10) / 10
    : 0;

  // Low stock count
  const lowStockResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(sql`current_stock < min_stock`);
  const lowStockProducts = Number(lowStockResult[0]?.count ?? 0);

  // Expiring within 7 days
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const expiringResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(
      and(
        sql`expiration_date is not null`,
        lte(products.expirationDate, sevenDaysLater.toISOString().split('T')[0]),
        gte(products.expirationDate, todayStr)
      )
    );
  const expiringProducts = Number(expiringResult[0]?.count ?? 0);

  // Merma rate (last 30 days merma value / inventory value)
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const mermaResult = await db
    .select({ total: sql<string>`coalesce(sum(value::numeric), 0)` })
    .from(mermaRecords)
    .where(gte(mermaRecords.date, thirtyDaysAgo));
  const totalMermaValue = numVal(mermaResult[0]?.total);

  const inventoryResult = await db
    .select({ total: sql<string>`coalesce(sum(unit_price::numeric * current_stock), 0)` })
    .from(products);
  const totalInventoryValue = numVal(inventoryResult[0]?.total);

  const mermaRate = totalInventoryValue > 0
    ? Math.round((totalMermaValue / totalInventoryValue) * 100 * 10) / 10
    : 0;

  return {
    dailySales,
    dailySalesChange,
    lowStockProducts,
    expiringProducts,
    mermaRate,
    mermaRateChange: 0,
  };
}

// ==================== SALES DATA (computed) ====================
export async function fetchSalesData(): Promise<SalesData[]> {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun

  const result: SalesData[] = [];

  for (let i = 0; i < 7; i++) {
    // Current week day
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - dayOfWeek + i);
    const currentDateStr = currentDate.toISOString().split('T')[0];

    // Previous week same day
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 7);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    const currentResult = await db
      .select({ total: sql<string>`coalesce(sum(total::numeric), 0)` })
      .from(saleRecords)
      .where(sql`date::date = ${currentDateStr}`);

    const prevResult = await db
      .select({ total: sql<string>`coalesce(sum(total::numeric), 0)` })
      .from(saleRecords)
      .where(sql`date::date = ${prevDateStr}`);

    result.push({
      date: days[i],
      currentWeek: numVal(currentResult[0]?.total),
      previousWeek: numVal(prevResult[0]?.total),
    });
  }

  return result;
}

// ==================== SALES ====================
export async function fetchSaleRecords(): Promise<SaleRecord[]> {
  const rows = await db.select().from(saleRecords).orderBy(desc(saleRecords.date));
  const records: SaleRecord[] = [];

  for (const row of rows) {
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, row.id));
    records.push({
      id: row.id,
      folio: row.folio,
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: numVal(item.unitPrice),
        subtotal: numVal(item.subtotal),
      })),
      subtotal: numVal(row.subtotal),
      iva: numVal(row.iva),
      cardSurcharge: numVal(row.cardSurcharge),
      total: numVal(row.total),
      paymentMethod: row.paymentMethod as 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado',
      amountPaid: numVal(row.amountPaid),
      change: numVal(row.change),
      date: row.date.toISOString(),
      cajero: row.cajero,
    });
  }

  return records;
}

export async function createSale(
  saleData: Omit<SaleRecord, 'id' | 'folio' | 'date'>
): Promise<SaleRecord> {
  const id = `sale-${Date.now()}`;
  const folio = await getNextFolio();
  const now = new Date();

  await db.insert(saleRecords).values({
    id,
    folio,
    subtotal: String(saleData.subtotal),
    iva: String(saleData.iva),
    cardSurcharge: String(saleData.cardSurcharge),
    total: String(saleData.total),
    paymentMethod: saleData.paymentMethod,
    amountPaid: String(saleData.amountPaid),
    change: String(saleData.change),
    cajero: saleData.cajero,
    date: now,
  });

  // Insert sale items
  for (const item of saleData.items) {
    await db.insert(saleItems).values({
      id: `si-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      saleId: id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      subtotal: String(item.subtotal),
    });
  }

  // Decrease stock for sold products
  for (const item of saleData.items) {
    await db
      .update(products)
      .set({
        currentStock: sql`greatest(0, current_stock - ${item.quantity})`,
        updatedAt: now,
      })
      .where(eq(products.id, item.productId));
  }

  return {
    ...saleData,
    id,
    folio,
    date: now.toISOString(),
  };
}

// ==================== MERMAS ====================
export async function fetchMermaRecords(): Promise<MermaRecord[]> {
  const rows = await db.select().from(mermaRecords).orderBy(desc(mermaRecords.date));
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    quantity: r.quantity,
    reason: r.reason as 'expiration' | 'damage' | 'spoilage' | 'other',
    date: r.date.toISOString(),
    value: numVal(r.value),
  }));
}

export async function createMerma(data: Omit<MermaRecord, 'id'>): Promise<MermaRecord> {
  const id = `merma-${Date.now()}`;
  await db.insert(mermaRecords).values({
    id,
    productId: data.productId,
    productName: data.productName,
    quantity: data.quantity,
    reason: data.reason,
    date: new Date(data.date),
    value: String(data.value),
  });

  // Decrease stock
  await db
    .update(products)
    .set({
      currentStock: sql`greatest(0, current_stock - ${data.quantity})`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, data.productId));

  return { ...data, id };
}

// ==================== PEDIDOS ====================
export async function fetchPedidos(): Promise<PedidoRecord[]> {
  const rows = await db.select().from(pedidos).orderBy(desc(pedidos.fecha));
  const records: PedidoRecord[] = [];

  for (const row of rows) {
    const items = await db.select().from(pedidoItems).where(eq(pedidoItems.pedidoId, row.id));
    records.push({
      id: row.id,
      proveedor: row.proveedor,
      productos: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        cantidad: item.cantidad,
      })),
      notas: row.notas,
      fecha: row.fecha.toISOString(),
      estado: row.estado as 'pendiente' | 'enviado' | 'recibido',
    });
  }

  return records;
}

export async function createPedido(
  data: Omit<PedidoRecord, 'id' | 'fecha' | 'estado'>
): Promise<PedidoRecord> {
  const id = `pedido-${Date.now()}`;
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
      id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

// ==================== CLIENTES ====================
export async function fetchClientes(): Promise<Cliente[]> {
  const rows = await db.select().from(clientes).orderBy(clientes.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    balance: numVal(r.balance),
    creditLimit: numVal(r.creditLimit),
    createdAt: r.createdAt.toISOString(),
    lastTransaction: r.lastTransaction?.toISOString() ?? null,
  }));
}

export async function createCliente(
  data: Omit<Cliente, 'id' | 'balance' | 'createdAt' | 'lastTransaction'>
): Promise<Cliente> {
  const id = `cli-${Date.now()}`;
  const now = new Date();

  await db.insert(clientes).values({
    id,
    name: data.name,
    phone: data.phone,
    address: data.address,
    balance: '0',
    creditLimit: String(data.creditLimit),
    createdAt: now,
    lastTransaction: null,
  });

  return {
    ...data,
    id,
    balance: 0,
    createdAt: now.toISOString(),
    lastTransaction: null,
  };
}

// ==================== FIADO ====================
export async function fetchFiadoTransactions(): Promise<FiadoTransaction[]> {
  const rows = await db.select().from(fiadoTransactions).orderBy(desc(fiadoTransactions.date));
  const results: FiadoTransaction[] = [];

  for (const r of rows) {
    // Load fiado items if this is a fiado transaction
    let loadedItems: SaleItem[] | undefined;
    if (r.type === 'fiado') {
      const itemRows = await db.select().from(fiadoItems).where(eq(fiadoItems.fiadoId, r.id));
      if (itemRows.length > 0) {
        loadedItems = itemRows.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: numVal(item.unitPrice),
          subtotal: numVal(item.subtotal),
        }));
      }
    }

    results.push({
      id: r.id,
      clienteId: r.clienteId,
      clienteName: r.clienteName,
      type: r.type as 'fiado' | 'abono',
      amount: numVal(r.amount),
      description: r.description,
      saleFolio: r.saleFolio ?? undefined,
      items: loadedItems,
      date: r.date.toISOString(),
    });
  }

  return results;
}

export async function createFiado(
  clienteId: string,
  amount: number,
  description: string,
  saleFolio?: string,
  items?: SaleItem[]
): Promise<void> {
  const now = new Date();
  const clienteRows = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!clienteRows.length) return;

  const cliente = clienteRows[0];
  const fiadoId = `fiado-${Date.now()}`;

  await db.insert(fiadoTransactions).values({
    id: fiadoId,
    clienteId,
    clienteName: cliente.name,
    type: 'fiado',
    amount: String(amount),
    description,
    saleFolio: saleFolio ?? null,
    date: now,
  });

  // Store fiado items (products that were bought on credit)
  if (items && items.length > 0) {
    for (const item of items) {
      await db.insert(fiadoItems).values({
        id: `fi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fiadoId,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        subtotal: String(item.subtotal),
      });
    }
  }

  await db
    .update(clientes)
    .set({
      balance: sql`balance::numeric + ${amount}`,
      lastTransaction: now,
    })
    .where(eq(clientes.id, clienteId));
}

export async function createAbono(
  clienteId: string,
  amount: number,
  description: string
): Promise<void> {
  const now = new Date();
  const clienteRows = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!clienteRows.length) return;

  const cliente = clienteRows[0];

  await db.insert(fiadoTransactions).values({
    id: `abono-${Date.now()}`,
    clienteId,
    clienteName: cliente.name,
    type: 'abono',
    amount: String(amount),
    description,
    date: now,
  });

  await db
    .update(clientes)
    .set({
      balance: sql`greatest(0, balance::numeric - ${amount})`,
      lastTransaction: now,
    })
    .where(eq(clientes.id, clienteId));
}

// ==================== GASTOS ====================
export async function fetchGastos(): Promise<Gasto[]> {
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
  const id = `gasto-${Date.now()}`;

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

// ==================== PROVEEDORES ====================
export async function fetchProveedores(): Promise<Proveedor[]> {
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
  const id = `prov-${Date.now()}`;

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

// ==================== CORTES DE CAJA ====================
export async function fetchCortesHistory(): Promise<CorteCaja[]> {
  const rows = await db.select().from(cortesCaja).orderBy(desc(cortesCaja.fecha));
  return rows.map((r) => ({
    id: r.id,
    fecha: r.fecha.toISOString(),
    cajero: r.cajero,
    ventasEfectivo: numVal(r.ventasEfectivo),
    ventasTarjeta: numVal(r.ventasTarjeta),
    ventasTransferencia: numVal(r.ventasTransferencia),
    ventasFiado: numVal(r.ventasFiado),
    totalVentas: numVal(r.totalVentas),
    totalTransacciones: r.totalTransacciones,
    efectivoEsperado: numVal(r.efectivoEsperado),
    efectivoContado: numVal(r.efectivoContado),
    diferencia: numVal(r.diferencia),
    fondoInicial: numVal(r.fondoInicial),
    gastosDelDia: numVal(r.gastosDelDia),
    notas: r.notas,
    status: r.status as 'abierto' | 'cerrado',
  }));
}

export async function createCorteCaja(data: {
  cajero: string;
  efectivoContado: number;
  fondoInicial: number;
  notas: string;
}): Promise<CorteCaja> {
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate from today's sales
  const salesRows = await db
    .select()
    .from(saleRecords)
    .where(sql`date::date = ${todayStr}`);

  const ventasEfectivo = salesRows
    .filter((s) => s.paymentMethod === 'efectivo')
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasTarjeta = salesRows
    .filter((s) => s.paymentMethod === 'tarjeta')
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasTransferencia = salesRows
    .filter((s) => s.paymentMethod === 'transferencia')
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const ventasFiado = salesRows
    .filter((s) => s.paymentMethod === 'fiado')
    .reduce((sum, s) => sum + numVal(s.total), 0);
  const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia + ventasFiado;
  const totalTransacciones = salesRows.length;

  // Today's expenses
  const gastosRows = await db
    .select()
    .from(gastos)
    .where(sql`fecha::date = ${todayStr}`);
  const gastosDelDia = gastosRows.reduce((sum, g) => sum + numVal(g.monto), 0);

  const efectivoEsperado = data.fondoInicial + ventasEfectivo - gastosDelDia;
  const diferencia = data.efectivoContado - efectivoEsperado;

  const corte: CorteCaja = {
    id: `corte-${Date.now()}`,
    fecha: new Date().toISOString(),
    cajero: data.cajero,
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    ventasFiado,
    totalVentas,
    totalTransacciones,
    efectivoEsperado,
    efectivoContado: data.efectivoContado,
    diferencia,
    fondoInicial: data.fondoInicial,
    gastosDelDia,
    notas: data.notas,
    status: 'cerrado',
  };

  await db.insert(cortesCaja).values({
    id: corte.id,
    fecha: new Date(),
    cajero: corte.cajero,
    ventasEfectivo: String(corte.ventasEfectivo),
    ventasTarjeta: String(corte.ventasTarjeta),
    ventasTransferencia: String(corte.ventasTransferencia),
    ventasFiado: String(corte.ventasFiado),
    totalVentas: String(corte.totalVentas),
    totalTransacciones: corte.totalTransacciones,
    efectivoEsperado: String(corte.efectivoEsperado),
    efectivoContado: String(corte.efectivoContado),
    diferencia: String(corte.diferencia),
    fondoInicial: String(corte.fondoInicial),
    gastosDelDia: String(corte.gastosDelDia),
    notas: corte.notas,
    status: corte.status,
  });

  return corte;
}

// ==================== EDITAR PRODUCTO ====================
export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.barcode !== undefined) updateData.barcode = data.barcode;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.costPrice !== undefined) updateData.costPrice = String(data.costPrice);
  if (data.unitPrice !== undefined) updateData.unitPrice = String(data.unitPrice);
  if (data.minStock !== undefined) updateData.minStock = data.minStock;
  if (data.currentStock !== undefined) updateData.currentStock = data.currentStock;
  if (data.isPerishable !== undefined) updateData.isPerishable = data.isPerishable;
  if (data.expirationDate !== undefined) updateData.expirationDate = data.expirationDate;
  await db.update(products).set(updateData).where(eq(products.id, id));
}

// ==================== EDITAR / ELIMINAR GASTO ====================
export async function updateGasto(id: string, data: Partial<Gasto>): Promise<void> {
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
  await db.delete(gastos).where(eq(gastos.id, id));
}

// ==================== EDITAR / ELIMINAR CLIENTE ====================
export async function updateCliente(id: string, data: Partial<Cliente>): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.creditLimit !== undefined) updateData.creditLimit = String(data.creditLimit);
  if (Object.keys(updateData).length > 0) {
    await db.update(clientes).set(updateData).where(eq(clientes.id, id));
  }
}

export async function deleteCliente(id: string): Promise<void> {
  // Delete related fiado transactions first
  await db.delete(fiadoTransactions).where(eq(fiadoTransactions.clienteId, id));
  await db.delete(clientes).where(eq(clientes.id, id));
}

// ==================== ACTUALIZAR ESTADO DE PEDIDO ====================
export async function updatePedidoStatus(id: string, estado: 'pendiente' | 'enviado' | 'recibido'): Promise<void> {
  await db.update(pedidos).set({ estado }).where(eq(pedidos.id, id));
}

// ==================== RECIBIR MERCANCÍA (pedido → stock) ====================
export async function receivePedido(pedidoId: string): Promise<void> {
  // Mark as received
  await db.update(pedidos).set({ estado: 'recibido' }).where(eq(pedidos.id, pedidoId));
  // Get pedido items and increase stock
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

// ==================== CANCELAR VENTA / DEVOLUCIÓN ====================
export async function cancelSale(saleId: string): Promise<void> {
  // Get sale items to reverse stock
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  for (const item of items) {
    await db
      .update(products)
      .set({
        currentStock: sql`current_stock + ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, item.productId));
  }
  // Delete sale items then sale record
  await db.delete(saleItems).where(eq(saleItems.saleId, saleId));
  await db.delete(saleRecords).where(eq(saleRecords.id, saleId));
}

// ==================== ELIMINAR PROVEEDOR ====================
export async function deleteProveedor(id: string): Promise<void> {
  await db.delete(proveedores).where(eq(proveedores.id, id));
}

// ==================== FULL DASHBOARD FETCH ====================
export async function fetchDashboardFromDB() {
  const [
    kpiData,
    allProducts,
    inventoryAlerts,
    salesData,
    saleRecordsList,
    mermaRecordsList,
    pedidosList,
    clientesList,
    fiadoList,
    gastosList,
    proveedoresList,
    cortesHistoryList,
    storeConfigData,
  ] = await Promise.all([
    fetchKPIData(),
    fetchAllProducts(),
    fetchInventoryAlerts(),
    fetchSalesData(),
    fetchSaleRecords(),
    fetchMermaRecords(),
    fetchPedidos(),
    fetchClientes(),
    fetchFiadoTransactions(),
    fetchGastos(),
    fetchProveedores(),
    fetchCortesHistory(),
    fetchStoreConfig(),
  ]);

  return {
    kpiData,
    products: allProducts,
    inventoryAlerts,
    salesData,
    saleRecords: saleRecordsList,
    mermaRecords: mermaRecordsList,
    pedidos: pedidosList,
    clientes: clientesList,
    fiadoTransactions: fiadoList,
    gastos: gastosList,
    proveedores: proveedoresList,
    cortesHistory: cortesHistoryList,
    storeConfig: storeConfigData,
  };
}

// ==================== ROLES Y PERMISOS ====================

// --- Role Definitions ---

async function seedSystemRoles(): Promise<void> {
  const existing = await db.select().from(roleDefinitions);
  if (existing.length > 0) return;

  const now = new Date();
  for (const role of DEFAULT_SYSTEM_ROLES) {
    await db.insert(roleDefinitions).values({
      id: crypto.randomUUID(),
      name: role.name,
      description: role.description,
      permissions: JSON.stringify(role.permissions),
      isSystem: role.isSystem,
      createdBy: role.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function mapRoleDef(r: typeof roleDefinitions.$inferSelect): RoleDefinition {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: JSON.parse(r.permissions) as PermissionKey[],
    isSystem: r.isSystem,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function fetchRoleDefinitions(): Promise<RoleDefinition[]> {
  await seedSystemRoles();
  const rows = await db.select().from(roleDefinitions).orderBy(roleDefinitions.createdAt);
  return rows.map(mapRoleDef);
}

export async function createRoleDefinition(
  data: { name: string; description: string; permissions: PermissionKey[] },
  createdByUid: string
): Promise<RoleDefinition> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(roleDefinitions).values({
    id,
    name: data.name,
    description: data.description,
    permissions: JSON.stringify(data.permissions),
    isSystem: false,
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    isSystem: false,
    createdBy: createdByUid,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function updateRoleDefinition(
  id: string,
  data: { name?: string; description?: string; permissions?: PermissionKey[] }
): Promise<void> {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.permissions !== undefined) updates.permissions = JSON.stringify(data.permissions);
  await db.update(roleDefinitions).set(updates).where(eq(roleDefinitions.id, id));
}

export async function deleteRoleDefinition(id: string): Promise<void> {
  // Only allow deleting non-system roles
  const rows = await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, id));
  if (rows.length > 0 && rows[0].isSystem) {
    throw new Error('No se pueden eliminar roles del sistema');
  }
  await db.delete(roleDefinitions).where(eq(roleDefinitions.id, id));
}

// --- User Role Assignments ---

function mapUserRole(r: typeof userRoles.$inferSelect): UserRoleRecord {
  return {
    id: r.id,
    firebaseUid: r.firebaseUid,
    email: r.email,
    displayName: r.displayName,
    roleId: r.roleId,
    assignedBy: r.assignedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function fetchUserRoles(): Promise<UserRoleRecord[]> {
  const rows = await db.select().from(userRoles).orderBy(userRoles.createdAt);
  return rows.map(mapUserRole);
}

export async function getUserRoleByUid(firebaseUid: string): Promise<UserRoleRecord | null> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.firebaseUid, firebaseUid));
  if (rows.length === 0) return null;
  return mapUserRole(rows[0]);
}

export async function ensureOwnerRole(firebaseUid: string, email: string, displayName: string): Promise<UserRoleRecord> {
  // Ensure system roles exist
  await seedSystemRoles();

  // Get owner role definition
  const allDefs = await db.select().from(roleDefinitions);
  const ownerDef = allDefs.find(d => d.isSystem && d.name === 'Propietario');
  const viewerDef = allDefs.find(d => d.isSystem && d.name === 'Solo lectura');

  if (!ownerDef || !viewerDef) throw new Error('System roles not found');

  const existing = await db.select().from(userRoles);

  // If no user roles exist at all, make this user the owner
  if (existing.length === 0) {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(userRoles).values({
      id,
      firebaseUid,
      email,
      displayName: displayName || '',
      roleId: ownerDef.id,
      assignedBy: firebaseUid,
      createdAt: now,
      updatedAt: now,
    });
    return {
      id, firebaseUid, email, displayName: displayName || '',
      roleId: ownerDef.id, assignedBy: firebaseUid,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    };
  }

  // Check if this user already has a role
  const userRow = existing.find((r) => r.firebaseUid === firebaseUid);
  if (userRow) return mapUserRole(userRow);

  // New user with no role — assign viewer
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(userRoles).values({
    id,
    firebaseUid,
    email,
    displayName: displayName || '',
    roleId: viewerDef.id,
    assignedBy: 'system',
    createdAt: now,
    updatedAt: now,
  });
  return {
    id, firebaseUid, email, displayName: displayName || '',
    roleId: viewerDef.id, assignedBy: 'system',
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
}

export async function assignUserRole(
  data: { firebaseUid: string; email: string; displayName: string; roleId: string },
  assignedByUid: string
): Promise<UserRoleRecord> {
  const existingRows = await db.select().from(userRoles).where(eq(userRoles.firebaseUid, data.firebaseUid));

  if (existingRows.length > 0) {
    const now = new Date();
    await db.update(userRoles)
      .set({ roleId: data.roleId, displayName: data.displayName, email: data.email, updatedAt: now, assignedBy: assignedByUid })
      .where(eq(userRoles.firebaseUid, data.firebaseUid));
    return {
      id: existingRows[0].id, firebaseUid: data.firebaseUid,
      email: data.email, displayName: data.displayName,
      roleId: data.roleId, assignedBy: assignedByUid,
      createdAt: existingRows[0].createdAt.toISOString(), updatedAt: now.toISOString(),
    };
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(userRoles).values({
    id, firebaseUid: data.firebaseUid, email: data.email,
    displayName: data.displayName || '', roleId: data.roleId,
    assignedBy: assignedByUid, createdAt: now, updatedAt: now,
  });
  return {
    id, firebaseUid: data.firebaseUid, email: data.email,
    displayName: data.displayName || '', roleId: data.roleId,
    assignedBy: assignedByUid, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
}

export async function updateUserRole(
  firebaseUid: string,
  newRoleId: string,
  assignedByUid: string
): Promise<void> {
  const now = new Date();
  await db.update(userRoles)
    .set({ roleId: newRoleId, updatedAt: now, assignedBy: assignedByUid })
    .where(eq(userRoles.firebaseUid, firebaseUid));
}

export async function removeUserRole(firebaseUid: string): Promise<void> {
  await db.delete(userRoles).where(eq(userRoles.firebaseUid, firebaseUid));
}
