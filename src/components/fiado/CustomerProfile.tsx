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
    PersonFilledIcon,
    ReceiptIcon,
    OrderFilledIcon,
} from '@shopify/polaris-icons';
import { useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Cliente, FiadoTransaction, LoyaltyTransaction } from '@/types';

interface CustomerProfileProps {
    cliente: Cliente;
    transactions: FiadoTransaction[];
    loyaltyTransactions?: LoyaltyTransaction[];
    onBack: () => void;
    onDelete?: () => void;
}

export function CustomerProfile({ cliente, transactions, loyaltyTransactions = [], onBack, onDelete }: CustomerProfileProps) {
    const deleteCliente = useDashboardStore((s) => s.deleteCliente);
    const registerAbono = useDashboardStore((s) => s.registerAbono);
    const [comment, setComment] = useState('');

    const stats = useMemo(() => {
        const totalSpent = transactions
            .filter(t => t.type === 'fiado')
            .reduce((sum, t) => sum + t.amount, 0);

        const ordersCount = transactions.filter(t => t.type === 'fiado' && t.saleFolio).length;
        const lastOrder = transactions.filter(t => t.type === 'fiado').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        // Calculate time since creation
        const createdDate = new Date(cliente.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - createdDate.getTime();
        const diffSec = Math.floor(diffMs / 1000);

        let timeSince = "Menos de 1 minuto";
        if (diffSec > 60) timeSince = `${Math.floor(diffSec / 60)} min`;
        if (diffSec > 3600) timeSince = `${Math.floor(diffSec / 3600)} h`;
        if (diffSec > 86400) timeSince = `${Math.floor(diffSec / 86400)} d`;

        // Sort transactions by date descending for timeline
        const sortedTransactions = [...transactions].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return {
            totalSpent,
            ordersCount,
            timeSince,
            lastOrder,
            sortedTransactions,
            rfmGroup: '—'
        };
    }, [cliente, transactions]);

    return (
        <Page
            fullWidth
            backAction={{ content: 'Clientes', onAction: onBack }}
            title={(
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon source={PersonFilledIcon} tone="base" />
                    <span>{cliente.name.toUpperCase()}</span>
                </div>
            ) as any}
            actionGroups={[
                {
                    title: 'Acciones de cuenta',
                    actions: [
                        {
                            content: 'Eliminar deuda (Saldar cuenta)',
                            icon: CashDollarIcon,
                            disabled: cliente.balance <= 0,
                            onAction: async () => {
                                if (window.confirm(`¿Estás seguro de saldar la deuda de ${formatCurrency(cliente.balance)} para ${cliente.name}? Esto pondrá su saldo en $0.00.`)) {
                                    await registerAbono(cliente.id, cliente.balance, 'Ajuste administrativo: Deuda saldada');
                                }
                            },
                        },
                        {
                            content: 'Eliminar cliente',
                            icon: DeleteIcon,
                            destructive: true,
                            onAction: async () => {
                                if (window.confirm(`¿Estás seguro de eliminar permanentemente a ${cliente.name}? Esta acción no se puede deshacer.`)) {
                                    await deleteCliente(cliente.id);
                                    if (onDelete) onDelete();
                                    onBack();
                                }
                            },
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
                                    {stats.lastOrder ? (
                                        <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <InlineStack gap="300" blockAlign="center">
                                                    <Box padding="200" background="bg-surface" borderRadius="200">
                                                        <Icon source={ReceiptIcon} tone="base" />
                                                    </Box>
                                                    <BlockStack gap="050">
                                                        <Text as="p" variant="bodyMd" fontWeight="bold">
                                                            {stats.lastOrder.description || `Ticket ${stats.lastOrder.saleFolio || 'S/N'}`}
                                                        </Text>
                                                        <Text as="p" variant="bodySm" tone="subdued">
                                                            {formatDate(stats.lastOrder.date)} • {stats.lastOrder.items?.length || 0} artículos
                                                        </Text>
                                                    </BlockStack>
                                                </InlineStack>
                                                <Text as="p" variant="bodyLg" fontWeight="bold">
                                                    {formatCurrency(stats.lastOrder.amount)}
                                                </Text>
                                            </InlineStack>
                                        </Box>
                                    ) : (
                                        <Box padding="400" borderStyle="dashed" borderWidth="025" borderColor="border-secondary" borderRadius="200">
                                            <BlockStack gap="400" align="center">
                                                <Box maxWidth="80px">
                                                    <Icon source={OrderFilledIcon} tone="subdued" />
                                                </Box>
                                                <Text as="p" tone="subdued">Este cliente aún no ha realizado ningún pedido</Text>
                                            </BlockStack>
                                        </Box>
                                    )}
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
                                        <BlockStack gap="600">
                                            {stats.sortedTransactions.map((t) => (
                                                <div key={t.id} style={{ position: 'relative' }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '-17px',
                                                        top: '4px',
                                                        width: '9px',
                                                        height: '9px',
                                                        borderRadius: '50%',
                                                        background: t.type === 'fiado' ? '#e51c00' : '#008060',
                                                        border: '2px solid white',
                                                        boxShadow: '0 0 0 1px #e1e3e5'
                                                    }} />
                                                    <BlockStack gap="200">
                                                        <InlineStack align="space-between">
                                                            <BlockStack gap="050">
                                                                <Text as="span" variant="bodySm" tone="subdued">{formatDate(t.date)}</Text>
                                                                <Text as="span" variant="bodyMd" fontWeight="semibold">
                                                                    {t.type === 'fiado' ? 'Compra a crédito (Fiado)' : 'Abono realizado'}
                                                                </Text>
                                                                <Text as="span" variant="bodyMd">{t.description}</Text>
                                                            </BlockStack>
                                                            <Text as="span" variant="bodyMd" fontWeight="bold" tone={t.type === 'fiado' ? 'critical' : 'success'}>
                                                                {t.type === 'fiado' ? '-' : '+'}{formatCurrency(t.amount)}
                                                            </Text>
                                                        </InlineStack>

                                                        {t.items && t.items.length > 0 && (
                                                            <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                                                                <BlockStack gap="100">
                                                                    <Text as="p" variant="bodySm" fontWeight="semibold">Artículos:</Text>
                                                                    {t.items.map((item, i) => (
                                                                        <InlineStack key={i} align="space-between">
                                                                            <Text as="span" variant="bodySm">{item.quantity}x {item.productName}</Text>
                                                                            <Text as="span" variant="bodySm" tone="subdued">{formatCurrency(item.subtotal)}</Text>
                                                                        </InlineStack>
                                                                    ))}
                                                                </BlockStack>
                                                            </Box>
                                                        )}
                                                    </BlockStack>
                                                </div>
                                            ))}

                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '-17px',
                                                    top: '4px',
                                                    width: '9px',
                                                    height: '9px',
                                                    borderRadius: '50%',
                                                    background: '#5c5f62',
                                                    border: '2px solid white'
                                                }} />
                                                <InlineStack align="space-between">
                                                    <BlockStack gap="050">
                                                        <Text as="span" variant="bodySm" tone="subdued">{formatDate(cliente.createdAt)}</Text>
                                                        <Text as="span" variant="bodyMd">Registro de cliente creado.</Text>
                                                    </BlockStack>
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

                            {/* Loyalty History Card */}
                            {loyaltyTransactions.length > 0 && (
                                <Card>
                                    <BlockStack gap="300">
                                        <Text as="h2" variant="headingSm">Historial de Puntos</Text>
                                        <BlockStack gap="200">
                                            {loyaltyTransactions.slice(0, 8).map((lt) => (
                                                <InlineStack key={lt.id} align="space-between" blockAlign="center">
                                                    <BlockStack gap="050">
                                                        <Text as="span" variant="bodySm" fontWeight="semibold">
                                                            {lt.tipo === 'acumulacion' ? 'Acumulación' :
                                                             lt.tipo === 'canje' ? 'Canje' :
                                                             lt.tipo === 'ajuste' ? 'Ajuste' : 'Expiración'}
                                                            {lt.saleFolio ? ` — Folio ${lt.saleFolio}` : ''}
                                                        </Text>
                                                        <Text as="span" variant="bodySm" tone="subdued">
                                                            {new Date(lt.fecha).toLocaleDateString('es-MX')}
                                                        </Text>
                                                    </BlockStack>
                                                    <Badge tone={lt.puntos >= 0 ? 'success' : 'critical'}>
                                                        {`${lt.puntos >= 0 ? '+' : ''}${lt.puntos} pts`}
                                                    </Badge>
                                                </InlineStack>
                                            ))}
                                        </BlockStack>
                                        {loyaltyTransactions.length > 8 && (
                                            <Text as="p" variant="bodySm" tone="subdued">
                                                +{loyaltyTransactions.length - 8} movimientos más
                                            </Text>
                                        )}
                                    </BlockStack>
                                </Card>
                            )}

                            {/* Fiado / Credit Card */}
                            <Card>
                                <BlockStack gap="300">
                                    <InlineStack align="space-between">
                                        <Text as="h2" variant="headingSm">Estado de Cuenta</Text>
                                        <Icon source={CreditCardIcon} tone="subdued" />
                                    </InlineStack>
                                    <BlockStack gap="200">
                                        <InlineStack align="space-between">
                                            <Text as="p" variant="bodyMd" tone="subdued">Límite de crédito:</Text>
                                            <Text as="p" variant="bodyMd" fontWeight="semibold">{formatCurrency(cliente.creditLimit)}</Text>
                                        </InlineStack>
                                        <InlineStack align="space-between">
                                            <Text as="p" variant="bodyMd" tone="subdued">Deuda actual:</Text>
                                            <Text as="p" variant="bodyMd" fontWeight="bold" tone={cliente.balance > 0 ? 'critical' : 'success'}>
                                                {formatCurrency(cliente.balance)}
                                            </Text>
                                        </InlineStack>
                                        <Divider />
                                        <InlineStack align="space-between">
                                            <Text as="p" variant="bodyMd" tone="subdued">Crédito disponible:</Text>
                                            <Text as="p" variant="bodyMd" fontWeight="bold" tone="success">
                                                {formatCurrency(Math.max(0, cliente.creditLimit - cliente.balance))}
                                            </Text>
                                        </InlineStack>
                                    </BlockStack>
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
