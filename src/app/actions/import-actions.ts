'use server';

import { requirePermission, AuthError } from '@/lib/auth/guard';
import { db } from '@/db';
import { products } from '@/db/schema';
import { parse } from 'csv-parse/sync';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { sanitize, validateNumber } from '@/lib/auth/guard';

const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export async function importProductsFromCSV(formData: FormData, overwrite: boolean, publish: boolean) {
    try {
        await requirePermission('inventory.edit');

        const file = formData.get('file') as File;
        if (!file) throw new Error('No se encontró archivo para importar');

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileString = fileBuffer.toString('utf-8');

        // 1. Upload to AWS as a backup temporarily (and then we "forget" about it)
        const key = `imports/import_${Date.now()}_${file.name}`;
        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET!,
                Key: key,
                Body: fileBuffer,
                ContentType: 'text/csv',
            })
        );

        // 2. Parse CSV
        const records = parse(fileString, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        if (records.length === 0) {
            throw new Error('El archivo CSV está vacío o no tiene el formato correcto');
        }

        // 3. Process Records
        let addedCount = 0;
        let updatedCount = 0;
        const errors: string[] = [];

        const existingProducts = await db.select().from(products);
        const existingMap = new Map(existingProducts.map(p => [p.barcode, p]));

        for (const [index, row] of records.entries()) {
            try {
                const barcode = row['Codigo_Barras'] || row['Barcode'];
                const name = row['Producto'] || row['Title'];
                const sku = row['SKU'] || `IMP-${Date.now()}-${index}`;
                const category = row['Categoria'] || row['Product category'] || 'General';
                const costPrice = String(parseFloat(row['Precio_Costo'] || row['Cost per item'] || '0'));
                const unitPrice = String(parseFloat(row['Precio_Venta'] || row['Price'] || '0'));
                const currentStock = parseInt(row['Stock_Actual'] || row['Inventory quantity'] || '0', 10);
                const minStock = parseInt(row['Stock_Minimo'] || '5', 10);
                const expDateRaw = row['Fecha_Caducidad_YYYY_MM_DD'];
                let expirationDate = null;
                if (expDateRaw && expDateRaw.length === 10) {
                    expirationDate = new Date(`${expDateRaw}T12:00:00Z`);
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
                        }).where(eq(products.id, existingProduct.id));
                        updatedCount++;
                    }
                } else {
                    const newId = `p${Date.now()}${index}`;
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
                    });
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
