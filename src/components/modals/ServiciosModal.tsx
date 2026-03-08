'use client';

import { useState, useCallback } from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
  Select,
  Card,
  Badge,
} from '@shopify/polaris';
import { MobileIcon, CashDollarIcon } from '@shopify/polaris-icons';
import { useToast } from '@/components/notifications/ToastProvider';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

interface ServiciosModalProps {
  open: boolean;
  onClose: () => void;
}

const RECARGAS = [
  { label: 'Telcel', value: 'telcel', montos: [20, 30, 50, 100, 200, 300, 500] },
  { label: 'Movistar', value: 'movistar', montos: [20, 30, 50, 100, 200, 300, 500] },
  { label: 'AT&T', value: 'att', montos: [20, 30, 50, 100, 200, 300, 500] },
  { label: 'Unefon', value: 'unefon', montos: [20, 30, 50, 100, 200] },
];

const SERVICIOS = [
  { label: 'CFE (Luz)', value: 'cfe', comision: 5 },
  { label: 'Agua', value: 'agua', comision: 5 },
  { label: 'Gas Natural', value: 'gas', comision: 5 },
  { label: 'Telmex', value: 'telmex', comision: 10 },
  { label: 'Izzi', value: 'izzi', comision: 10 },
  { label: 'Total Play', value: 'totalplay', comision: 10 },
  { label: 'Sky', value: 'sky', comision: 10 },
];

export function ServiciosModal({ open, onClose }: ServiciosModalProps) {
  const { showSuccess, showError } = useToast();
  const { currentUserRole } = useDashboardStore();

  const [tipo, setTipo] = useState<'recarga' | 'servicio'>('recarga');
  const [categoria, setCategoria] = useState('');
  const [numeroReferencia, setNumeroReferencia] = useState('');
  const [monto, setMonto] = useState('');
  const [montoCustom, setMontoCustom] = useState('');
  const [loading, setLoading] = useState(false);

  const categoriaActual = tipo === 'recarga'
    ? RECARGAS.find(r => r.value === categoria)
    : SERVICIOS.find(s => s.value === categoria);

  const comision = tipo === 'recarga'
    ? parseFloat(monto) * 0.03 // 3% comisión en recargas
    : (SERVICIOS.find(s => s.value === categoria)?.comision || 0);

  const total = parseFloat(monto || montoCustom || '0') + comision;

  const handleSubmit = useCallback(async () => {
    if (!categoria || !numeroReferencia || (!monto && !montoCustom)) {
      showError('Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const montoFinal = parseFloat(monto || montoCustom);
      const folio = `SRV-${Date.now()}`;

      // Aquí iría la integración con el proveedor de servicios
      // Por ahora solo registramos localmente

      const servicio = {
        id: crypto.randomUUID(),
        tipo,
        categoria,
        nombre: categoriaActual?.label || categoria,
        monto: montoFinal,
        comision,
        numeroReferencia,
        folio,
        estado: 'completado' as const,
        cajero: currentUserRole?.globalId || currentUserRole?.employeeNumber || 'Cajero',
        fecha: new Date().toISOString(),
      };

      // TODO: Guardar en base de datos
      console.log('Servicio registrado:', servicio);

      showSuccess(`${tipo === 'recarga' ? 'Recarga' : 'Pago'} procesado: ${folio}`);

      // Reset form
      setCategoria('');
      setNumeroReferencia('');
      setMonto('');
      setMontoCustom('');
      onClose();
    } catch (error) {
      showError('Error al procesar el servicio');
    } finally {
      setLoading(false);
    }
  }, [tipo, categoria, numeroReferencia, monto, montoCustom, comision, categoriaActual, currentUserRole, showSuccess, showError, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recargas y Servicios"
      primaryAction={{
        content: 'Procesar',
        onAction: handleSubmit,
        loading,
        disabled: !categoria || !numeroReferencia || (!monto && !montoCustom),
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: onClose }]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Tipo de servicio */}
          <InlineStack gap="300">
            <Button
              variant={tipo === 'recarga' ? 'primary' : 'secondary'}
              onClick={() => { setTipo('recarga'); setCategoria(''); setMonto(''); }}
              icon={MobileIcon}
            >
              Recargas
            </Button>
            <Button
              variant={tipo === 'servicio' ? 'primary' : 'secondary'}
              onClick={() => { setTipo('servicio'); setCategoria(''); setMonto(''); }}
              icon={CashDollarIcon}
            >
              Pago de Servicios
            </Button>
          </InlineStack>

          {/* Categoría */}
          <Select
            label={tipo === 'recarga' ? 'Compañía' : 'Servicio'}
            options={[
              { label: `Seleccionar ${tipo === 'recarga' ? 'compañía' : 'servicio'}...`, value: '' },
              ...(tipo === 'recarga' ? RECARGAS : SERVICIOS),
            ]}
            value={categoria}
            onChange={setCategoria}
          />

          {/* Número de referencia */}
          {categoria && (
            <TextField
              label={tipo === 'recarga' ? 'Número de teléfono' : 'Número de cuenta/referencia'}
              value={numeroReferencia}
              onChange={setNumeroReferencia}
              type={tipo === 'recarga' ? 'tel' : 'text'}
              placeholder={tipo === 'recarga' ? '5512345678' : 'Número de cuenta'}
              autoComplete="off"
              maxLength={tipo === 'recarga' ? 10 : 20}
            />
          )}

          {/* Montos predefinidos (solo recargas) */}
          {tipo === 'recarga' && categoria && (
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">Monto</Text>
              <InlineStack gap="200" wrap>
                {RECARGAS.find(r => r.value === categoria)?.montos.map(m => (
                  <Button
                    key={m}
                    variant={monto === String(m) ? 'primary' : 'secondary'}
                    onClick={() => { setMonto(String(m)); setMontoCustom(''); }}
                  >
                    {`$${m}`}
                  </Button>
                ))}
              </InlineStack>
            </BlockStack>
          )}

          {/* Monto custom */}
          {categoria && (
            <TextField
              label={tipo === 'recarga' ? 'Otro monto' : 'Monto a pagar'}
              value={montoCustom}
              onChange={(val) => { setMontoCustom(val); setMonto(''); }}
              type="number"
              prefix="$"
              autoComplete="off"
              placeholder="0.00"
            />
          )}

          {/* Resumen */}
          {(monto || montoCustom) && numeroReferencia && (
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">Monto:</Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {formatCurrency(parseFloat(monto || montoCustom))}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">Comisión:</Text>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {formatCurrency(comision)}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="headingMd">Total a cobrar:</Text>
                  <Text as="span" variant="headingMd" tone="success">
                    {formatCurrency(total)}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {tipo === 'recarga' ? 'Teléfono' : 'Cuenta'}:
                  </Text>
                  <Badge>{numeroReferencia}</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
