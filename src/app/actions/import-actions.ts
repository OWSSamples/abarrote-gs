'use server';

import { requirePermission, AuthError, sanitize, validateNumber } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { db } from '@/db';
import { products, clientes } from '@/db/schema';
import { parse } from 'csv-parse/sync';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { isNotDeleted } from '@/infrastructure/soft-delete';

const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

async function _importProductsFromCSV(formData: FormData, overwrite: boolean, publish: boolean) {
    try {
        await requirePermission('inventory.edit');

        const file = formData.get('file') as File;
        if (!file) throw new Error('No se encontró archivo para importar');

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileString = fileBuffer.toString('utf-8');

        // Parse CSV
        const records = parse(fileString, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        if (records.length === 0) {
            throw new Error('El archivo CSV está vacío o no tiene el formato correcto');
        }

        // Process Records
        let addedCount = 0;
        let updatedCount = 0;
        const errors: string[] = [];

        const existingProducts = await db.select().from(products).where(isNotDeleted(products));
        const existingMap = new Map(existingProducts.map(p => [p.barcode, p]));

        for (const [index, rowData] of (records as any[]).entries()) {
            try {
                const row = rowData as Record<string, string>;
                const barcode = row['Codigo_Barras'] || row['Barcode'];
                const name = row['Producto'] || row['Title'];
                const sku = row['SKU'] || `IMP-${crypto.randomUUID().slice(0, 8)}`;
                const category = row['Categoria'] || row['Product category'] || 'General';
                const costPrice = String(parseFloat(row['Precio_Costo'] || row['Cost per item'] || '0'));
                const unitPrice = String(parseFloat(row['Precio_Venta'] || row['Price'] || '0'));
                const currentStock = parseInt(row['Stock_Actual'] || row['Inventory quantity'] || '0', 10);
                const minStock = parseInt(row['Stock_Minimo'] || '5', 10);
                const expDateRaw = row['Fecha_Caducidad_YYYY_MM_DD'];
                let expirationDate: string | null = null;
                if (expDateRaw && expDateRaw.length === 10) {
                    expirationDate = expDateRaw;
                }

                if (!name || !barcode) {
                    throw new Error(`Fila ${index + 2}: Nombre del producto y Código de barras son obligatorios.`);
                }

                const existingProduct = existingMap.get(barcode);

                if (existingProduct) {
                    if (overwrite) {
                        await db.update(products).set({
                            name: sanitize(name),
                            sku: sanitize(sku),
                            category: sanitize(category),
                            costPrice,
                            unitPrice,
                            currentStock: validateNumber(currentStock, { label: 'Stock' }),
                            minStock: validateNumber(minStock, { label: 'Stock mínimo' }),
                            expirationDate,
                            updatedAt: new Date(),
                        } as any).where(eq(products.id, existingProduct.id));
                        updatedCount++;
                    }
                } else {
                    const newId = `p-${crypto.randomUUID()}`;
                    await db.insert(products).values({
                        id: newId,
                        name: sanitize(name),
                        sku: sanitize(sku),
                        barcode: sanitize(barcode),
                        currentStock: validateNumber(currentStock, { label: 'Stock' }),
                        minStock: validateNumber(minStock, { label: 'Stock mínimo' }),
                        expirationDate,
                        category: sanitize(category),
                        costPrice,
                        unitPrice,
                        isPerishable: !!expirationDate,
                    } as any);
                    addedCount++;
                }
            } catch (err: any) {
                errors.push(err.message);
            }
        }

        return {
            success: true,
            added: addedCount,
            updated: updatedCount,
            errors,
            message: `Importación completada. Se agregaron ${addedCount} y se actualizaron ${updatedCount} productos.`
        };

    } catch (error: any) {
        console.error('Import Error:', error);
        return {
            success: false,
            message: error.message || 'Error desconocido al importar el archivo CSV'
        };
    }
}

async function _importCustomersFromCSV(formData: FormData) {
    try {
        await requirePermission('customers.edit');

        const file = formData.get('file') as File;
        if (!file) throw new Error('No se encontró archivo para importar');

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileString = fileBuffer.toString('utf-8');

        // Parse CSV
        const records = parse(fileString, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        if (records.length === 0) {
            throw new Error('El archivo CSV está vacío.');
        }

        // Validate mandatory headers (Shopify style)
        const firstRecord = records[0] as Record<string, string>;
        const headers = Object.keys(firstRecord);
        const hasId = headers.some(h => h.toLowerCase() === 'customer id');
        const hasEmail = headers.some(h => h.toLowerCase() === 'email');
        const hasPhone = headers.some(h => h.toLowerCase() === 'phone');

        if (!hasId && !hasEmail && !hasPhone) {
            throw new Error('Falta un encabezado obligatorio. Debe estar presente al menos uno de los siguientes encabezados: Customer ID, Email, Phone.');
        }

        let addedCount = 0;
        const errors: string[] = [];

        for (const [index, rowData] of (records as any[]).entries()) {
            try {
                const row = rowData as Record<string, string>;
                const firstName = row['First Name'] || '';
                const lastName = row['Last Name'] || '';
                const name = row['Name'] || `${firstName} ${lastName}`.trim() || row['Email'] || row['Phone'];
                const phone = row['Phone'] || '';
                const email = row['Email'] || '';
                const address = row['Address1'] || row['Address'] || '';

                if (!name) {
                    throw new Error(`Fila ${index + 2}: No se pudo determinar el nombre del cliente.`);
                }

                const id = `cli-${crypto.randomUUID()}`;
                await db.insert(clientes).values({
                    id,
                    name: sanitize(name),
                    phone: sanitize(phone),
                    address: sanitize(address),
                    balance: '0',
                    creditLimit: '500',
                    points: '0',
                    createdAt: new Date(),
                } as any);
                addedCount++;
            } catch (err: any) {
                errors.push(err.message);
            }
        }

        return {
            success: true,
            added: addedCount,
            errors,
            message: `Importación completada. Se agregaron ${addedCount} clientes.`
        };

    } catch (error: any) {
        console.error('Customer Import Error:', error);
        return {
            success: false,
            message: error.message || 'Error desconocido al importar clientes'
        };
    }
}

export const importProductsFromCSV = withLogging('import.importProductsFromCSV', _importProductsFromCSV);
export const importCustomersFromCSV = withLogging('import.importCustomersFromCSV', _importCustomersFromCSV);
