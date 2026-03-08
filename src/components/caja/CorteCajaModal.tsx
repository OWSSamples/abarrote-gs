'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  BlockStack,
  InlineStack,
  Text,
  Card,
  Badge,
  Divider,
  Banner,
  Button,
  IndexTable,
} from '@shopify/polaris';
import { PrintIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import type { CorteCaja } from '@/types';

interface CorteCajaModalProps {
  open: boolean;
  onClose: () => void;
}

export function CorteCajaModal({ open, onClose }: CorteCajaModalProps) {
  const { saleRecords, gastos, cortesHistory, createCorteCaja, storeConfig, currentUserRole } = useDashboardStore();
  const { showSuccess, showError } = useToast();

  const defaultCajero = currentUserRole?.globalId || currentUserRole?.employeeNumber || '';

  const [cajero, setCajero] = useState(defaultCajero);
  const [fondoInicial, setFondoInicial] = useState('500');
  const [efectivoContado, setEfectivoContado] = useState('');
  const [notas, setNotas] = useState('');
  const [completedCorte, setCompletedCorte] = useState<CorteCaja | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Today's summaries for preview
  const todaySales = useMemo(() => saleRecords.filter((s) => s.date.startsWith(today)), [saleRecords, today]);
  const todayEfectivo = useMemo(() => todaySales.filter((s) => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + s.total, 0), [todaySales]);
  const todayTarjeta = useMemo(() => todaySales.filter((s) => s.paymentMethod === 'tarjeta').reduce((sum, s) => sum + s.total, 0), [todaySales]);
  const todayTransferencia = useMemo(() => todaySales.filter((s) => s.paymentMethod === 'transferencia').reduce((sum, s) => sum + s.total, 0), [todaySales]);
  const todayFiado = useMemo(() => todaySales.filter((s) => s.paymentMethod === 'fiado').reduce((sum, s) => sum + s.total, 0), [todaySales]);
  const todayTotal = todayEfectivo + todayTarjeta + todayTransferencia + todayFiado;
  const todayGastos = useMemo(() => gastos.filter((g) => g.fecha.startsWith(today)).reduce((sum, g) => sum + g.monto, 0), [gastos, today]);

  const efectivoEsperado = parseFloat(fondoInicial || '0') + todayEfectivo - todayGastos;
  const diferencia = (parseFloat(efectivoContado || '0')) - efectivoEsperado;

  const resetForm = useCallback(() => {
    setCajero(defaultCajero);
    setFondoInicial('500');
    setEfectivoContado('');
    setNotas('');
    setCompletedCorte(null);
  }, [defaultCajero]);

  const handleSubmit = useCallback(async () => {
    if (!cajero.trim()) {
      showError('Ingresa el nombre del cajero');
      return;
    }
    if (!efectivoContado) {
      showError('Ingresa el efectivo contado');
      return;
    }

    try {
      const corte = await createCorteCaja({
        cajero: cajero.trim(),
        efectivoContado: parseFloat(efectivoContado),
        fondoInicial: parseFloat(fondoInicial || '500'),
        notas,
      });
      setCompletedCorte(corte);
      showSuccess('Corte de caja registrado exitosamente');
    } catch {
      showError('Error al crear el corte de caja');
    }
  }, [cajero, efectivoContado, fondoInicial, notas, createCorteCaja, showSuccess, showError]);

  const handlePrint = useCallback(() => {
    if (!completedCorte) return;
    const d = new Date(completedCorte.fecha);
    const dateStr = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const diffColor = completedCorte.diferencia >= 0 ? '#000' : '#000';
    const diffSign = completedCorte.diferencia >= 0 ? '+' : '';

    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Corte de Caja</title>
<style>
@media print { @page { size: 80mm auto; margin: 0; } body { margin: 0; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Consolas', 'Courier New', 'Lucida Console', monospace;
  font-size: 11px;
  width: 302px;
  margin: 0 auto;
  padding: 6px 10px;
  color: #000;
  line-height: 1.35;
}
.center { text-align: center; }
.bold { font-weight: bold; }
.store-name { font-size: 18px; font-weight: 900; letter-spacing: 2px; margin: 4px 0 2px; }
.store-sub { font-size: 9px; color: #333; margin: 1px 0; }
.sep { border-top: 1px solid #000; margin: 5px 0; }
.sep-dashed { border-top: 1px dashed #555; margin: 5px 0; }
.sep-double { border-top: 3px double #000; margin: 6px 0; }
.sep-thick { border-top: 2px solid #000; margin: 5px 0; }
.section-title { font-size: 11px; font-weight: 900; text-align: center; letter-spacing: 1px; margin: 3px 0; text-transform: uppercase; }
.data-row { display: flex; justify-content: space-between; font-size: 11px; margin: 1px 0; }
.total-line { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin: 4px 0; }
.footer-legal { font-size: 8px; text-align: center; color: #555; margin: 1px 0; }
</style></head><body>

<div class="sep-thick"></div>
<div class="center store-name">${storeConfig.storeName}</div>
<div class="center store-sub">${storeConfig.address}</div>
<div class="center store-sub">TEL: ${storeConfig.phone}</div>
<div class="sep-thick"></div>

<div class="data-row"><span>CAJERO:</span><span>${completedCorte.cajero.toUpperCase()}</span></div>
<div class="data-row"><span>FECHA:</span><span>${dateStr}</span></div>
<div class="data-row"><span>HORA:</span><span>${timeStr}</span></div>

<div class="sep"></div>
<div class="section-title">===== CORTE DE CAJA =====</div>
<div class="sep"></div>

<div class="section-title">RESUMEN DE VENTAS</div>
<div class="sep-dashed"></div>
<div class="data-row"><span>TRANSACCIONES</span><span>${completedCorte.totalTransacciones}</span></div>
<div class="sep-dashed"></div>
<div class="data-row"><span>VENTAS EFECTIVO</span><span>$${completedCorte.ventasEfectivo.toFixed(2)}</span></div>
<div class="data-row"><span>VENTAS TARJETA</span><span>$${completedCorte.ventasTarjeta.toFixed(2)}</span></div>
<div class="data-row"><span>VENTAS TRANSFERENCIA</span><span>$${completedCorte.ventasTransferencia.toFixed(2)}</span></div>
<div class="data-row"><span>VENTAS FIADO</span><span>$${completedCorte.ventasFiado.toFixed(2)}</span></div>
<div class="sep-double"></div>
<div class="total-line"><span>TOTAL VENTAS</span><span>$${completedCorte.totalVentas.toFixed(2)}</span></div>
<div class="sep-double"></div>

<div class="section-title">ARQUEO DE CAJA</div>
<div class="sep-dashed"></div>
<div class="data-row"><span>FONDO INICIAL</span><span>$${completedCorte.fondoInicial.toFixed(2)}</span></div>
<div class="data-row"><span>(+) VENTAS EFECTIVO</span><span>$${completedCorte.ventasEfectivo.toFixed(2)}</span></div>
<div class="data-row"><span>(-) GASTOS DEL DIA</span><span>$${completedCorte.gastosDelDia.toFixed(2)}</span></div>
<div class="sep-dashed"></div>
<div class="data-row bold"><span>= EFECTIVO ESPERADO</span><span>$${completedCorte.efectivoEsperado.toFixed(2)}</span></div>
<div class="data-row bold"><span>  EFECTIVO CONTADO</span><span>$${completedCorte.efectivoContado.toFixed(2)}</span></div>
<div class="sep-double"></div>
<div class="total-line" style="color:${diffColor}"><span>DIFERENCIA</span><span>${diffSign}$${completedCorte.diferencia.toFixed(2)}</span></div>
${Math.abs(completedCorte.diferencia) <= 10
        ? '<div class="center bold" style="font-size:10px;margin:2px 0">*** CAJA CUADRADA ***</div>'
        : completedCorte.diferencia < 0
          ? '<div class="center bold" style="font-size:10px;margin:2px 0">*** FALTANTE EN CAJA ***</div>'
          : '<div class="center bold" style="font-size:10px;margin:2px 0">*** SOBRANTE EN CAJA ***</div>'
      }
<div class="sep-double"></div>

${completedCorte.notas ? `<div class="data-row" style="font-size:10px"><span>NOTAS:</span></div><div style="font-size:9px;padding:2px 0">${completedCorte.notas}</div><div class="sep-dashed"></div>` : ''}

<div style="margin-top:20px">
<div class="center" style="font-size:10px">________________________________</div>
<div class="center" style="font-size:9px;margin-top:2px">FIRMA DEL CAJERO</div>
</div>

<div style="margin-top:16px">
<div class="center" style="font-size:10px">________________________________</div>
<div class="center" style="font-size:9px;margin-top:2px">FIRMA DEL ENCARGADO</div>
</div>

<div class="sep-thick" style="margin-top:12px"></div>
<div class="footer-legal">DOCUMENTO INTERNO - NO VALIDO COMO COMPROBANTE</div>
<div class="footer-legal">${dateStr} ${timeStr}</div>
<div class="sep-thick"></div>

<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    printWindow.document.close();
  }, [completedCorte]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Completed corte view
  if (completedCorte) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Corte de Caja Completado"
        primaryAction={{ content: 'Imprimir Corte', icon: PrintIcon, onAction: handlePrint }}
        secondaryActions={[{ content: 'Cerrar', onAction: handleClose }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner tone={completedCorte.diferencia >= -10 && completedCorte.diferencia <= 10 ? 'success' : 'warning'}>
              <p>{completedCorte.diferencia >= -10 && completedCorte.diferencia <= 10
                ? 'Caja cuadrada — Todo en orden.'
                : `Diferencia de ${formatCurrency(Math.abs(completedCorte.diferencia))} detectada. Revisa movimientos.`}
              </p>
            </Banner>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Resumen de Ventas</Text>
                <InlineStack align="space-between"><Text as="span">Transacciones:</Text><Text as="span" fontWeight="bold">{completedCorte.totalTransacciones}</Text></InlineStack>
                <InlineStack align="space-between"><Text as="span">Efectivo:</Text><Text as="span">{formatCurrency(completedCorte.ventasEfectivo)}</Text></InlineStack>
                <InlineStack align="space-between"><Text as="span">Tarjeta:</Text><Text as="span">{formatCurrency(completedCorte.ventasTarjeta)}</Text></InlineStack>
                <InlineStack align="space-between"><Text as="span">Transferencia:</Text><Text as="span">{formatCurrency(completedCorte.ventasTransferencia)}</Text></InlineStack>
                <InlineStack align="space-between"><Text as="span">Fiado:</Text><Text as="span" tone="caution">{formatCurrency(completedCorte.ventasFiado)}</Text></InlineStack>
                <Divider />
                <InlineStack align="space-between"><Text as="span" variant="headingSm">Total Ventas:</Text><Text as="span" variant="headingSm" fontWeight="bold">{formatCurrency(completedCorte.totalVentas)}</Text></InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Arqueo de Caja</Text>
                <InlineStack align="space-between"><Text as="span">Fondo Inicial:</Text><Text as="span">{formatCurrency(completedCorte.fondoInicial)}</Text></InlineStack>
                <InlineStack align="space-between"><Text as="span">+ Ventas Efectivo:</Text><Text as="span">{formatCurrency(completedCorte.ventasEfectivo)}</Text></InlineStack>
                <InlineStack align="space-between"><Text as="span">- Gastos del Día:</Text><Text as="span">{formatCurrency(completedCorte.gastosDelDia)}</Text></InlineStack>
                <Divider />
                <InlineStack align="space-between"><Text as="span">Esperado:</Text><Text as="span" fontWeight="bold">{formatCurrency(completedCorte.efectivoEsperado)}</Text></InlineStack>
                <InlineStack align="space-between"><Text as="span">Contado:</Text><Text as="span" fontWeight="bold">{formatCurrency(completedCorte.efectivoContado)}</Text></InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="span" variant="headingSm">Diferencia:</Text>
                  <Badge tone={completedCorte.diferencia >= 0 ? 'success' : 'critical'}>{`${completedCorte.diferencia >= 0 ? '+' : ''}${formatCurrency(completedCorte.diferencia)}`}</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // Form view
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Corte de Caja"
      primaryAction={{
        content: 'Hacer Corte',
        onAction: handleSubmit,
        disabled: !cajero.trim() || !efectivoContado,
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: handleClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner tone="info">
            <p>Resumen del día: <strong>{todaySales.length} ventas</strong> por un total de <strong>{formatCurrency(todayTotal)}</strong></p>
          </Banner>

          {/* Today Preview */}
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Ventas del Día</Text>
              <InlineStack align="space-between"><Text as="span">Efectivo:</Text><Text as="span">{formatCurrency(todayEfectivo)}</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span">Tarjeta:</Text><Text as="span">{formatCurrency(todayTarjeta)}</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span">Transferencia:</Text><Text as="span">{formatCurrency(todayTransferencia)}</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span">Fiado:</Text><Text as="span" tone="caution">{formatCurrency(todayFiado)}</Text></InlineStack>
              <Divider />
              <InlineStack align="space-between"><Text as="span" fontWeight="bold">Total:</Text><Text as="span" fontWeight="bold">{formatCurrency(todayTotal)}</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span" tone="critical">Gastos del día:</Text><Text as="span" tone="critical">-{formatCurrency(todayGastos)}</Text></InlineStack>
            </BlockStack>
          </Card>

          <FormLayout>
            <TextField
              label="Cajero"
              value={cajero}
              onChange={setCajero}
              autoComplete="off"
              placeholder="Nombre del cajero"
            />
            <TextField
              label="Fondo de caja inicial"
              type="number"
              value={fondoInicial}
              onChange={setFondoInicial}
              autoComplete="off"
              prefix="$"
              helpText="Cantidad con la que se abrió la caja"
            />
            <TextField
              label="Efectivo contado en caja"
              type="number"
              value={efectivoContado}
              onChange={setEfectivoContado}
              autoComplete="off"
              prefix="$"
              placeholder="0.00"
              helpText={`Efectivo esperado: ${formatCurrency(efectivoEsperado)}`}
            />

            {efectivoContado && (
              <Banner tone={Math.abs(diferencia) <= 10 ? 'success' : diferencia < 0 ? 'critical' : 'warning'}>
                <InlineStack align="space-between">
                  <Text as="span" fontWeight="bold">Diferencia:</Text>
                  <Text as="span" fontWeight="bold">
                    {diferencia >= 0 ? '+' : ''}{formatCurrency(diferencia)}
                    {Math.abs(diferencia) <= 10 ? ' OK' : diferencia < 0 ? ' - Faltante' : ' - Sobrante'}
                  </Text>
                </InlineStack>
              </Banner>
            )}

            <TextField
              label="Notas / Observaciones"
              value={notas}
              onChange={setNotas}
              multiline={3}
              autoComplete="off"
              placeholder="Observaciones del turno..."
            />
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Cortes History sub-component
export function CortesHistory() {
  const cortesHistory = useDashboardStore((s) => s.cortesHistory);

  if (cortesHistory.length === 0) {
    return null;
  }

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">Historial de Cortes</Text>
        <IndexTable
          resourceName={{ singular: 'corte', plural: 'cortes' }}
          itemCount={cortesHistory.length}
          headings={[
            { title: 'Fecha' },
            { title: 'Cajero' },
            { title: 'Total Ventas' },
            { title: 'Esperado' },
            { title: 'Contado' },
            { title: 'Diferencia' },
          ]}
          selectable={false}
        >
          {[...cortesHistory].reverse().map((c, idx) => (
            <IndexTable.Row id={c.id} key={c.id} position={idx}>
              <IndexTable.Cell>
                <Text as="span" variant="bodySm">{new Date(c.fecha).toLocaleDateString('es-MX')}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>{c.cajero}</IndexTable.Cell>
              <IndexTable.Cell><Text as="span" fontWeight="semibold">{formatCurrency(c.totalVentas)}</Text></IndexTable.Cell>
              <IndexTable.Cell>{formatCurrency(c.efectivoEsperado)}</IndexTable.Cell>
              <IndexTable.Cell>{formatCurrency(c.efectivoContado)}</IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={Math.abs(c.diferencia) <= 10 ? 'success' : 'critical'}>{`${c.diferencia >= 0 ? '+' : ''}${formatCurrency(c.diferencia)}`}</Badge>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </BlockStack>
    </Card>
  );
}
