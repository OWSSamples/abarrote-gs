'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Card,
  Button,
  TextField,
  Divider,
  Box,
  Badge,
  Tabs,
  Spinner,
  Banner,
  Collapsible,
} from '@shopify/polaris';
import {
  QuestionCircleIcon,
  EmailIcon,
  ChatIcon,
  ExternalIcon,
  SearchIcon,
  RefreshIcon,
  DeleteIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';

// ── Types ─────────────────────────────────────────────────────────────────
interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

// ── FAQ data ───────────────────────────────────────────────────────────────
const FAQ_CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'pos', label: 'Ventas' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'caja', label: 'Caja' },
  { id: 'clients', label: 'Clientes' },
  { id: 'config', label: 'Configuración' },
  { id: 'hardware', label: 'Hardware' },
] as const;

const FAQ_ITEMS = [
  { category: 'pos', question: '¿Cómo registro una venta?', answer: 'Ve a "Punto de Venta" en el menú lateral.\n1. Escanea el código de barras del producto o búscalo por nombre.\n2. Ajusta la cantidad si es necesario.\n3. Selecciona el método de pago (efectivo, tarjeta, MercadoPago, SPEI…).\n4. Presiona "Cobrar" para completar la venta e imprimir el ticket.' },
  { category: 'pos', question: '¿Cómo aplico un descuento a una venta?', answer: 'En la pantalla de cobro, antes de confirmar el pago:\n1. Toca el subtotal o el ícono de descuento.\n2. Ingresa el porcentaje o monto fijo del descuento.\n3. Confirma. El total se ajustará automáticamente y quedará registrado en el historial.' },
  { category: 'pos', question: '¿Cómo registro una devolución?', answer: 'Ve a "Historial de Ventas".\n1. Busca la venta original por folio o fecha.\n2. Presiona el botón "Devolver".\n3. Selecciona los artículos y cantidades a devolver.\n4. Confirma. El stock se reajusta automáticamente y se genera un ticket de devolución.' },
  { category: 'pos', question: '¿Qué hago si el internet se cae?', answer: 'El sistema funciona en modo offline automáticamente. Aparecerá un indicador naranja en la barra superior.\n- Las ventas, cortes y movimientos se guardan localmente.\n- Al recuperar la conexión, todo se sincroniza con el servidor.\n- No pierdes ningún dato si el sistema estaba funcionando antes de la caída.' },
  { category: 'inventory', question: '¿Cómo agrego un producto nuevo?', answer: 'Ve a "Productos" → clic en "+ Agregar producto".\n1. Completa nombre, SKU (o deja que se genere), precio de costo y precio de venta.\n2. Asigna una categoría y unidad de medida.\n3. Ingresa el stock inicial.\n4. Opcional: sube imagen y activa la IA para generar una descripción automática.\n5. Guarda.' },
  { category: 'inventory', question: '¿Cómo recibo mercancía de un proveedor?', answer: 'Ve a "Inventario" → "Recepción de mercancía" o desde el perfil del proveedor.\n1. Selecciona los productos recibidos y en qué cantidades.\n2. Opcionalmente adjunta la factura (la IA puede extraerla automáticamente).\n3. Confirma. El stock se incrementa y queda el registro trazable.' },
  { category: 'caja', question: '¿Cómo hago un corte de caja?', answer: 'Ve a "Caja" → "Corte de Caja".\n1. El sistema muestra el efectivo esperado (ventas en efectivo - cambios).\n2. Cuenta el dinero físico e ingresa el monto contado.\n3. Registra cualquier retiro de caja si hubo.\n4. Confirma el corte. Se genera un reporte imprimible automáticamente.' },
  { category: 'caja', question: '¿Cómo registro un gasto o factura?', answer: 'Ve a "Gastos" → "+ Nuevo gasto".\n- Manual: Llena monto, concepto, categoría y fecha.\n- Con IA: Sube una foto del recibo/factura. La IA extrae automáticamente concepto, monto, fecha y líneas de detalle.\nTodos los gastos se reflejan en los reportes financieros.' },
  { category: 'caja', question: '¿Cómo genero un reporte de ventas?', answer: 'Ve a "Reportes" o al Dashboard.\n1. Selecciona el período (hoy, semana, mes, rango personalizado).\n2. Usa los filtros por cajero, método de pago o categoría si es necesario.\n3. Visualiza las gráficas y KPIs.\n4. Presiona "Exportar" para descargar en CSV o Excel.' },
  { category: 'clients', question: '¿Cómo funciona el sistema de fiado?', answer: 'Ve a "Clientes" → selecciona el cliente → "Nuevo Fiado".\n1. Registra los productos o el monto del crédito.\n2. Para abonar: entra al perfil → "Registrar pago".\n3. Puedes ver el saldo pendiente, historial de movimientos y fecha del último abono.\n4. Activa límite de crédito por cliente para control de riesgo.' },
  { category: 'clients', question: '¿Cómo configuro el programa de lealtad?', answer: 'Ve a "Configuración" → "Loyalty y Puntos".\n1. Define la conversión: cuántos pesos = 1 punto.\n2. Define el valor de canje: cuántos puntos = $1 de descuento.\n3. Activa recompensas por monto acumulado si lo deseas.\nAl cobrar, el sistema acumula puntos automáticamente en el perfil del cliente.' },
  { category: 'config', question: '¿Cómo configuro los métodos de pago?', answer: 'Ve a "Configuración" → "Pagos Integrados".\n- MercadoPago: Vincula tu terminal Point y activa pagos con QR.\n- Stripe / Conekta / Clip: Ingresa tus credenciales API desde cada plataforma.\n- SPEI: Solo necesitas activarlo; el sistema genera referencias automáticas.\nCada método se puede activar o desactivar independientemente.' },
  { category: 'config', question: '¿Cómo habilito las notificaciones de Telegram?', answer: 'Ve a "Configuración" → "Notificaciones".\n1. Crea un bot con @BotFather en Telegram y copia el token.\n2. Obtén tu Chat ID (usa @userinfobot).\n3. Ingresa ambos datos y activa las alertas que deseas (stock crítico, ventas grandes, errores).\n4. Presiona "Probar notificación" para verificar.' },
  { category: 'config', question: '¿Cómo exporto mis datos?', answer: 'Desde el Dashboard o Historial de Ventas, busca el botón "Exportar".\n- Puedes exportar en CSV o Excel.\n- Aplica filtros de fecha antes de exportar para el período que necesitas.\n- Los reportes de inventario también son exportables desde "Productos" → "Exportar".' },
  { category: 'hardware', question: '¿Cómo configuro la impresora térmica?', answer: 'Ve a "Configuración" → "Hardware y Periféricos".\n1. Selecciona el tipo de conexión: TCP/IP (WiFi/red local) o USB.\n2. Para TCP/IP: ingresa la IP de la impresora y el puerto (generalmente 9100).\n3. Presiona "Probar impresión" para verificar.\n4. Ajusta el ancho del papel (58mm u 80mm) según tu modelo.' },
  { category: 'hardware', question: '¿Cómo imprimo un ticket de una venta pasada?', answer: 'Ve a "Historial de Ventas".\n1. Busca la venta por folio, fecha o cliente.\n2. Abre el detalle de la venta.\n3. Presiona el botón "Reimprimir ticket".\nTambién puedes enviar el ticket por correo electrónico si tienes AWS SES configurado.' },
] as const;

const SHORTCUTS = [
  { keys: ['?'], action: 'Abrir Centro de Ayuda', section: 'Global' },
  { keys: ['Esc'], action: 'Cerrar ventanas y modales', section: 'Global' },
  { keys: ['Ctrl', 'K'], action: 'Búsqueda global de productos/clientes', section: 'Global' },
  { keys: ['Alt', 'D'], action: 'Ir al Dashboard', section: 'Navegación' },
  { keys: ['Alt', 'V'], action: 'Ir a Ventas (POS)', section: 'Navegación' },
  { keys: ['Alt', 'I'], action: 'Ir a Inventario', section: 'Navegación' },
  { keys: ['Alt', 'C'], action: 'Ir a Caja', section: 'Navegación' },
  { keys: ['Alt', 'R'], action: 'Ir a Reportes', section: 'Navegación' },
  { keys: ['Enter'], action: 'Confirmar / cobrar venta', section: 'POS' },
  { keys: ['F2'], action: 'Búsqueda manual (sin escáner)', section: 'POS' },
  { keys: ['Supr / Del'], action: 'Eliminar producto seleccionado del carrito', section: 'POS' },
  { keys: ['+'], action: 'Incrementar cantidad seleccionada', section: 'POS' },
  { keys: ['-'], action: 'Reducir cantidad seleccionada', section: 'POS' },
];

const QUICK_PROMPTS = [
  '¿Cómo hago un corte de caja?',
  'No puedo conectar la impresora',
  '¿Cómo configuro MercadoPago?',
  '¿Cómo funciona el modo offline?',
  'Error al registrar una venta',
  '¿Cómo exporto mis reportes?',
];

// ── Props ─────────────────────────────────────────────────────────────────
interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────
export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const aiEnabled = useDashboardStore((s) => s.storeConfig.aiEnabled);
  const [selectedTab, setSelectedTab] = useState(0);

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // FAQ
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState<string>('all');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Contact
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [ticketNumber] = useState(() => Math.floor(100000 + Math.random() * 900000));

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // ── Chat logic ────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatLoading) return;

      const history = chatMessages
        .filter((m) => !m.error)
        .slice(-14)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput('');
      setChatLoading(true);
      setChatError(null);

      try {
        const res = await fetch('/api/support-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok || !data.reply) throw new Error(data.error ?? 'Error al conectar con el asistente');
        setChatMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: data.reply! },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setChatError(msg);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: 'No pude generar una respuesta. Verifica que la IA esté configurada e intenta de nuevo.',
            error: true,
          },
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading, chatMessages],
  );

  const handleChatKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(chatInput);
      }
    },
    [chatInput, sendMessage],
  );

  const clearChat = useCallback(() => {
    setChatMessages([]);
    setChatError(null);
  }, []);

  // ── FAQ logic ─────────────────────────────────────────────────────────

  const filteredFaq = FAQ_ITEMS.filter((item) => {
    const matchesCategory = faqCategory === 'all' || item.category === faqCategory;
    const query = faqSearch.toLowerCase();
    const matchesSearch =
      query === '' ||
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  // ── Contact logic ─────────────────────────────────────────────────────

  const handleContact = useCallback(async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) return;
    setContactSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    setContactSent(true);
    setContactSending(false);
  }, [contactSubject, contactMessage]);

  // ── Close / reset ─────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setFaqSearch('');
    setExpandedFaq(null);
    setChatInput('');
    setChatError(null);
    setContactSent(false);
    setContactSubject('');
    setContactMessage('');
    onClose();
  }, [onClose]);

  // ── Tabs ──────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'ai-chat', content: 'Asistente IA', badge: aiEnabled ? undefined : '!', accessibilityLabel: 'Asistente de IA' },
    { id: 'faq', content: 'Base de Conocimiento', accessibilityLabel: 'Preguntas frecuentes' },
    { id: 'contact', content: 'Contacto', accessibilityLabel: 'Contactar soporte' },
    { id: 'shortcuts', content: 'Atajos', accessibilityLabel: 'Atajos de teclado' },
  ];

  // ── Helpers ───────────────────────────────────────────────────────────

  const shortcutSections = [...new Set(SHORTCUTS.map((s) => s.section))];

  const filterChipStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    borderRadius: '999px',
    border: `1px solid ${active ? 'var(--p-color-border-interactive)' : 'var(--p-color-border)'}`,
    backgroundColor: active ? 'var(--p-color-bg-fill-selected)' : 'transparent',
    color: active ? 'var(--p-color-text-interactive)' : 'var(--p-color-text-secondary)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: active ? '600' : '400',
    transition: 'all 150ms ease',
    outline: 'none',
    whiteSpace: 'nowrap' as const,
  });

  const kbdStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: '4px',
    border: '1px solid var(--p-color-border)',
    backgroundColor: 'var(--p-color-bg-surface)',
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontWeight: '500',
    color: 'var(--p-color-text)',
    boxShadow: '0 1px 0 var(--p-color-border)',
    whiteSpace: 'nowrap' as const,
  };

  // ── AI Chat Tab ────────────────────────────────────────────────────────

  const dotBaseStyle: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--p-color-icon-interactive)',
    display: 'inline-block',
  };

  const renderAITab = () => (
    <BlockStack gap="300">
      {/* Keyframe animations */}
      <style>{`
        @keyframes gs-dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes gs-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Status bar */}
      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: aiEnabled
                ? 'var(--p-color-bg-fill-success)'
                : 'var(--p-color-bg-fill-caution)',
              flexShrink: 0,
            }} />
            <BlockStack gap="050">
              <Text as="span" variant="bodySm" fontWeight="semibold">
                Asistente Abarrote GS
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {chatLoading
                  ? 'Procesando consulta...'
                  : aiEnabled
                    ? 'En línea'
                    : 'Requiere configuración'}
              </Text>
            </BlockStack>
          </InlineStack>
          {chatMessages.length > 0 && (
            <Button
              variant="plain"
              size="slim"
              icon={DeleteIcon}
              onClick={clearChat}
              accessibilityLabel="Limpiar conversación"
            >
              Limpiar
            </Button>
          )}
        </InlineStack>
      </Box>

      {!aiEnabled && (
        <Banner
          tone="warning"
          title="Asistente no disponible"
          action={{ content: 'Configurar IA', url: '/settings?section=ai' }}
        >
          Activa un proveedor de IA en Configuración para habilitar este asistente.
        </Banner>
      )}

      {chatError && (
        <Banner tone="critical" onDismiss={() => setChatError(null)}>
          {chatError}
        </Banner>
      )}

      {/* Chat messages area */}
      <div
        ref={chatContainerRef}
        style={{
          height: '360px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '16px 12px',
          backgroundColor: 'var(--p-color-bg-surface)',
          borderRadius: 'var(--p-border-radius-200)',
          border: '1px solid var(--p-color-border)',
        }}
      >
        {/* Empty state */}
        {chatMessages.length === 0 && !chatLoading && (
          <Box padding="600">
            <BlockStack gap="300" inlineAlign="center">
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                backgroundColor: 'var(--p-color-bg-surface-secondary)',
                border: '1px solid var(--p-color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--p-color-icon-interactive)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <path d="M8 10h8M8 14h5"/>
                </svg>
              </div>
              <Text as="p" variant="bodyMd" fontWeight="semibold" alignment="center">
                ¿En qué te puedo ayudar?
              </Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Pregunta sobre ventas, inventario, caja, clientes, configuración o cualquier función del sistema.
              </Text>
              <Divider />
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Consultas sugeridas
              </Text>
            </BlockStack>
          </Box>
        )}

        {/* Messages */}
        {chatMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isLast = idx === chatMessages.length - 1;
          const prevRole = idx > 0 ? chatMessages[idx - 1].role : null;
          const showLabel = !prevRole || prevRole !== msg.role;
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                marginTop: showLabel && idx > 0 ? '14px' : '2px',
                animation: isLast ? 'gs-msg-in 200ms ease-out' : 'none',
              }}
            >
              {showLabel && (
                <div style={{ marginBottom: '4px', paddingInline: '4px' }}>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {isUser ? 'Tú' : 'Asistente'}
                  </Text>
                </div>
              )}
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: isUser
                    ? '14px 14px 3px 14px'
                    : '3px 14px 14px 14px',
                  backgroundColor: isUser
                    ? 'var(--p-color-bg-fill-brand)'
                    : msg.error
                      ? 'var(--p-color-bg-fill-caution-secondary)'
                      : 'var(--p-color-bg-surface-secondary)',
                  border: isUser
                    ? 'none'
                    : '1px solid var(--p-color-border)',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    lineHeight: '1.55',
                    color: isUser
                      ? 'var(--p-color-text-on-color)'
                      : msg.error
                        ? 'var(--p-color-text-caution)'
                        : 'var(--p-color-text)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    display: 'block',
                  }}
                >
                  {msg.content}
                </span>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {chatLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginTop: chatMessages.length > 0 ? '14px' : '2px',
              animation: 'gs-msg-in 200ms ease-out',
            }}
          >
            <div style={{ marginBottom: '4px', paddingInline: '4px' }}>
              <Text as="span" variant="bodySm" tone="subdued">
                Asistente
              </Text>
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '3px 14px 14px 14px',
                backgroundColor: 'var(--p-color-bg-surface-secondary)',
                border: '1px solid var(--p-color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <InlineStack gap="100" blockAlign="center">
                <span style={{ ...dotBaseStyle, animation: 'gs-dot-pulse 1.4s ease-in-out 0ms infinite' }} />
                <span style={{ ...dotBaseStyle, animation: 'gs-dot-pulse 1.4s ease-in-out 200ms infinite' }} />
                <span style={{ ...dotBaseStyle, animation: 'gs-dot-pulse 1.4s ease-in-out 400ms infinite' }} />
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                Analizando tu consulta...
              </Text>
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      {chatMessages.length === 0 && (
        <InlineStack gap="200" wrap>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => aiEnabled && void sendMessage(prompt)}
              disabled={!aiEnabled || chatLoading}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1px solid var(--p-color-border)',
                backgroundColor: 'var(--p-color-bg-surface)',
                cursor: aiEnabled ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                color: 'var(--p-color-text-secondary)',
                whiteSpace: 'nowrap',
                opacity: aiEnabled ? 1 : 0.5,
                transition: 'all 150ms ease',
              }}
            >
              {prompt}
            </button>
          ))}
        </InlineStack>
      )}

      {/* Input area */}
      <div onKeyDown={handleChatKeyDown}>
        <InlineStack gap="200" blockAlign="end">
          <div style={{ flex: 1 }}>
            <TextField
              label="Mensaje"
              labelHidden
              value={chatInput}
              onChange={setChatInput}
              placeholder={aiEnabled ? 'Escribe tu consulta... (Enter para enviar)' : 'Configura un proveedor de IA primero'}
              autoComplete="off"
              multiline={2}
              disabled={!aiEnabled || chatLoading}
            />
          </div>
          <Button
            variant="primary"
            icon={ArrowRightIcon}
            onClick={() => void sendMessage(chatInput)}
            loading={chatLoading}
            disabled={!aiEnabled || !chatInput.trim()}
            accessibilityLabel="Enviar mensaje"
          />
        </InlineStack>
      </div>

      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
        Las respuestas son generadas por IA y pueden contener inexactitudes.
        Para incidencias críticas, contacta al equipo de soporte directamente.
      </Text>
    </BlockStack>
  );

  // ── FAQ Tab ────────────────────────────────────────────────────────────

  const renderFAQTab = () => (
    <BlockStack gap="300">
      {/* Search */}
      <TextField
        label="Buscar"
        labelHidden
        value={faqSearch}
        onChange={setFaqSearch}
        placeholder="Buscar en la base de conocimiento..."
        autoComplete="off"
        prefix={<span style={{ color: 'var(--p-color-icon)' }} />}
        clearButton
        onClearButtonClick={() => setFaqSearch('')}
      />

      {/* Category chips */}
      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <InlineStack gap="200">
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setFaqCategory(cat.id);
                setExpandedFaq(null);
              }}
              style={filterChipStyle(faqCategory === cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </InlineStack>
      </div>

      {/* Results count */}
      <InlineStack align="space-between" blockAlign="center">
        <Text as="p" variant="bodySm" tone="subdued">
          {filteredFaq.length} {filteredFaq.length === 1 ? 'resultado' : 'resultados'}
        </Text>
        {(faqSearch || faqCategory !== 'all') && (
          <Button
            variant="plain"
            size="slim"
            icon={RefreshIcon}
            onClick={() => {
              setFaqSearch('');
              setFaqCategory('all');
              setExpandedFaq(null);
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </InlineStack>

      {/* FAQ items */}
      {filteredFaq.length === 0 ? (
        <Box padding="600">
          <BlockStack gap="200">
            <Text as="p" alignment="center" tone="subdued">
              No se encontraron artículos para &ldquo;{faqSearch}&rdquo;
            </Text>
            <Text as="p" alignment="center" variant="bodySm" tone="subdued">
              Prueba con otras palabras o usa el Asistente IA para una respuesta personalizada.
            </Text>
          </BlockStack>
        </Box>
      ) : (
        <Card padding="0">
          {filteredFaq.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            const catLabel = FAQ_CATEGORIES.find((c) => c.id === faq.category)?.label;
            return (
              <Box
                key={idx}
                borderBlockStartWidth={idx > 0 ? '025' : '0'}
                borderColor="border"
                padding="300"
              >
                <BlockStack gap="200">
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        marginTop: '2px',
                        fontSize: '14px',
                        color: 'var(--p-color-icon)',
                        flexShrink: 0,
                      }}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </span>
                    <BlockStack gap="100">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {faq.question}
                      </Text>
                      {catLabel && (
                        <span>
                          <Badge tone="info" size="small">{catLabel}</Badge>
                        </span>
                      )}
                    </BlockStack>
                  </button>
                  <Collapsible
                    id={`faq-${idx}`}
                    open={isExpanded}
                    transition={{ duration: '150ms', timingFunction: 'ease' }}
                  >
                    <Box paddingBlockStart="100" paddingInlineStart="600">
                      <Text as="p" variant="bodySm" tone="subdued">
                        <span style={{ whiteSpace: 'pre-line' }}>{faq.answer}</span>
                      </Text>
                    </Box>
                  </Collapsible>
                </BlockStack>
              </Box>
            );
          })}
        </Card>
      )}

      <Divider />
      <InlineStack gap="300" wrap>
        <Button
          url="https://github.com/OWSSamples/abarrote-gs/wiki"
          external
          icon={ExternalIcon}
          size="slim"
          variant="plain"
        >
          Documentación completa
        </Button>
        <Button
          url="https://github.com/OWSSamples/abarrote-gs/issues/new"
          external
          icon={ExternalIcon}
          size="slim"
          variant="plain"
        >
          Reportar un problema
        </Button>
      </InlineStack>
    </BlockStack>
  );

  // ── Contact Tab ────────────────────────────────────────────────────────

  const renderContactTab = () => (
    <BlockStack gap="400">
      {contactSent ? (
        <Card>
          <Box padding="600">
            <BlockStack gap="300" inlineAlign="center">
              <div style={{
                color: 'var(--p-color-icon-success)',
                display: 'flex', justifyContent: 'center',
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <Text as="h2" variant="headingMd" alignment="center">
                Solicitud registrada
              </Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Folio <strong>#{ticketNumber}</strong>. Recibirás respuesta en las próximas <strong>24 horas hábiles</strong>.
              </Text>
              <InlineStack align="center">
                <Button onClick={() => { setContactSent(false); setContactSubject(''); setContactMessage(''); }}>
                  Enviar otra solicitud
                </Button>
              </InlineStack>
            </BlockStack>
          </Box>
        </Card>
      ) : (
        <>
          {/* SLA info */}
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <InlineStack gap="400" wrap>
              <BlockStack gap="050">
                <Text as="span" variant="bodySm" tone="subdued">Tiempo de respuesta</Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">24 horas hábiles</Text>
              </BlockStack>
              <BlockStack gap="050">
                <Text as="span" variant="bodySm" tone="subdued">Urgencias críticas</Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">2–4 horas</Text>
              </BlockStack>
              <BlockStack gap="050">
                <Text as="span" variant="bodySm" tone="subdued">Estado del sistema</Text>
                <InlineStack gap="100" blockAlign="center">
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: 'var(--p-color-icon-success)',
                  }} />
                  <Text as="span" variant="bodyMd" fontWeight="semibold">Operativo</Text>
                </InlineStack>
              </BlockStack>
            </InlineStack>
          </Box>

          {/* Form */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Enviar solicitud de soporte
              </Text>
              <TextField
                label="Asunto"
                value={contactSubject}
                onChange={setContactSubject}
                placeholder="Ej: Error al imprimir tickets, Problema con MercadoPago…"
                autoComplete="off"
                helpText="Describe brevemente el problema."
              />
              <TextField
                label="Descripción detallada"
                value={contactMessage}
                onChange={setContactMessage}
                multiline={5}
                autoComplete="off"
                placeholder="Describe el problema con detalle: qué hiciste, qué esperabas que pasara y qué ocurrió realmente. Adjunta cualquier mensaje de error que veas."
                helpText="A mayor detalle, más rápida la resolución."
              />
              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={() => void handleContact()}
                  loading={contactSending}
                  disabled={!contactSubject.trim() || !contactMessage.trim()}
                  icon={ChatIcon}
                >
                  Enviar solicitud
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Contact channels */}
          <Card padding="0">
            <Box padding="300">
              <Text as="h3" variant="headingMd">
                Canales de contacto directo
              </Text>
            </Box>
            {[
              { icon: EmailIcon, label: 'Correo electrónico', value: 'soporte@abarrote.gs', detail: 'Respuesta en 24 h hábiles' },
              { icon: ChatIcon, label: 'Chat en vivo', value: 'Lunes a Viernes 9:00–18:00', detail: 'Tiempo de espera ~2 min' },
              { icon: QuestionCircleIcon, label: 'Portal de soporte', value: 'help.abarrote.gs', detail: 'Documentación y tickets' },
            ].map(({ icon: Icon, label, value, detail }) => (
              <Box
                key={label}
                borderBlockStartWidth="025"
                borderColor="border"
                padding="300"
              >
                <InlineStack gap="300" blockAlign="center" wrap={false}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    backgroundColor: 'var(--p-color-bg-surface-secondary)',
                    border: '1px solid var(--p-color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon width="18" height="18" />
                  </div>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{label}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">{value} · {detail}</Text>
                  </BlockStack>
                </InlineStack>
              </Box>
            ))}
          </Card>
        </>
      )}
    </BlockStack>
  );

  // ── Shortcuts Tab ──────────────────────────────────────────────────────

  const renderShortcutsTab = () => (
    <BlockStack gap="400">
      {shortcutSections.map((section) => (
        <Card key={section} padding="0">
          <Box padding="300" background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border">
            <Text as="h3" variant="headingSm">{section}</Text>
          </Box>
          {SHORTCUTS.filter((s) => s.section === section).map((shortcut, idx) => (
            <Box
              key={shortcut.action}
              borderBlockStartWidth={idx > 0 ? '025' : '0'}
              borderColor="border"
              padding="300"
            >
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <Text as="span" variant="bodySm">{shortcut.action}</Text>
                <InlineStack gap="100" blockAlign="center">
                  {shortcut.keys.map((key, ki) => (
                    <span key={ki} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {ki > 0 && (
                        <Text as="span" variant="bodySm" tone="subdued">+</Text>
                      )}
                      <kbd style={kbdStyle}>{key}</kbd>
                    </span>
                  ))}
                </InlineStack>
              </InlineStack>
            </Box>
          ))}
        </Card>
      ))}

      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
        Presiona <span style={kbdStyle}>?</span> en cualquier pantalla para abrir este panel.
      </Text>
    </BlockStack>
  );

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={handleClose} title="Centro de Ayuda" size="large">
      <Modal.Section flush>
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
      </Modal.Section>
      <Modal.Section>
        {selectedTab === 0 && renderAITab()}
        {selectedTab === 1 && renderFAQTab()}
        {selectedTab === 2 && renderContactTab()}
        {selectedTab === 3 && renderShortcutsTab()}
      </Modal.Section>
    </Modal>
  );
}
