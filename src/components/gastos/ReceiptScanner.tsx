'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockStack,
  Box,
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  DropZone,
  InlineStack,
  Text,
} from '@shopify/polaris';
import { formatCurrency } from '@/lib/utils';
import type { GastoCategoria } from '@/types';

export interface ExtractedItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface ReceiptScannerProps {
  /** Selected file (image or PDF) — null when nothing has been uploaded yet. */
  file: File | null;
  /** Whether the AI scan is currently running. Drives the scanning animation. */
  isAnalyzing: boolean;
  /** Items already extracted by the AI. Drives the recreated ticket card. */
  extractedItems: ExtractedItem[];
  /** Pre-filled form values (used to recreate the ticket header / total). */
  formValues: {
    concepto: string;
    categoria: GastoCategoria | '';
    monto: number;
    fecha: string;
  };
  /** Optional helper text shown above the dropzone. */
  description?: string;
  /** Called when the user drops or picks a file. */
  onDrop: (acceptedFiles: File[]) => void;
  /** Called when the user clicks the "Quitar archivo" action. */
  onClear: () => void;
  /** Called when the user clicks the "Re-escanear" action. */
  onRescan?: () => void;
  /** Hide the dropzone once a file is loaded — used in edit mode. */
  variant?: 'add' | 'edit';
  /** When variant === 'edit' and there is no `file`, this URL is shown as the existing comprobante. */
  existingUrl?: string | null;
}

// Phases shown while the AI is processing. The component cycles through
// them on a timer so the user always sees forward progress, even though we
// don't get streaming updates from the model.
const SCAN_PHASES = [
  { label: 'Preparando imagen', detail: 'Optimizando resolución y contraste' },
  { label: 'Reconociendo texto', detail: 'OCR multimodal sobre cada región' },
  { label: 'Identificando productos', detail: 'Aislando líneas individuales del ticket' },
  { label: 'Calculando totales', detail: 'Sumando subtotales, IVA y descuentos' },
  { label: 'Categorizando gasto', detail: 'Inferiendo categoría contable' },
] as const;

/**
 * Self-contained, advanced receipt scanner UI.
 *
 * Visual flow:
 *   1. Idle  → invitational dropzone, supported formats hint.
 *   2. Scan  → live image preview with moving scanline + grid + glow +
 *              corner brackets + multi-phase progress strip.
 *   3. Done  → recreated thermal-style ticket card with header, dashed
 *              dividers, monospaced item lines, totals footer, and a
 *              "Re-escanear" action.
 */
export function ReceiptScanner({
  file,
  isAnalyzing,
  extractedItems,
  formValues,
  description,
  onDrop,
  onClear,
  onRescan,
  variant = 'add',
  existingUrl,
}: ReceiptScannerProps) {
  // Object URL for in-memory image preview (cleaned up on unmount/file change).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  // Cycle through SCAN_PHASES while analyzing.
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isAnalyzing) {
      setPhaseIdx(0);
      if (phaseTimer.current) clearInterval(phaseTimer.current);
      return;
    }
    setPhaseIdx(0);
    phaseTimer.current = setInterval(() => {
      setPhaseIdx((p) => Math.min(p + 1, SCAN_PHASES.length - 1));
    }, 1400);
    return () => {
      if (phaseTimer.current) clearInterval(phaseTimer.current);
    };
  }, [isAnalyzing]);

  const isPdf = !!file && file.type === 'application/pdf';
  const itemsSubtotal = useMemo(
    () => extractedItems.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0),
    [extractedItems],
  );
  const total = formValues.monto || itemsSubtotal;

  const handleDrop = (_drop: File[], accepted: File[]) => {
    if (accepted.length > 0) onDrop(accepted);
  };

  const showDropzone = !file && !(variant === 'edit' && existingUrl);
  const showPreview = !!file || (variant === 'edit' && !!existingUrl);
  const hasResult = extractedItems.length > 0 && !isAnalyzing;

  return (
    <BlockStack gap="400">
      <BlockStack gap="100">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingMd" fontWeight="bold">
            Escaneo Inteligente con IA
          </Text>
          <Badge tone="info">Beta</Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          {description ??
            'Sube un ticket o factura. La IA reconocerá el concepto, la categoría, el monto total y todos los productos automáticamente.'}
        </Text>
      </BlockStack>

      {showDropzone && (
        <div className="rcpt-dropzone-wrapper">
          <DropZone
            accept="image/*,application/pdf"
            type="file"
            allowMultiple={false}
            onDrop={handleDrop}
          >
            <DropZone.FileUpload
              actionTitle="Selecciona o arrastra el comprobante"
              actionHint="JPG, PNG, WebP o PDF — hasta 8 MB"
            />
          </DropZone>
        </div>
      )}

      {showPreview && (
        <Card padding="0">
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone={isAnalyzing ? 'info' : hasResult ? 'success' : 'attention'}>
                  {isAnalyzing ? 'Analizando' : hasResult ? 'Análisis completo' : 'Listo para escanear'}
                </Badge>
                <Text as="span" variant="bodySm" tone="subdued">
                  {file ? file.name : 'Comprobante existente'}
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                {hasResult && onRescan && (
                  <Button variant="plain" onClick={onRescan}>
                    Re-escanear
                  </Button>
                )}
                {!isAnalyzing && (
                  <Button variant="plain" tone="critical" onClick={onClear}>
                    Quitar archivo
                  </Button>
                )}
              </InlineStack>
            </InlineStack>
          </Box>
          <Divider />
          <Box padding="300" background="bg-surface-secondary">
            <div className="rcpt-stage">
              {previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={previewUrl} alt="Vista previa del ticket" className="rcpt-image" />
              ) : isPdf ? (
                <PdfPlaceholder filename={file!.name} />
              ) : existingUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={existingUrl} alt="Comprobante existente" className="rcpt-image" />
              ) : null}
              {isAnalyzing && (
                <>
                  <div className="rcpt-grid" aria-hidden="true" />
                  <div className="rcpt-scanline" aria-hidden="true" />
                  <div className="rcpt-glow" aria-hidden="true" />
                  <div className="rcpt-corners" aria-hidden="true">
                    <span /> <span /> <span /> <span />
                  </div>
                </>
              )}
            </div>
          </Box>
          {isAnalyzing && (
            <>
              <Divider />
              <Box padding="300">
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <span className="rcpt-dot" aria-hidden="true" />
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {SCAN_PHASES[phaseIdx].label}
                      </Text>
                    </InlineStack>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {`Paso ${phaseIdx + 1} de ${SCAN_PHASES.length}`}
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {SCAN_PHASES[phaseIdx].detail}
                  </Text>
                  <div className="rcpt-progress">
                    <div
                      className="rcpt-progress-bar"
                      style={{ width: `${((phaseIdx + 1) / SCAN_PHASES.length) * 100}%` }}
                    />
                  </div>
                </BlockStack>
              </Box>
            </>
          )}
        </Card>
      )}

      {hasResult && (
        <>
          <Banner tone="success" title="Datos extraídos correctamente">
            <Text as="p" variant="bodySm">
              {`La IA reconoció ${extractedItems.length} ${extractedItems.length === 1 ? 'línea' : 'líneas'} y rellenó automáticamente los campos del formulario. Puedes ajustarlos antes de guardar.`}
            </Text>
          </Banner>

          <RecreatedTicket
            concepto={formValues.concepto}
            categoria={formValues.categoria}
            fecha={formValues.fecha}
            items={extractedItems}
            itemsSubtotal={itemsSubtotal}
            total={total}
            sourceFilename={file?.name ?? 'comprobante'}
          />
        </>
      )}

      <style jsx>{`
        .rcpt-dropzone-wrapper :global(.Polaris-DropZone) {
          min-height: 180px;
        }
        .rcpt-stage {
          position: relative;
          width: 100%;
          max-height: 380px;
          min-height: 200px;
          overflow: hidden;
          border-radius: 8px;
          background: #0b0d12;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rcpt-image {
          display: block;
          max-width: 100%;
          max-height: 380px;
          object-fit: contain;
        }
        .rcpt-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(to right, rgba(0, 200, 255, 0.18) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 200, 255, 0.18) 1px, transparent 1px);
          background-size: 28px 28px;
          mix-blend-mode: screen;
          opacity: 0.55;
          animation: rcpt-grid-fade 2.4s ease-in-out infinite;
        }
        .rcpt-scanline {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 4px;
          background: linear-gradient(90deg, transparent 0%, rgba(0, 200, 255, 0.95) 50%, transparent 100%);
          box-shadow: 0 0 18px 4px rgba(0, 200, 255, 0.6);
          animation: rcpt-scan 2.2s cubic-bezier(0.65, 0.05, 0.36, 1) infinite;
        }
        .rcpt-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse at 50% 50%, rgba(0, 200, 255, 0.18) 0%, transparent 65%);
          animation: rcpt-pulse 2.4s ease-in-out infinite;
        }
        .rcpt-corners {
          position: absolute;
          inset: 14px;
          pointer-events: none;
        }
        .rcpt-corners span {
          position: absolute;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(0, 200, 255, 0.85);
          box-shadow: 0 0 6px rgba(0, 200, 255, 0.6);
        }
        .rcpt-corners span:nth-child(1) {
          top: 0;
          left: 0;
          border-right: none;
          border-bottom: none;
        }
        .rcpt-corners span:nth-child(2) {
          top: 0;
          right: 0;
          border-left: none;
          border-bottom: none;
        }
        .rcpt-corners span:nth-child(3) {
          bottom: 0;
          left: 0;
          border-right: none;
          border-top: none;
        }
        .rcpt-corners span:nth-child(4) {
          bottom: 0;
          right: 0;
          border-left: none;
          border-top: none;
        }
        .rcpt-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #2c6ecb;
          box-shadow: 0 0 0 0 rgba(44, 110, 203, 0.6);
          animation: rcpt-dot 1.4s ease-in-out infinite;
        }
        .rcpt-progress {
          position: relative;
          height: 6px;
          width: 100%;
          background: var(--p-color-bg-surface-tertiary, #ebebeb);
          border-radius: 999px;
          overflow: hidden;
        }
        .rcpt-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #2c6ecb, #00c8ff);
          border-radius: 999px;
          transition: width 350ms ease-out;
        }
        @keyframes rcpt-scan {
          0% {
            transform: translateY(0%);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(380px);
            opacity: 0;
          }
        }
        @keyframes rcpt-pulse {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes rcpt-grid-fade {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes rcpt-dot {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(44, 110, 203, 0.6);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(44, 110, 203, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rcpt-grid,
          .rcpt-scanline,
          .rcpt-glow,
          .rcpt-dot,
          .rcpt-progress-bar {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </BlockStack>
  );
}

const CATEGORIA_LABELS: Record<GastoCategoria, string> = {
  renta: 'Renta',
  servicios: 'Servicios',
  proveedores: 'Proveedores',
  salarios: 'Salarios',
  mantenimiento: 'Mantenimiento',
  impuestos: 'Impuestos',
  otro: 'Otro',
};

function PdfPlaceholder({ filename }: { filename: string }) {
  return (
    <Box padding="600">
      <BlockStack gap="200" align="center" inlineAlign="center">
        <Text as="p" variant="headingLg" tone="text-inverse">
          PDF
        </Text>
        <Text as="p" variant="bodySm" tone="text-inverse">
          {filename}
        </Text>
      </BlockStack>
    </Box>
  );
}

function RecreatedTicket({
  concepto,
  categoria,
  fecha,
  items,
  itemsSubtotal,
  total,
  sourceFilename,
}: {
  concepto: string;
  categoria: GastoCategoria | '';
  fecha: string;
  items: ExtractedItem[];
  itemsSubtotal: number;
  total: number;
  sourceFilename: string;
}) {
  const fechaLegible = fecha
    ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  // Difference between extracted total (form value) and sum of items.
  const diff = total - itemsSubtotal;
  const showDiff = Math.abs(diff) > 0.01 && itemsSubtotal > 0 && total > 0;
  const totalQty = items.reduce((acc, it) => acc + it.cantidad, 0);

  return (
    <Card padding="0">
      <Box padding="300" background="bg-surface-secondary">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" variant="headingSm" fontWeight="bold">
            Ticket virtual reconstruido
          </Text>
          <InlineStack gap="200">
            <Badge tone="success">{`${items.length} líneas`}</Badge>
            <Badge>{`${totalQty} unidades`}</Badge>
          </InlineStack>
        </InlineStack>
      </Box>
      <Divider />

      <Box padding="500" background="bg-surface">
        <div className="ticket-paper">
          <div className="ticket-header">
            <div className="ticket-title">{concepto || 'COMPROBANTE'}</div>
            <div className="ticket-meta">{fechaLegible}</div>
            {categoria && (
              <div className="ticket-meta">
                CATEGORÍA: {(CATEGORIA_LABELS[categoria] ?? categoria).toUpperCase()}
              </div>
            )}
          </div>

          <div className="ticket-divider" aria-hidden="true" />

          <div className="ticket-row ticket-head">
            <span>Descripción</span>
            <span>Cant</span>
            <span>P.Unit</span>
            <span>Importe</span>
          </div>

          <div className="ticket-divider ticket-divider-thin" aria-hidden="true" />

          {items.map((item, idx) => (
            <div key={`${idx}-${item.nombre}`} className="ticket-row">
              <span className="ticket-name" title={item.nombre}>
                {item.nombre}
              </span>
              <span className="ticket-num">{item.cantidad}</span>
              <span className="ticket-num">{formatCurrency(item.precioUnitario)}</span>
              <span className="ticket-num">{formatCurrency(item.cantidad * item.precioUnitario)}</span>
            </div>
          ))}

          <div className="ticket-divider" aria-hidden="true" />

          <div className="ticket-totals">
            <div className="ticket-total-row">
              <span>Subtotal de líneas</span>
              <span>{formatCurrency(itemsSubtotal)}</span>
            </div>
            {showDiff && (
              <div className="ticket-total-row">
                <span>{diff >= 0 ? 'Impuestos / cargos' : 'Descuentos detectados'}</span>
                <span className={diff < 0 ? 'ticket-discount' : ''}>
                  {diff < 0 ? '-' : ''}
                  {formatCurrency(Math.abs(diff))}
                </span>
              </div>
            )}
            <div className="ticket-divider" aria-hidden="true" />
            <div className="ticket-total-row ticket-total-grand">
              <span>TOTAL A REGISTRAR</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="ticket-footer">
            <div>** Reconstruido por IA **</div>
            <div>Origen: {sourceFilename}</div>
          </div>
        </div>
      </Box>

      <style jsx>{`
        .ticket-paper {
          max-width: 360px;
          margin: 0 auto;
          padding: 18px 22px;
          background: #fff;
          color: #111;
          font-family: 'IBM Plex Mono', 'Menlo', 'Consolas', ui-monospace, monospace;
          font-size: 12.5px;
          line-height: 1.55;
          box-shadow:
            0 1px 0 rgba(0, 0, 0, 0.04),
            0 8px 24px rgba(0, 0, 0, 0.06);
          position: relative;
        }
        .ticket-paper::before,
        .ticket-paper::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 12px;
          background: radial-gradient(circle at 6px 0, transparent 6px, #fff 6.5px) repeat-x;
          background-size: 12px 12px;
        }
        .ticket-paper::before {
          top: -6px;
          transform: rotate(180deg);
        }
        .ticket-paper::after {
          bottom: -6px;
        }
        .ticket-header {
          text-align: center;
          margin-bottom: 8px;
        }
        .ticket-title {
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          word-break: break-word;
        }
        .ticket-meta {
          font-size: 11px;
          color: #555;
          letter-spacing: 0.02em;
        }
        .ticket-divider {
          border-top: 1px dashed #999;
          margin: 8px 0;
        }
        .ticket-divider-thin {
          margin: 4px 0;
          border-top-style: dotted;
        }
        .ticket-row {
          display: grid;
          grid-template-columns: 1fr 36px 70px 78px;
          gap: 6px;
          font-variant-numeric: tabular-nums;
        }
        .ticket-head {
          font-size: 10.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #555;
          font-weight: 600;
        }
        .ticket-num {
          text-align: right;
        }
        .ticket-name {
          word-break: break-word;
        }
        .ticket-totals {
          margin-top: 4px;
        }
        .ticket-total-row {
          display: flex;
          justify-content: space-between;
          font-variant-numeric: tabular-nums;
        }
        .ticket-total-grand {
          font-weight: 700;
          font-size: 14px;
          margin-top: 4px;
        }
        .ticket-discount {
          color: #1a7f37;
        }
        .ticket-footer {
          margin-top: 14px;
          text-align: center;
          font-size: 10.5px;
          color: #777;
          letter-spacing: 0.04em;
        }
      `}</style>
    </Card>
  );
}
