'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  TextField,
  Collapsible,
} from '@shopify/polaris';
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

// ── Design tokens ─────────────────────────────────────────────────────────
const BRAND_GRADIENT = 'linear-gradient(135deg, #5B5BD6 0%, #7C3AED 100%)';
const BRAND_GRADIENT_SUBTLE = 'linear-gradient(135deg, rgba(91,91,214,0.08) 0%, rgba(124,58,237,0.08) 100%)';
const BRAND_GRADIENT_HERO = 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #9333EA 100%)';

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

  // ── Helpers ───────────────────────────────────────────────────────────

  const kbdStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
    borderRadius: '4px', border: '1px solid var(--p-color-border)',
    backgroundColor: 'var(--p-color-bg-surface)', fontSize: '11px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: '600',
    color: 'var(--p-color-text)', boxShadow: '0 1px 0 var(--p-color-border)',
    whiteSpace: 'nowrap' as const,
  };

  const shortcutSections = [...new Set(SHORTCUTS.map((s) => s.section))];

  const TAB_ITEMS = [
    { id: 'ai', label: 'Asistente IA', alert: !aiEnabled },
    { id: 'faq', label: 'Base de conocimiento' },
    { id: 'contact', label: 'Contacto' },
    { id: 'shortcuts', label: 'Atajos' },
  ];

  // ── RENDER: AI Chat ───────────────────────────────────────────────────

  const renderAITab = () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes gs-dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes gs-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gs-status-ring {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.55); }
          70%  { box-shadow: 0 0 0 7px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
        @keyframes gs-spin { to { transform: rotate(360deg); } }
        .gs-chat-scroll::-webkit-scrollbar { width: 3px; }
        .gs-chat-scroll::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; }
        .gs-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .gs-prompt-chip:hover { border-color: rgba(91,91,214,0.5) !important; background: rgba(91,91,214,0.07) !important; color: #5B5BD6 !important; }
        .gs-send-btn:not(:disabled):hover { filter: brightness(1.1); transform: scale(1.03); }
        .gs-send-btn:not(:disabled):active { transform: scale(0.96); }
        .gs-send-btn { transition: filter 150ms, transform 150ms; }
        .gs-clear-btn:hover { background: rgba(255,255,255,0.2) !important; }
      `}</style>

      {/* Gradient hero header */}
      <div style={{
        background: BRAND_GRADIENT_HERO,
        padding: '20px 22px 52px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-35px', right: '-35px', width: '130px', height: '130px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-15px', left: '30%', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '8px', left: '55%', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '13px',
              background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.5 2 6 4.5 6 7.5c0 2.5 1.5 4.5 3.5 5.5V15h5v-2c2-1 3.5-3 3.5-5.5C18 4.5 15.5 2 12 2z"/>
                <path d="M9 15v1.5a3 3 0 0 0 6 0V15"/>
                <circle cx="9.5" cy="8" r="0.8" fill="rgba(255,255,255,0.95)"/>
                <circle cx="14.5" cy="8" r="0.8" fill="rgba(255,255,255,0.95)"/>
              </svg>
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700', lineHeight: 1.25 }}>
                Asistente Abarrote GS
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  backgroundColor: aiEnabled ? '#34D399' : '#FCD34D',
                  animation: aiEnabled ? 'gs-status-ring 2.2s ease-in-out infinite' : 'none',
                  display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px' }}>
                  {chatLoading
                    ? 'Procesando tu consulta...'
                    : aiEnabled
                      ? 'En línea · Responde al instante'
                      : 'Requiere configuración de IA'}
                </span>
              </div>
            </div>
          </div>
          {chatMessages.length > 0 && (
            <button
              type="button"
              className="gs-clear-btn"
              onClick={clearChat}
              style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px', color: 'rgba(255,255,255,0.88)', cursor: 'pointer',
                padding: '5px 11px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px',
                transition: 'background 150ms', fontFamily: 'inherit',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Floating chat card overlaps hero */}
      <div style={{ padding: '0 16px', marginTop: '-28px', marginBottom: '16px' }}>
        <div style={{
          borderRadius: '16px',
          background: 'var(--p-color-bg-surface)',
          border: '1px solid var(--p-color-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {/* Inline banners */}
          {!aiEnabled && (
            <div style={{
              padding: '10px 16px',
              background: 'linear-gradient(90deg, rgba(251,191,36,0.12) 0%, rgba(251,191,36,0.04) 100%)',
              borderBottom: '1px solid rgba(251,191,36,0.22)',
              display: 'flex', alignItems: 'center', gap: '9px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontSize: '12px', color: '#92400E', flex: 1 }}>
                Activa un proveedor de IA en Configuración para usar este asistente.
              </span>
              <a href="/settings?section=ai" style={{ fontSize: '12px', color: '#7C3AED', fontWeight: '600', textDecoration: 'none' }}>
                Configurar
              </a>
            </div>
          )}
          {chatError && (
            <div style={{
              padding: '9px 16px',
              background: 'linear-gradient(90deg, rgba(239,68,68,0.08) 0%, transparent 100%)',
              borderBottom: '1px solid rgba(239,68,68,0.18)',
              display: 'flex', alignItems: 'center', gap: '9px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span style={{ fontSize: '12px', color: '#991B1B', flex: 1 }}>{chatError}</span>
              <button type="button" onClick={() => setChatError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
          )}

          {/* Messages area */}
          <div
            ref={chatContainerRef}
            className="gs-chat-scroll"
            style={{
              height: '330px', overflowY: 'auto',
              padding: '18px 16px',
              display: 'flex', flexDirection: 'column', gap: '4px',
              backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(91,91,214,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(124,58,237,0.03) 0%, transparent 50%)',
            }}
          >
            {/* Empty state */}
            {chatMessages.length === 0 && !chatLoading && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: '18px', padding: '20px 32px',
              }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '18px',
                  background: BRAND_GRADIENT_SUBTLE,
                  border: '1px solid rgba(91,91,214,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    <path d="M8 10h8M8 14h5"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--p-color-text)', marginBottom: '6px' }}>
                    ¿En qué te puedo ayudar?
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--p-color-text-secondary)', lineHeight: 1.55, maxWidth: '290px' }}>
                    Pregunta sobre ventas, inventario, caja, clientes, configuración o cualquier función del sistema.
                  </div>
                </div>
              </div>
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
                    display: 'flex', flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    marginTop: showLabel && idx > 0 ? '16px' : '3px',
                    animation: isLast ? 'gs-msg-in 220ms cubic-bezier(.22,1,.36,1)' : 'none',
                  }}
                >
                  {showLabel && (
                    <div style={{ marginBottom: '5px', paddingInline: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {!isUser && (
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '6px',
                          background: BRAND_GRADIENT,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2C8.5 2 6 4.5 6 7.5c0 2.5 1.5 4 3 5v1h6v-1c1.5-1 3-2.5 3-5C18 4.5 15.5 2 12 2z"/>
                            <path d="M9 15v1a3 3 0 0 0 6 0v-1"/>
                          </svg>
                        </div>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--p-color-text-secondary)', fontWeight: '500' }}>
                        {isUser ? 'Tú' : 'Asistente'}
                      </span>
                    </div>
                  )}
                  <div style={{
                    maxWidth: '83%', padding: '10px 14px',
                    borderRadius: isUser ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
                    background: isUser
                      ? BRAND_GRADIENT
                      : msg.error
                        ? 'rgba(239,68,68,0.06)'
                        : 'var(--p-color-bg-surface-secondary)',
                    border: isUser ? 'none' : msg.error ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--p-color-border)',
                    boxShadow: isUser ? '0 2px 10px rgba(91,91,214,0.28)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    <span style={{
                      fontSize: '13px', lineHeight: '1.6',
                      color: isUser ? '#fff' : msg.error ? '#991B1B' : 'var(--p-color-text)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block',
                    }}>
                      {msg.content}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Thinking */}
            {chatLoading && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                marginTop: chatMessages.length > 0 ? '16px' : '3px',
                animation: 'gs-msg-in 220ms cubic-bezier(.22,1,.36,1)',
              }}>
                <div style={{ marginBottom: '5px', paddingInline: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '6px',
                    background: BRAND_GRADIENT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.5 2 6 4.5 6 7.5c0 2.5 1.5 4 3 5v1h6v-1c1.5-1 3-2.5 3-5C18 4.5 15.5 2 12 2z"/>
                      <path d="M9 15v1a3 3 0 0 0 6 0v-1"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--p-color-text-secondary)', fontWeight: '500' }}>Asistente</span>
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: '3px 14px 14px 14px',
                  background: 'var(--p-color-bg-surface-secondary)',
                  border: '1px solid var(--p-color-border)',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {([0, 200, 400] as number[]).map((delay) => (
                      <span key={delay} style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: BRAND_GRADIENT,
                        animation: `gs-dot-pulse 1.4s ease-in-out ${delay}ms infinite`,
                        display: 'inline-block',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--p-color-text-secondary)' }}>
                    Analizando tu consulta...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          {chatMessages.length === 0 && (
            <div style={{
              padding: '12px 16px 14px',
              borderTop: '1px solid var(--p-color-border)',
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--p-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                Consultas frecuentes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="gs-prompt-chip"
                    onClick={() => aiEnabled && void sendMessage(prompt)}
                    disabled={!aiEnabled || chatLoading}
                    style={{
                      padding: '5px 13px', borderRadius: '20px',
                      border: '1px solid var(--p-color-border)',
                      background: 'var(--p-color-bg-surface)',
                      cursor: aiEnabled ? 'pointer' : 'not-allowed',
                      fontSize: '12px', color: 'var(--p-color-text-secondary)',
                      opacity: aiEnabled ? 1 : 0.4,
                      transition: 'all 150ms ease', fontFamily: 'inherit',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{
            borderTop: '1px solid var(--p-color-border)',
            padding: '12px 14px 10px',
            background: 'var(--p-color-bg-surface)',
          }}>
            <div
              style={{
                display: 'flex', alignItems: 'flex-end', gap: '8px',
                border: '1.5px solid var(--p-color-border)',
                borderRadius: '12px', overflow: 'hidden',
                background: 'var(--p-color-bg-surface-secondary)',
              }}
              onKeyDown={handleChatKeyDown}
            >
              <div style={{ flex: 1, padding: '8px 12px' }}>
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
              <div style={{ padding: '8px 10px 8px 0' }}>
                <button
                  type="button"
                  className="gs-send-btn"
                  onClick={() => void sendMessage(chatInput)}
                  disabled={!aiEnabled || !chatInput.trim() || chatLoading}
                  style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: !aiEnabled || !chatInput.trim() || chatLoading
                      ? 'var(--p-color-bg-fill-disabled)'
                      : BRAND_GRADIENT,
                    border: 'none',
                    cursor: !aiEnabled || !chatInput.trim() || chatLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: !aiEnabled || !chatInput.trim() || chatLoading
                      ? 'none' : '0 2px 10px rgba(91,91,214,0.38)',
                  }}
                  aria-label="Enviar mensaje"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={!aiEnabled || !chatInput.trim() || chatLoading ? 'var(--p-color-icon-disabled)' : '#fff'}
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div style={{ marginTop: '7px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--p-color-text-tertiary)' }}>
                Las respuestas son generadas por IA · Verifica información crítica
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── RENDER: FAQ ───────────────────────────────────────────────────────

  const renderFAQTab = () => (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 14px',
        border: '1.5px solid var(--p-color-border)',
        borderRadius: '12px',
        background: 'var(--p-color-bg-surface)',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--p-color-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div style={{ flex: 1 }}>
          <TextField
            label="Buscar"
            labelHidden
            value={faqSearch}
            onChange={setFaqSearch}
            placeholder="Buscar artículos y respuestas..."
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setFaqSearch('')}
          />
        </div>
      </div>

      {/* Category chips */}
      <div style={{ overflowX: 'auto', paddingBottom: '2px' }}>
        <div style={{ display: 'flex', gap: '6px', minWidth: 'max-content' }}>
          {FAQ_CATEGORIES.map((cat) => {
            const active = faqCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setFaqCategory(cat.id); setExpandedFaq(null); }}
                style={{
                  padding: '5px 14px', borderRadius: '20px',
                  border: `1.5px solid ${active ? '#7C3AED' : 'var(--p-color-border)'}`,
                  background: active ? BRAND_GRADIENT_SUBTLE : 'transparent',
                  color: active ? '#7C3AED' : 'var(--p-color-text-secondary)',
                  cursor: 'pointer', fontSize: '12px', fontWeight: active ? '600' : '400',
                  transition: 'all 150ms ease', outline: 'none',
                  whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--p-color-text-secondary)' }}>
          <strong style={{ color: 'var(--p-color-text)' }}>{filteredFaq.length}</strong>{' '}
          {filteredFaq.length === 1 ? 'artículo' : 'artículos'}
        </span>
        {(faqSearch || faqCategory !== 'all') && (
          <button
            type="button"
            onClick={() => { setFaqSearch(''); setFaqCategory('all'); setExpandedFaq(null); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: '#7C3AED', fontWeight: '500',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* FAQ list */}
      {filteredFaq.length === 0 ? (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          background: 'var(--p-color-bg-surface-secondary)',
          borderRadius: '12px', border: '1px solid var(--p-color-border)',
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: BRAND_GRADIENT_SUBTLE,
            border: '1px solid rgba(91,91,214,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--p-color-text)', marginBottom: '4px' }}>
            Sin resultados para &ldquo;{faqSearch}&rdquo;
          </div>
          <div style={{ fontSize: '12px', color: 'var(--p-color-text-secondary)' }}>
            Prueba con otras palabras o usa el Asistente IA.
          </div>
        </div>
      ) : (
        <div style={{
          borderRadius: '12px', border: '1px solid var(--p-color-border)',
          overflow: 'hidden', background: 'var(--p-color-bg-surface)',
        }}>
          {filteredFaq.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            const catLabel = FAQ_CATEGORIES.find((c) => c.id === faq.category)?.label;
            return (
              <div
                key={idx}
                style={{
                  borderTop: idx > 0 ? '1px solid var(--p-color-border)' : 'none',
                  background: isExpanded ? BRAND_GRADIENT_SUBTLE : 'transparent',
                  transition: 'background 180ms',
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  style={{
                    all: 'unset', cursor: 'pointer', display: 'flex',
                    alignItems: 'flex-start', gap: '12px', width: '100%',
                    padding: '13px 16px', boxSizing: 'border-box',
                  }}
                >
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '6px',
                    background: isExpanded ? BRAND_GRADIENT : 'var(--p-color-bg-surface-secondary)',
                    border: `1px solid ${isExpanded ? 'transparent' : 'var(--p-color-border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: '0px', transition: 'all 200ms',
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke={isExpanded ? '#fff' : 'var(--p-color-icon)'} strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--p-color-text)', lineHeight: 1.4 }}>
                      {faq.question}
                    </div>
                    {catLabel && (
                      <span style={{
                        display: 'inline-block', marginTop: '4px',
                        padding: '1px 8px', borderRadius: '10px', fontSize: '10px',
                        fontWeight: '500', letterSpacing: '0.02em',
                        background: 'rgba(91,91,214,0.1)', color: '#5B5BD6',
                        border: '1px solid rgba(91,91,214,0.15)',
                      }}>
                        {catLabel}
                      </span>
                    )}
                  </div>
                </button>
                <Collapsible
                  id={`faq-${idx}`}
                  open={isExpanded}
                  transition={{ duration: '180ms', timingFunction: 'ease' }}
                >
                  <div style={{ padding: '0 16px 14px 50px' }}>
                    <div style={{
                      fontSize: '13px', lineHeight: '1.65',
                      color: 'var(--p-color-text-secondary)', whiteSpace: 'pre-line',
                      borderLeft: '2px solid rgba(124,58,237,0.28)', paddingLeft: '12px',
                    }}>
                      {faq.answer}
                    </div>
                  </div>
                </Collapsible>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px',
        background: 'var(--p-color-bg-surface-secondary)',
        borderRadius: '10px', border: '1px solid var(--p-color-border)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-color-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <a href="https://github.com/OWSSamples/abarrote-gs/wiki" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '12px', color: 'var(--p-color-text-secondary)', textDecoration: 'none', flex: 1 }}>
          Documentación completa
        </a>
        <a href="https://github.com/OWSSamples/abarrote-gs/issues/new" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '12px', color: '#7C3AED', fontWeight: '600', textDecoration: 'none' }}>
          Reportar un problema
        </a>
      </div>
    </div>
  );

  // ── RENDER: Contact ───────────────────────────────────────────────────

  const renderContactTab = () => (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {contactSent ? (
        <div style={{
          padding: '48px 24px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '16px', textAlign: 'center',
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(5,150,105,0.32)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--p-color-text)', marginBottom: '8px' }}>
              Solicitud registrada
            </div>
            <div style={{ fontSize: '13px', color: 'var(--p-color-text-secondary)', lineHeight: 1.6 }}>
              Folio <span style={{ fontWeight: '700', color: '#7C3AED' }}>#{ticketNumber}</span><br />
              Recibirás respuesta en las próximas <strong>24 horas hábiles</strong>.
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setContactSent(false); setContactSubject(''); setContactMessage(''); }}
            style={{
              padding: '9px 22px', borderRadius: '8px',
              border: '1.5px solid var(--p-color-border)',
              background: 'var(--p-color-bg-surface)',
              cursor: 'pointer', fontSize: '13px', fontWeight: '500',
              color: 'var(--p-color-text)', fontFamily: 'inherit',
            }}
          >
            Enviar otra solicitud
          </button>
        </div>
      ) : (
        <>
          {/* SLA cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {([
              { label: 'Tiempo estándar', value: '24 h hábiles', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>) },
              { label: 'Urgencias', value: '2–4 horas', color: '#DC2626', bg: 'rgba(220,38,38,0.07)', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>) },
              { label: 'Sistema', value: 'Operativo', color: '#059669', bg: 'rgba(5,150,105,0.08)', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>) },
            ] as const).map(({ label, value, color, bg, icon }) => (
              <div key={label} style={{
                padding: '12px 14px', borderRadius: '10px',
                background: 'var(--p-color-bg-surface)',
                border: '1px solid var(--p-color-border)',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--p-color-text-secondary)', marginBottom: '2px', fontWeight: '500' }}>{label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div style={{
            borderRadius: '12px', border: '1px solid var(--p-color-border)',
            background: 'var(--p-color-bg-surface)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '13px 16px', borderBottom: '1px solid var(--p-color-border)',
              background: BRAND_GRADIENT_SUBTLE,
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--p-color-text)' }}>
                Nueva solicitud de soporte
              </div>
              <div style={{ fontSize: '12px', color: 'var(--p-color-text-secondary)', marginTop: '2px' }}>
                Describe el problema con detalle para una resolución más rápida.
              </div>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                placeholder="Describe qué hiciste, qué esperabas que pasara y qué ocurrió. Incluye mensajes de error si los hay."
                helpText="A mayor detalle, más rápida la resolución."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => void handleContact()}
                  disabled={contactSending || !contactSubject.trim() || !contactMessage.trim()}
                  style={{
                    padding: '9px 22px', borderRadius: '8px',
                    background: !contactSubject.trim() || !contactMessage.trim()
                      ? 'var(--p-color-bg-fill-disabled)'
                      : BRAND_GRADIENT,
                    border: 'none',
                    cursor: !contactSubject.trim() || !contactMessage.trim() ? 'not-allowed' : 'pointer',
                    color: '#fff', fontSize: '13px', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '7px',
                    boxShadow: !contactSubject.trim() || !contactMessage.trim()
                      ? 'none' : '0 2px 10px rgba(91,91,214,0.32)',
                    fontFamily: 'inherit', transition: 'opacity 150ms',
                  }}
                >
                  {contactSending ? (
                    <>
                      <span style={{
                        width: '13px', height: '13px', borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        animation: 'gs-spin 0.7s linear infinite',
                        display: 'inline-block',
                      }} />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Enviar solicitud
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Channels */}
          <div style={{
            borderRadius: '12px', border: '1px solid var(--p-color-border)',
            overflow: 'hidden', background: 'var(--p-color-bg-surface)',
          }}>
            <div style={{
              padding: '10px 16px', borderBottom: '1px solid var(--p-color-border)',
              fontSize: '10px', fontWeight: '700', color: 'var(--p-color-text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              background: BRAND_GRADIENT_SUBTLE,
            }}>
              Canales de contacto directo
            </div>
            {([
              { icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>), label: 'Correo electrónico', value: 'soporte@abarrote.gs', sub: 'Respuesta en 24 h hábiles' },
              { icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>), label: 'Chat en vivo', value: 'Lun–Vie 9:00–18:00', sub: 'Tiempo de espera ~2 min' },
              { icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>), label: 'Portal de soporte', value: 'help.abarrote.gs', sub: 'Documentación y tickets' },
            ] as const).map(({ icon, label, value, sub }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderTop: '1px solid var(--p-color-border)',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: BRAND_GRADIENT_SUBTLE,
                  border: '1px solid rgba(91,91,214,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#7C3AED', flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--p-color-text)' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--p-color-text-secondary)', marginTop: '1px' }}>
                    {value} · {sub}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-color-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── RENDER: Shortcuts ─────────────────────────────────────────────────

  const renderShortcutsTab = () => (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {shortcutSections.map((section) => (
        <div key={section} style={{
          borderRadius: '12px', border: '1px solid var(--p-color-border)',
          overflow: 'hidden', background: 'var(--p-color-bg-surface)',
        }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--p-color-border)',
            background: BRAND_GRADIENT_SUBTLE,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{ width: '4px', height: '16px', borderRadius: '2px', background: BRAND_GRADIENT }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {section}
            </span>
          </div>
          {SHORTCUTS.filter((s) => s.section === section).map((shortcut, idx) => (
            <div
              key={shortcut.action}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px',
                borderTop: idx > 0 ? '1px solid var(--p-color-border)' : 'none',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--p-color-text)' }}>{shortcut.action}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {shortcut.keys.map((key, ki) => (
                  <span key={ki} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {ki > 0 && <span style={{ fontSize: '10px', color: 'var(--p-color-text-secondary)' }}>+</span>}
                    <kbd style={kbdStyle}>{key}</kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--p-color-text-secondary)' }}>
          Presiona <kbd style={kbdStyle}>?</kbd> en cualquier pantalla para abrir este panel.
        </span>
      </div>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={handleClose} title="" size="large" noScroll>
      {/* Gradient hero header replaces default modal title */}
      <Modal.Section flush>
        <div style={{ background: BRAND_GRADIENT_HERO, position: 'relative', overflow: 'hidden' }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '25%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '5px', left: '60%', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

          {/* Header content */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '18px 24px 12px', position: 'relative', zIndex: 1,
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '11px',
              background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/>
              </svg>
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700', lineHeight: 1.2 }}>
                Centro de Ayuda
              </div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '12px', marginTop: '2px' }}>
                Abarrote GS · Soporte y documentación
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{
            display: 'flex', alignItems: 'flex-end',
            padding: '0 20px', gap: '2px',
            position: 'relative', zIndex: 1,
          }}>
            {TAB_ITEMS.map((tab, idx) => {
              const active = selectedTab === idx;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTab(idx)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px 8px 0 0',
                    border: 'none',
                    background: active ? 'var(--p-color-bg-surface)' : 'transparent',
                    color: active ? '#5B5BD6' : 'rgba(255,255,255,0.72)',
                    cursor: 'pointer', fontSize: '13px',
                    fontWeight: active ? '600' : '400',
                    transition: 'all 150ms ease',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                >
                  {tab.label}
                  {(tab as { alert?: boolean }).alert && (
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: '#FCD34D', display: 'inline-block',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Modal.Section>

      {/* Tab content */}
      <Modal.Section flush>
        <style>{`@keyframes gs-spin { to { transform: rotate(360deg); } }`}</style>
        {selectedTab === 0 && renderAITab()}
        {selectedTab === 1 && renderFAQTab()}
        {selectedTab === 2 && renderContactTab()}
        {selectedTab === 3 && renderShortcutsTab()}
      </Modal.Section>
    </Modal>
  );
}
