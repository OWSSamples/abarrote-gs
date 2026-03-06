'use client';

import { useState, useCallback } from 'react';
import {
    Card,
    IndexTable,
    Text,
    Badge,
    BlockStack,
    InlineStack,
    Button,
    EmptyState,
    Modal,
    TextField,
    FormLayout,
} from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { AuditSession } from './AuditSession';

export function InventoryAuditView() {
    const { inventoryAudits, currentUserRole, createInventoryAudit } = useDashboardStore();
    const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');

    const handleCreateAudit = useCallback(async () => {
        if (!title) return;
        const id = await createInventoryAudit({
            title,
            auditor: currentUserRole?.displayName || 'Desconocido',
            notes,
        });
        setActiveAuditId(id);
        setCreateModalOpen(false);
        setTitle('');
        setNotes('');
    }, [title, notes, currentUserRole, createInventoryAudit]);

    if (activeAuditId) {
        return (
            <AuditSession
                auditId={activeAuditId}
                onClose={() => setActiveAuditId(null)}
            />
        );
    }

    const rowMarkup = inventoryAudits.map((audit, index) => (
        <IndexTable.Row id={audit.id} key={audit.id} position={index}>
            <IndexTable.Cell>
                <Text as="span" fontWeight="bold">{audit.title}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{new Date(audit.date).toLocaleDateString()}</IndexTable.Cell>
            <IndexTable.Cell>{audit.auditor}</IndexTable.Cell>
            <IndexTable.Cell>
                <Badge tone={audit.status === 'completed' ? 'success' : 'attention'}>
                    {audit.status === 'completed' ? 'Completada' : 'Borrador'}
                </Badge>
            </IndexTable.Cell>
            <IndexTable.Cell>
                <Button
                    variant="plain"
                    onClick={() => setActiveAuditId(audit.id)}
                >
                    {audit.status === 'completed' ? 'Ver Detalles' : 'Continuar'}
                </Button>
            </IndexTable.Cell>
        </IndexTable.Row>
    ));

    return (
        <BlockStack gap="400">
            <Card>
                <BlockStack gap="400">
                    <InlineStack align="space-between">
                        <BlockStack gap="100">
                            <Text as="h2" variant="headingMd">Auditorías de Inventario</Text>
                            <Text as="p" variant="bodySm" tone="subdued">Gestiona revisiones ciegas y ajustes de stock</Text>
                        </BlockStack>
                        <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                            Nueva Auditoría
                        </Button>
                    </InlineStack>

                    {inventoryAudits.length === 0 ? (
                        <EmptyState
                            heading="No hay auditorías registradas"
                            image=""
                        >
                            <p>Inicia una auditoría para verificar la precisión de tu inventario físico.</p>
                        </EmptyState>
                    ) : (
                        <IndexTable
                            itemCount={inventoryAudits.length}
                            headings={[
                                { title: 'Título' },
                                { title: 'Fecha' },
                                { title: 'Auditor' },
                                { title: 'Estado' },
                                { title: '' },
                            ]}
                            selectable={false}
                        >
                            {rowMarkup}
                        </IndexTable>
                    )}
                </BlockStack>
            </Card>

            <Modal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                title="Iniciar Nueva Auditoría"
                primaryAction={{
                    content: 'Iniciar',
                    onAction: handleCreateAudit,
                    disabled: !title,
                }}
                secondaryActions={[{ content: 'Cancelar', onAction: () => setCreateModalOpen(false) }]}
            >
                <Modal.Section>
                    <FormLayout>
                        <TextField
                            label="Título de la Auditoría"
                            value={title}
                            onChange={setTitle}
                            placeholder="Ej. Conte Mensual Marzo 2024"
                            autoComplete="off"
                        />
                        <TextField
                            label="Notas"
                            value={notes}
                            onChange={setNotes}
                            multiline={3}
                            autoComplete="off"
                        />
                    </FormLayout>
                </Modal.Section>
            </Modal>
        </BlockStack>
    );
}
