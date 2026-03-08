'use client';

import {
    Page,
    Layout,
    Card,
    BlockStack,
    InlineStack,
    Text,
    Button,
    Box,
    Badge,
    Divider,
    Icon,
    TextField,
    Grid,
    ButtonProps,
    InlineGrid,
} from '@shopify/polaris';
import {
    PersonIcon,
    EditIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    SettingsIcon,
    EmailIcon,
    PhoneIcon,
    CalendarIcon,
    SearchIcon,
    ChatIcon,
    NoteIcon,
    TaxIcon,
    CreditCardIcon,
    PlusIcon,
    DeleteIcon,
    ImportIcon,
    ArchiveIcon,
    CashDollarIcon,
} from '@shopify/polaris-icons';
import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { Cliente, FiadoTransaction } from '@/types';

interface CustomerProfileProps {
    cliente: Cliente;
    transactions: FiadoTransaction[];
    onBack: () => void;
}

export function CustomerProfile({ cliente, transactions, onBack }: CustomerProfileProps) {
    const [comment, setComment] = useState('');

    const stats = useMemo(() => {
        // In a real app, these would come from the database
        // Here we estimate from transactions and profile
        const totalSpent = transactions
            .filter(t => t.type === 'fiado' && t.saleFolio)
            .reduce((sum, t) => sum + t.amount, 0);

        const ordersCount = new Set(transactions.map(t => t.saleFolio).filter(Boolean)).size;

        // Calculate time since creation
        const createdDate = new Date(cliente.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - createdDate.getTime();
        const diffSec = Math.floor(diffMs / 1000);

        let timeSince = "Menos de 5 segundos";
        if (diffSec > 60) timeSince = `${Math.floor(diffSec / 60)} minutos`;
        if (diffSec > 3600) timeSince = `${Math.floor(diffSec / 3600)} horas`;
        if (diffSec > 86400) timeSince = `${Math.floor(diffSec / 86400)} días`;

        return {
            totalSpent,
            ordersCount,
            timeSince,
            rfmGroup: '—'
        };
    }, [cliente, transactions]);

    return (
        <Page
            fullWidth
            backAction={{ content: 'Clientes', onAction: onBack }}
            title={cliente.name.toUpperCase()}
            titleMetadata={<Icon source={PersonIcon} tone="subdued" />}
            actionGroups={[
                {
                    title: 'Más acciones',
                    actions: [
                        {
                            content: 'Emitir crédito en tienda',
                            icon: CashDollarIcon,
                            onAction: () => console.log('Emitir crédito'),
                        },
                        {
                            content: 'Fusionar cliente',
                            icon: PersonIcon,
                            onAction: () => console.log('Fusionar'),
                        },
                        {
                            content: 'Solicitar datos del cliente',
                            icon: ImportIcon,
                            onAction: () => console.log('Solicitar datos'),
                        },
                        {
                            content: 'Suprimir datos personales',
                            icon: ArchiveIcon,
                            onAction: () => console.log('Suprimir datos'),
                        },
                        {
                            content: 'Eliminar cliente',
                            icon: DeleteIcon,
                            destructive: true,
                            onAction: () => console.log('Eliminar cliente'),
                        },
                    ],
                },
            ]}
            pagination={{
                hasPrevious: true,
                hasNext: true,
            }}
        >
            <BlockStack gap="400">
                {/* Top Stats Bar */}
                <Card padding="400">
                    <InlineGrid columns={4} gap="400">
                        <BlockStack gap="100">
                            <Text as="h3" variant="bodySm" fontWeight="regular" tone="subdued">Importe gastado</Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{formatCurrency(stats.totalSpent)}</Text>
                        </BlockStack>
                        <BlockStack gap="100">
                            <Text as="h3" variant="bodySm" fontWeight="regular" tone="subdued">Pedidos</Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{stats.ordersCount}</Text>
                        </BlockStack>
                        <BlockStack gap="100">
                            <Text as="h3" variant="bodySm" fontWeight="regular" tone="subdued">Cliente desde</Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{stats.timeSince}</Text>
                        </BlockStack>
                        <BlockStack gap="100">
                            <Text as="h3" variant="bodySm" fontWeight="regular" tone="subdued">Grupo RFM</Text>
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{stats.rfmGroup}</Text>
                        </BlockStack>
                    </InlineGrid>
                </Card>

                <Layout>
                    {/* Main Column */}
                    <Layout.Section>
                        <BlockStack gap="400">
                            {/* Last Order Section */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text as="h2" variant="headingSm">Último pedido realizado</Text>
                                    <Box padding="400" borderStyle="dashed" borderWidth="025" borderColor="border-secondary" borderRadius="200">
                                        <BlockStack gap="400" align="center">
                                            <Box maxWidth="80px">
                                                {/* Inline placeholder for illustration */}
                                                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <rect width="100" height="100" rx="10" fill="#f4f6f8" />
                                                    <path d="M30 40H70V70H30V40Z" fill="#dfe3e8" />
                                                    <rect x="35" y="45" width="30" height="2" fill="#c4cdd5" />
                                                    <rect x="35" y="50" width="20" height="2" fill="#c4cdd5" />
                                                </svg>
                                            </Box>
                                            <Text as="p" tone="subdued">Este cliente aún no ha realizado ningún pedido</Text>
                                            <Button>Crear pedido</Button>
                                        </BlockStack>
                                    </Box>
                                </BlockStack>
                            </Card>

                            {/* Timeline Section */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text as="h2" variant="headingSm">Cronología</Text>

                                    {/* Comment Input Box */}
                                    <Box
                                        background="bg-surface-secondary"
                                        padding="400"
                                        borderRadius="200"
                                        borderWidth="025"
                                        borderColor="border"
                                        borderStyle="solid"
                                    >
                                        <BlockStack gap="300">
                                            <TextField
                                                label="Deja un comentario..."
                                                labelHidden
                                                value={comment}
                                                onChange={setComment}
                                                multiline={2}
                                                placeholder="Deja un comentario..."
                                                autoComplete="off"
                                                prefix={<Icon source={ChatIcon} tone="subdued" />}
                                            />
                                            <InlineStack align="space-between">
                                                <InlineStack gap="200">
                                                    <Button variant="tertiary" icon={EditIcon} size="slim" />
                                                    <Button variant="tertiary" icon={PlusIcon} size="slim" />
                                                </InlineStack>
                                                <Button disabled={!comment.trim()}>Publicar</Button>
                                            </InlineStack>
                                        </BlockStack>
                                    </Box>

                                    {/* Timeline Feed */}
                                    <div style={{ paddingLeft: '12px', borderLeft: '1px solid #e1e3e5', marginLeft: '12px', marginTop: '20px' }}>
                                        <BlockStack gap="400">
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '-17px',
                                                    top: '4px',
                                                    width: '9px',
                                                    height: '9px',
                                                    borderRadius: '50%',
                                                    background: '#5c5f62'
                                                }} />
                                                <InlineStack align="space-between">
                                                    <BlockStack gap="050">
                                                        <Text as="span" variant="bodySm" tone="subdued">Hoy</Text>
                                                        <Text as="span" variant="bodyMd">Tú has creado este cliente.</Text>
                                                    </BlockStack>
                                                    <Text as="span" variant="bodySm" tone="subdued">Ahora mismo</Text>
                                                </InlineStack>
                                            </div>
                                        </BlockStack>
                                    </div>

                                    <Box padding="200">
                                        <Text as="p" variant="bodySm" tone="subdued">
                                            Solo tú y otros empleados pueden ver los comentarios
                                        </Text>
                                    </Box>
                                </BlockStack>
                            </Card>
                        </BlockStack>
                    </Layout.Section>

                    {/* Sidebar Column */}
                    <Layout.Section variant="oneThird">
                        <BlockStack gap="400">
                            {/* Contact Info Card */}
                            <Card>
                                <BlockStack gap="300">
                                    <InlineStack align="space-between">
                                        <Text as="h2" variant="headingSm">Cliente</Text>
                                        <Button variant="tertiary" icon={ChevronDownIcon} size="slim" />
                                    </InlineStack>

                                    <BlockStack gap="200">
                                        <Text as="h3" variant="bodySm" fontWeight="semibold">Información de contacto</Text>
                                        <BlockStack gap="100">
                                            <Text as="p" variant="bodyMd" tone="success">{(cliente as any).email || 'Sin correo'}</Text>
                                            <Text as="p" variant="bodyMd">{cliente.phone || 'Sin teléfono'}</Text>
                                            <Text as="p" variant="bodySm" tone="subdued">Recibirás notificaciones en Español</Text>
                                        </BlockStack>
                                    </BlockStack>

                                    <Divider />

                                    <BlockStack gap="200">
                                        <Text as="h3" variant="bodySm" fontWeight="semibold">Dirección predeterminada</Text>
                                        <BlockStack gap="050">
                                            <Text as="p" variant="bodyMd">{cliente.name}</Text>
                                            <Text as="p" variant="bodyMd">{cliente.address || 'Sin dirección'}</Text>
                                            <Text as="p" variant="bodyMd">México</Text>
                                        </BlockStack>
                                    </BlockStack>

                                    <Divider />

                                    <BlockStack gap="200">
                                        <Text as="h3" variant="bodySm" fontWeight="semibold">Marketing</Text>
                                        <InlineStack gap="200">
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#008060' }} />
                                            <Text as="span" variant="bodySm">Correo electrónico suscrito</Text>
                                        </InlineStack>
                                        <InlineStack gap="200">
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#008060' }} />
                                            <Text as="span" variant="bodySm">SMS suscrito</Text>
                                        </InlineStack>
                                    </BlockStack>

                                    <Divider />

                                    <BlockStack gap="200">
                                        <Text as="h3" variant="bodySm" fontWeight="semibold">Información fiscal</Text>
                                        <Text as="p" variant="bodyMd">Recaudar impuestos</Text>
                                    </BlockStack>
                                </BlockStack>
                            </Card>

                            {/* Store Credit Card */}
                            <Card>
                                <BlockStack gap="200">
                                    <InlineStack align="space-between">
                                        <Text as="h2" variant="headingSm">Saldo disponible (Puntos)</Text>
                                        <Icon source={EditIcon} tone="subdued" />
                                    </InlineStack>
                                    <Text as="p" variant="bodyMd" fontWeight="semibold" tone="success">
                                        {cliente.points || 0} pts
                                    </Text>
                                </BlockStack>
                            </Card>

                            {/* Fiado / Credit Card */}
                            <Card>
                                <BlockStack gap="200">
                                    <InlineStack align="space-between">
                                        <Text as="h2" variant="headingSm">Crédito en tienda (Fiado)</Text>
                                        <Icon source={EditIcon} tone="subdued" />
                                    </InlineStack>
                                    <Text as="p" variant="bodyMd" tone={cliente.balance > 0 ? 'critical' : 'subdued'}>
                                        {cliente.balance > 0 ? `Debe ${formatCurrency(cliente.balance)}` : 'Ninguno'}
                                    </Text>
                                </BlockStack>
                            </Card>

                            {/* Tags Card */}
                            <Card>
                                <BlockStack gap="200">
                                    <InlineStack align="space-between">
                                        <Text as="h2" variant="headingSm">Etiquetas</Text>
                                        <Icon source={EditIcon} tone="subdued" />
                                    </InlineStack>
                                    <Box background="bg-surface-secondary" padding="200" borderRadius="100" minHeight="40px">
                                        <Text as="p" variant="bodySm" tone="subdued">Sin etiquetas</Text>
                                    </Box>
                                </BlockStack>
                            </Card>

                            {/* Notes Card */}
                            <Card>
                                <BlockStack gap="200">
                                    <InlineStack align="space-between">
                                        <Text as="h2" variant="headingSm">Notas</Text>
                                        <Icon source={EditIcon} tone="subdued" />
                                    </InlineStack>
                                    <Text as="p" variant="bodySm" tone="subdued">Ninguna</Text>
                                </BlockStack>
                            </Card>
                        </BlockStack>
                    </Layout.Section>
                </Layout>
            </BlockStack>
        </Page>
    );
}
