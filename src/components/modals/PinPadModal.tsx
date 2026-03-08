import React, { useState } from 'react';
import { Modal, Text, BlockStack, InlineStack, Button, Box, InlineGrid, Banner } from '@shopify/polaris';
import { DeleteIcon, XIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { PermissionKey } from '@/types';

interface PinPadModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (authorizedByUid: string, userDisplayName: string) => void;
    requiredPermission: PermissionKey;
    title?: string;
}

export function PinPadModal({ open, onClose, onSuccess, requiredPermission, title = 'Autorización Requerida' }: PinPadModalProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { authorizePin } = useDashboardStore();

    const handleKeyPress = (num: string) => {
        setError('');
        if (pin.length < 6) {
            setPin(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        setError('');
        setPin(prev => prev.slice(0, -1));
    };

    const handleClear = () => {
        setError('');
        setPin('');
    };

    const handleSubmit = async () => {
        if (pin.length < 4) {
            setError('El PIN debe tener al menos 4 dígitos.');
            return;
        }

        setLoading(true);
        setError('');

        const res = await authorizePin(pin, requiredPermission);
        setLoading(false);

        if (res.success && res.authorizedByUid) {
            setPin('');
            onSuccess(res.authorizedByUid, res.userDisplayName || 'Supervisor');
        } else {
            setError(res.error || 'PIN inválido o sin permisos');
            setPin('');
        }
    };

    const handleClose = () => {
        setPin('');
        setError('');
        onClose();
    };

    // Numpad layout: 1 2 3 / 4 5 6 / 7 8 9 / Clear 0 Backspace
    return (
        <Modal
            open={open}
            onClose={handleClose}
            title={title}
        >
            <Modal.Section>
                <BlockStack gap="400" align="center" inlineAlign="center">
                    <Text as="p" variant="bodyMd" tone="subdued">
                        Ingresa tu PIN de Supervisor para continuar
                    </Text>

                    {error && (
                        <Banner tone="critical">
                            <p>{error}</p>
                        </Banner>
                    )}

                    {/* PIN Display */}
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="200px">
                        <Text as="h2" variant="heading3xl" alignment="center">
                            {pin ? '•'.repeat(pin.length) : ' '}
                        </Text>
                    </Box>

                    {/* Numeric Keypad */}
                    <Box maxWidth="280px">
                        <InlineGrid columns={3} gap="200">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <Button key={num} size="large" onClick={() => handleKeyPress(num.toString())} disabled={loading}>
                                    {num.toString()}
                                </Button>
                            ))}
                            <Button size="large" tone="critical" onClick={handleClear} disabled={loading}>
                                Borrar
                            </Button>
                            <Button size="large" onClick={() => handleKeyPress('0')} disabled={loading}>
                                0
                            </Button>
                            <Button size="large" icon={DeleteIcon} onClick={handleBackspace} disabled={loading} />
                        </InlineGrid>
                    </Box>

                    <InlineStack gap="300" align="center">
                        <Button size="large" onClick={handleClose} disabled={loading} icon={XIcon}>
                            Cancelar
                        </Button>
                        <Button size="large" variant="primary" onClick={handleSubmit} loading={loading} disabled={pin.length < 4}>
                            Autorizar
                        </Button>
                    </InlineStack>

                </BlockStack>
            </Modal.Section>
        </Modal>
    );
}
