'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Card,
    IndexTable,
    Text,
    Badge,
    BlockStack,
    InlineStack,
    Button,
    TextField,
    Icon,
    Banner,
    Layout,
    Divider,
} from '@shopify/polaris';
import { SearchIcon, CheckIcon, AlertIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { getInventoryAudit, saveAuditItem, completeInventoryAudit } from '@/app/actions/db-actions';
import type { InventoryAudit, InventoryAuditItem } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';

interface AuditSessionProps {
    auditId: string;
    onClose: () => void;
}

export function AuditSession({ auditId, onClose }: AuditSessionProps) {
    const { products, refreshAllData } = useDashboardStore();
    const { showSuccess, showError } = useToast();
    const [audit, setAudit] = useState<InventoryAudit | null>(null);
    const [counts, setCounts] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function loadAudit() {
            const data = await getInventoryAudit(auditId);
            if (data) {
                setAudit(data);
                // Pre-fill counts if draft
                const initialCounts: Record<string, string> = {};
                data.items?.forEach(item => {
                    initialCounts[item.productId] = item.countedStock.toString();
                });
                setCounts(initialCounts);
            }
        }
        loadAudit();
    }, [auditId]);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery)
    );

    const handleFinishAudit = useCallback(async () => {
        setIsSubmitting(true);
        try {
            // 1. Save all items
            for (const product of products) {
                const counted = parseInt(counts[product.id] || '0', 10);
                const expected = product.currentStock;
                const diff = counted - expected;
                const adjValue = diff * product.unitPrice;

                await saveAuditItem({
                    auditId,
                    productId: product.id,
                    productName: product.name,
                    expectedStock: expected,
                    countedStock: counted,
                    difference: diff,
                    adjustmentValue: adjValue,
                });
            }

            // 2. Complete audit (updates stock in DB)
            await completeInventoryAudit(auditId);
            showSuccess('Auditoría completada y stock ajustado correctamente');
            await refreshAllData();
            onClose();
        } catch (error) {
            console.error(error);
            showError('Error al completar la auditoría');
        } finally {
            setIsSubmitting(false);
        }
    }, [auditId, products, counts, showSuccess, showError, refreshAllData, onClose]);

    if (!audit) return <div style={{ padding: '20px' }}><Text as="p">Cargando...</Text></div>;

    const isCompleted = audit.status === 'completed';

    const rowMarkup = isCompleted
        ? (audit.items || []).map((item, index) => (
            <IndexTable.Row id={item.id} key={item.id} position={index}>
                <IndexTable.Cell><Text as="p" fontWeight="bold">{item.productName}</Text></IndexTable.Cell>
                <IndexTable.Cell>{item.expectedStock}</IndexTable.Cell>
                <IndexTable.Cell>{item.countedStock}</IndexTable.Cell>
                <IndexTable.Cell>
                    <Text as="p" tone={item.difference < 0 ? 'critical' : item.difference > 0 ? 'success' : 'subdued'}>
                        {item.difference > 0 ? `+${item.difference}` : item.difference}
                    </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{formatCurrency(item.adjustmentValue)}</IndexTable.Cell>
            </IndexTable.Row>
        ))
        : filteredProducts.map((product, index) => (
            <IndexTable.Row id={product.id} key={product.id} position={index}>
                <IndexTable.Cell>
                    <BlockStack gap="050">
                        <Text as="p" fontWeight="bold">{product.name}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">{product.sku}</Text>
                    </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <Badge tone="info">Ciego</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <TextField
                        label="Contado"
                        labelHidden
                        type="number"
                        value={counts[product.id] || ''}
                        onChange={(val) => setCounts(prev => ({ ...prev, [product.id]: val }))}
                        autoComplete="off"
                    />
                </IndexTable.Cell>
            </IndexTable.Row>
        ));

    return (
        <BlockStack gap="400">
            <Banner
                tone={isCompleted ? 'success' : 'info'}
                title={`${isCompleted ? 'Resultado de Auditoría:' : 'Auditoría en Curso:'} ${audit.title}`}
                onDismiss={onClose}
            >
                <p>{isCompleted ? 'Esta auditoría ha sido finalizada y los ajustes de inventario aplicados.' : 'Ingresa las cantidades reales que encontraste físicamente en el almacén.'}</p>
            </Banner>

            {!isCompleted && (
                <Card>
                    <TextField
                        label="Buscar producto"
                        value={searchQuery}
                        onChange={setSearchQuery}
                        prefix={<Icon source={SearchIcon} />}
                        autoComplete="off"
                        placeholder="Nombre, SKU o Código..."
                    />
                </Card>
            )}

            <Card padding="0">
                <IndexTable
                    itemCount={isCompleted ? audit.items?.length || 0 : filteredProducts.length}
                    headings={isCompleted ? [
                        { title: 'Producto' },
                        { title: 'Esperado' },
                        { title: 'Contado' },
                        { title: 'Diferencia' },
                        { title: 'Valor de Ajuste' },
                    ] : [
                        { title: 'Producto' },
                        { title: 'Sist.' },
                        { title: 'Físico (Tu conteo)' },
                    ]}
                    selectable={false}
                >
                    {rowMarkup}
                </IndexTable>
            </Card>

            {!isCompleted && (
                <InlineStack align="end" gap="400">
                    <Button onClick={onClose}>Continuar después (Guardar Borrador)</Button>
                    <Button
                        variant="primary"
                        tone="success"
                        loading={isSubmitting}
                        onClick={handleFinishAudit}
                        icon={CheckIcon}
                    >
                        Finalizar y Ajustar Stock
                    </Button>
                </InlineStack>
            )}

            {isCompleted && (
                <InlineStack align="center">
                    <Button onClick={onClose}>Volver al Listado</Button>
                </InlineStack>
            )}
        </BlockStack>
    );
}
