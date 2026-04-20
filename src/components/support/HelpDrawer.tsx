'use client';

import Image from 'next/image';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  Card,
  Button,
  TextField,
  Box,
  Badge,
  Banner,
  Collapsible,
  Popover,
  ActionList,
  Icon,
  UnstyledButton,
} from '@shopify/polaris';
import {
  ChatIcon,
  QuestionCircleIcon,
  EmailIcon,
  ExternalIcon,
  RefreshIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XSmallIcon,
  PlusIcon,
  MaximizeIcon,
  EditIcon,
  ClipboardIcon,
  CheckSmallIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  StatusActiveIcon,
  MicrophoneIcon,
  ArrowDownIcon,
  ReplayIcon,
  StopCircleIcon,
  ExportIcon,
  PersonIcon,
  AttachmentIcon,
  TargetIcon,
  ToggleOffIcon,
  ToggleOnIcon,
  SidekickIcon,
} from '@shopify/polaris-icons';
import { GlassCard } from 'react-premium-glass';
import { useRouter } from 'next/navigation';
import { useDashboardStore } from '@/store/dashboardStore';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  timestamp: number;
  suggestions?: string[];
  attachments?: ChatAttachment[];
}

interface ChatAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  type: 'image' | 'document';
}

type PanelView = 'chat' | 'faq' | 'contact' | 'shortcuts';

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

const _QUICK_PROMPTS = [
  '¿Cómo hago un corte de caja?',
  'No puedo conectar la impresora',
  '¿Cómo configuro MercadoPago?',
  '¿Cómo funciona el modo offline?',
  'Error al registrar una venta',
  '¿Cómo exporto mis reportes?',
];

// ── Context sections ───────────────────────────────────────────────────────

const CONTEXT_SECTIONS = [
  { id: 'general', label: 'General', prompt: '' },
  { id: 'pos', label: 'Punto de Venta', prompt: 'El usuario necesita ayuda con el módulo de Punto de Venta (ventas, cobros, tickets, devoluciones).' },
  { id: 'inventory', label: 'Inventario', prompt: 'El usuario necesita ayuda con el módulo de Inventario (productos, stock, categorías, proveedores, mermas).' },
  { id: 'caja', label: 'Caja', prompt: 'El usuario necesita ayuda con el módulo de Caja (cortes, turnos, gastos, diferencias de efectivo).' },
  { id: 'clients', label: 'Clientes', prompt: 'El usuario necesita ayuda con el módulo de Clientes (perfiles, fiado, puntos de lealtad, historial).' },
  { id: 'payments', label: 'Pagos', prompt: 'El usuario necesita ayuda con métodos de pago integrados (MercadoPago, Stripe, Conekta, Clip, SPEI).' },
  { id: 'reports', label: 'Reportes', prompt: 'El usuario necesita ayuda con reportes y analytics (dashboard, exportaciones, KPIs).' },
  { id: 'config', label: 'Configuración', prompt: 'El usuario necesita ayuda con la configuración del sistema (tienda, tickets, hardware, notificaciones, IA).' },
  { id: 'hardware', label: 'Hardware', prompt: 'El usuario necesita ayuda con hardware (impresora térmica, cajón de dinero, báscula, escáner).' },
] as const;

const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3;

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Renders basic markdown: **bold**, `code`, - lists, numbered lists */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet list
    if (/^[-•]\s/.test(line)) {
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: '6px', paddingLeft: '4px' }}>
          <span style={{ color: 'var(--p-color-text-subdued)', flexShrink: 0 }}>•</span>
          <span>{renderInlineMarkdown(line.replace(/^[-•]\s/, ''))}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)[.)]\s/);
    if (numMatch) {
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: '6px', paddingLeft: '4px' }}>
          <span style={{ color: 'var(--p-color-text-subdued)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{numMatch[1]}.</span>
          <span>{renderInlineMarkdown(line.replace(/^\d+[.)]\s/, ''))}</span>
        </div>
      );
      continue;
    }

    // Regular line
    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: '8px' }} />);
    } else {
      nodes.push(<div key={i}>{renderInlineMarkdown(line)}</div>);
    }
  }
  return nodes;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, `code`
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code key={match.index} style={{
          backgroundColor: 'var(--p-color-bg-surface-secondary)',
          padding: '1px 5px',
          borderRadius: '4px',
          fontSize: '13px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {match[3]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/** Contextual follow-up suggestions based on last bot message */
function getSuggestions(lastBotMsg: string): string[] {
  const lower = lastBotMsg.toLowerCase();
  if (lower.includes('venta') || lower.includes('cobrar') || lower.includes('ticket')) {
    return ['¿Cómo aplico un descuento?', '¿Cómo reimprimo un ticket?'];
  }
  if (lower.includes('inventario') || lower.includes('producto') || lower.includes('stock')) {
    return ['¿Cómo recibo mercancía?', '¿Cómo ajusto el stock?'];
  }
  if (lower.includes('pago') || lower.includes('mercadopago') || lower.includes('stripe') || lower.includes('tarjeta')) {
    return ['¿Cómo configuro otro método?', '¿Cómo verifico una transacción?'];
  }
  if (lower.includes('corte') || lower.includes('caja') || lower.includes('efectivo')) {
    return ['¿Cómo registro un gasto?', '¿Cómo veo el historial de cortes?'];
  }
  if (lower.includes('impresora') || lower.includes('imprimir') || lower.includes('hardware')) {
    return ['¿Cómo cambio el tamaño del papel?', '¿Qué impresoras son compatibles?'];
  }
  if (lower.includes('offline') || lower.includes('sincroniz') || lower.includes('conexión')) {
    return ['¿Qué funciona sin internet?', '¿Cómo fuerzo la sincronización?'];
  }
  return [];
}

const NAV_LABELS: Record<PanelView, string> = {
  chat: 'Iniciar conversación',
  faq: 'Base de Conocimiento',
  contact: 'Contacto',
  shortcuts: 'Atajos',
};

// ── Props ──────────────────────────────────────────────────────────────────

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const router = useRouter();
  const aiEnabled = useDashboardStore((s) => s.storeConfig.aiEnabled);

  // Panel navigation
  const [currentView, setCurrentView] = useState<PanelView>('chat');
  const [navOpen, setNavOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [isChatMemoryOn, setIsChatMemoryOn] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('gs_chat_memory');
    return stored !== null ? stored === '1' : true;
  });

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('gs_chat_history');
      if (stored) return JSON.parse(stored) as ChatMsg[];
    } catch { /* corrupted — start fresh */ }
    return [];
  });
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [lastFailedMsg, setLastFailedMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [contextSection, setContextSection] = useState<string>('general');

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

  // ── Effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // Persist chat messages when memory is on
  useEffect(() => {
    if (isChatMemoryOn && chatMessages.length > 0) {
      localStorage.setItem('gs_chat_history', JSON.stringify(chatMessages.slice(-50)));
    }
  }, [chatMessages, isChatMemoryOn]);

  const handleClose = useCallback(() => {
    setNavOpen(false);
    setPromptsOpen(false);
    setFaqSearch('');
    setExpandedFaq(null);
    setChatInput('');
    setChatError(null);
    setContactSent(false);
    setContactSubject('');
    setContactMessage('');
    onClose();
  }, [onClose]);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      );
    };

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setCurrentView('shortcuts');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('.ctb-search-native');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        setCurrentView('chat');
        return;
      }

      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'd') {
          e.preventDefault();
          router.push('/dashboard');
          handleClose();
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          router.push('/dashboard/sales');
          handleClose();
          return;
        }
        if (key === 'i') {
          e.preventDefault();
          router.push('/dashboard/products/inventory');
          handleClose();
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          router.push('/dashboard/sales/corte');
          handleClose();
          return;
        }
        if (key === 'r') {
          e.preventDefault();
          router.push('/dashboard/analytics/reports');
          handleClose();
          return;
        }
      }

      if (!isTypingTarget(e.target)) {
        if (e.key === 'F2') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('gs-pos-shortcut', { detail: { action: 'manual-search' } }));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('gs-pos-shortcut', { detail: { action: 'checkout' } }));
          return;
        }
        if (e.key === 'Delete') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('gs-pos-shortcut', { detail: { action: 'remove-item' } }));
          return;
        }
        if (e.key === '+' || (e.key === '=' && e.shiftKey) || e.key === 'Add') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('gs-pos-shortcut', { detail: { action: 'inc-qty' } }));
          return;
        }
        if (e.key === '-' || e.key === 'Subtract') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('gs-pos-shortcut', { detail: { action: 'dec-qty' } }));
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleClose, router]);

  // ── Chat logic ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatLoading) return;

      const history = chatMessages
        .filter((m) => !m.error)
        .slice(-14)
        .map((m) => ({ role: m.role, content: m.content }));

      // Build context-enriched message
      const sectionCtx = CONTEXT_SECTIONS.find((s) => s.id === contextSection);
      const contextPrefix = sectionCtx && sectionCtx.id !== 'general' ? `[Contexto: ${sectionCtx.label}] ` : '';

      // Capture and clear pending attachments
      const currentAttachments = [...pendingAttachments];
      const attachmentNote = currentAttachments.length > 0
        ? ` [${currentAttachments.length} archivo(s) adjunto(s): ${currentAttachments.map((a) => a.file.name).join(', ')}]`
        : '';

      const enrichedMessage = `${contextPrefix}${trimmed}${attachmentNote}`;

      const userMsg: ChatMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput('');
      setPendingAttachments([]);
      setChatLoading(true);
      setChatError(null);
      setLastFailedMsg(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch('/api/support-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: enrichedMessage, history }),
          signal: controller.signal,
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok || !data.reply) throw new Error(data.error ?? 'Error al conectar con el asistente');

        const suggestions = getSuggestions(data.reply);
        setChatMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: data.reply!, timestamp: Date.now(), suggestions },
        ]);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled — do nothing
          return;
        }
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setChatError(msg);
        setLastFailedMsg(trimmed);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: 'No pude generar una respuesta. Verifica que la IA esté configurada e intenta de nuevo.',
            error: true,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        abortControllerRef.current = null;
        setChatLoading(false);
      }
    },
    [chatLoading, chatMessages, contextSection, pendingAttachments],
  );

  const handleStopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setChatLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    if (lastFailedMsg) {
      // Remove the last error message
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.error) return prev.slice(0, -1);
        return prev;
      });
      // Also remove the last user message that failed
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'user') return prev.slice(0, -1);
        return prev;
      });
      void sendMessage(lastFailedMsg);
    }
  }, [lastFailedMsg, sendMessage]);

  const handleChatKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(chatInput);
      }
    },
    [chatInput, sendMessage],
  );

  const handleNewChat = useCallback(() => {
    setChatMessages([]);
    setChatInput('');
    setChatError(null);
    setCopiedMsgId(null);
    setLastFailedMsg(null);
    setPendingAttachments((prev) => {
      prev.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
      return [];
    });
    setContextSection('general');
    localStorage.removeItem('gs_chat_history');
  }, []);

  const toggleChatMemory = useCallback(() => {
    setIsChatMemoryOn((prev) => {
      const next = !prev;
      localStorage.setItem('gs_chat_memory', next ? '1' : '0');
      if (!next) {
        localStorage.removeItem('gs_chat_history');
      }
      return next;
    });
  }, []);

  const handleCopyMessage = useCallback((msgId: string, content: string) => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId((prev) => (prev === msgId ? null : prev)), 2000);
    });
  }, []);

  const handleExportChat = useCallback(() => {
    if (chatMessages.length === 0) return;
    const lines = chatMessages.map((m) => {
      const time = formatTimestamp(m.timestamp);
      const role = m.role === 'user' ? 'Tú' : 'Kiosko';
      return `[${time}] ${role}: ${m.content}`;
    });
    const text = `Conversación de Soporte — Kiosko\nExportada: ${new Date().toLocaleString('es-MX')}\n${'─'.repeat(48)}\n\n${lines.join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-soporte-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chatMessages]);

  const handleEscalateToHuman = useCallback(() => {
    // Pre-fill contact form with conversation context
    const summary = chatMessages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Yo' : 'Bot'}: ${m.content}`)
      .join('\n');
    setContactSubject('Escalación desde chat IA');
    setContactMessage(`Contexto de la conversación:\n\n${summary}\n\n---\nDescripción del problema:\n`);
    setCurrentView('contact');
  }, [chatMessages]);

  // Scroll detection for "scroll to bottom" button
  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  // ── File attachment logic ──────────────────────────────────────────────

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: ChatAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ALLOWED_FILE_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_SIZE) continue;
      const isImage = file.type.startsWith('image/');
      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        type: isImage ? 'image' : 'document',
      });
    }

    setPendingAttachments((prev) => {
      const combined = [...prev, ...newAttachments].slice(0, MAX_FILES);
      return combined;
    });

    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context section helper ─────────────────────────────────────────────

  const activeSection = CONTEXT_SECTIONS.find((s) => s.id === contextSection);
  const contextLabel = activeSection && activeSection.id !== 'general' ? activeSection.label : null;

  // Message count for header
  const messageCount = useMemo(() => chatMessages.filter((m) => !m.error).length, [chatMessages]);

  // ── FAQ logic ──────────────────────────────────────────────────────────

  const filteredFaq = FAQ_ITEMS.filter((item) => {
    const matchesCategory = faqCategory === 'all' || item.category === faqCategory;
    const query = faqSearch.toLowerCase();
    const matchesSearch =
      query === '' ||
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  // ── Contact logic ──────────────────────────────────────────────────────

  const handleContact = useCallback(async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) return;
    setContactSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    setContactSent(true);
    setContactSending(false);
  }, [contactSubject, contactMessage]);

  // ── Derived state ──────────────────────────────────────────────────────

  const shortcutSections = [...new Set(SHORTCUTS.map((s) => s.section))];

  const headerLabel =
    currentView === 'chat' && chatMessages.length > 0
      ? (() => {
          const first = chatMessages.find((m) => m.role === 'user');
          if (!first) return 'Conversación';
          return first.content.length > 28 ? first.content.slice(0, 28) + '…' : first.content;
        })()
      : NAV_LABELS[currentView];

  // ── Styles ─────────────────────────────────────────────────────────────

  const kbdStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: 'var(--p-border-radius-100)',
    border: '1px solid var(--p-color-border)',
    backgroundColor: 'var(--p-color-bg-surface)',
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontWeight: '500',
    color: 'var(--p-color-text)',
    boxShadow: '0 1px 0 var(--p-color-border)',
    whiteSpace: 'nowrap' as const,
  };

  const headerIconBtnStyle: React.CSSProperties = {
    all: 'unset',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--p-border-radius-200)',
    color: 'var(--p-color-icon)',
    transition: 'background-color 100ms ease',
  };

  const msgActionBtnStyle: React.CSSProperties = {
    all: 'unset',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: 'var(--p-border-radius-150)',
    color: 'var(--p-color-icon-secondary)',
    transition: 'background-color 100ms ease, color 100ms ease',
  };

  // ── Early return ───────────────────────────────────────────────────────

  if (!open) return null;

  // ── Chat view: empty state ─────────────────────────────────────────────

  const renderChatEmpty = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '48px 32px',
      }}
    >
      {/* Mascot */}
      <div style={{ marginBottom: '20px', animation: 'gs-mascot-float 3s ease-in-out infinite' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="none" width="120" height="120" aria-hidden="true">
          <defs>
            <radialGradient id="mBg" cx="50%" cy="45%" r="52%">
              <stop offset="0%" stopColor="#EDE0FF"/><stop offset="100%" stopColor="#C4A8FF"/>
            </radialGradient>
            <radialGradient id="mBody" cx="40%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#9B59FF"/><stop offset="100%" stopColor="#5B0FCC"/>
            </radialGradient>
            <radialGradient id="mHead" cx="38%" cy="30%" r="62%">
              <stop offset="0%" stopColor="#B57BFF"/><stop offset="100%" stopColor="#6E20E0"/>
            </radialGradient>
            <radialGradient id="mEye" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#FFFFFF"/><stop offset="70%" stopColor="#E8D5FF"/><stop offset="100%" stopColor="#C0A0FF"/>
            </radialGradient>
            <radialGradient id="mPupil" cx="35%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#9B59FF"/><stop offset="100%" stopColor="#1C004F"/>
            </radialGradient>
            <linearGradient id="mAntenna" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF6BF8"/><stop offset="100%" stopColor="#7126FF"/>
            </linearGradient>
            <filter id="mGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="mShadow"><feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#5B0FCC" floodOpacity="0.3"/></filter>
          </defs>

          {/* Background */}
          <circle cx="150" cy="150" r="138" fill="url(#mBg)"/>
          <circle cx="150" cy="150" r="138" fill="none" stroke="#D0AAFF" strokeWidth="2"/>

          {/* Sparkles — rotating */}
          <g style={{ transformOrigin: '150px 150px', animation: 'gs-mascot-sparkle-rotate 20s linear infinite' }}>
            <path d="M62 72 l4 10 l10 4 l-10 4 l-4 10 l-4-10 l-10-4 l10-4z" fill="#FF6BF8" opacity="0.85"/>
            <path d="M232 58 l3 7 l7 3 l-7 3 l-3 7 l-3-7 l-7-3 l7-3z" fill="#6BFFF8" opacity="0.85"/>
            <circle cx="240" cy="100" r="5" fill="#FFD700" opacity="0.8"/>
            <circle cx="55" cy="118" r="4" fill="#FF9BF8" opacity="0.75"/>
            <circle cx="88" cy="50" r="3" fill="#9BFFF8" opacity="0.75"/>
            <circle cx="214" cy="82" r="3.5" fill="#FFB347" opacity="0.75"/>
          </g>

          {/* Body — breathing */}
          <g filter="url(#mShadow)" style={{ transformOrigin: '150px 228px', animation: 'gs-mascot-breathe 4s ease-in-out infinite' }}>
            <rect x="96" y="192" width="108" height="72" rx="20" fill="url(#mBody)"/>
            <rect x="106" y="198" width="88" height="8" rx="4" fill="white" opacity="0.15"/>
            <rect x="114" y="214" width="72" height="36" rx="10" fill="#1C004F" opacity="0.35"/>
            {/* LEDs — staggered pulse */}
            <circle cx="132" cy="226" r="5" fill="#6BFFF8" style={{ animation: 'gs-mascot-led-pulse 1.5s ease-in-out 0s infinite' }}/>
            <circle cx="150" cy="226" r="5" fill="#FF9BF8" style={{ animation: 'gs-mascot-led-pulse 1.5s ease-in-out 0.3s infinite' }}/>
            <circle cx="168" cy="226" r="5" fill="#FFD700" style={{ animation: 'gs-mascot-led-pulse 1.5s ease-in-out 0.6s infinite' }}/>
            <rect x="126" y="238" width="48" height="6" rx="3" fill="white" opacity="0.8"/>
          </g>

          {/* Arms — left waves */}
          <g style={{ transformOrigin: '74px 198px', animation: 'gs-mascot-wave 6s ease-in-out infinite' }}>
            <rect x="58" y="198" width="32" height="52" rx="16" fill="url(#mBody)"/>
            <circle cx="74" cy="258" r="13" fill="url(#mHead)"/>
          </g>
          {/* Right arm */}
          <rect x="210" y="198" width="32" height="52" rx="16" fill="url(#mBody)"/>
          <circle cx="226" cy="258" r="13" fill="url(#mHead)"/>

          <rect x="132" y="178" width="36" height="20" rx="8" fill="url(#mBody)"/>

          {/* Head */}
          <g filter="url(#mShadow)">
            <rect x="76" y="86" width="148" height="102" rx="34" fill="url(#mHead)"/>
            <ellipse cx="128" cy="100" rx="38" ry="12" fill="white" opacity="0.15"/>
          </g>

          {/* Antenna — swaying */}
          <g style={{ transformOrigin: '150px 92px', animation: 'gs-mascot-antenna-sway 3s ease-in-out infinite' }}>
            <rect x="146" y="56" width="8" height="36" rx="4" fill="url(#mAntenna)"/>
            <circle cx="150" cy="50" r="11" fill="url(#mAntenna)" filter="url(#mGlow)"/>
            <circle cx="150" cy="50" r="7" fill="#FFD700" style={{ animation: 'gs-mascot-antenna-glow 2s ease-in-out infinite' }}/>
            <circle cx="147" cy="47" r="2.5" fill="white" opacity="0.8"/>
          </g>

          {/* Left eye — blinking */}
          <ellipse cx="118" cy="136" rx="22" ry="24" fill="url(#mEye)"/>
          <g style={{ transformOrigin: '118px 136px', animation: 'gs-mascot-blink 5s ease-in-out infinite' }}>
            <ellipse cx="118" cy="138" rx="15" ry="17" fill="url(#mPupil)"/>
            <g style={{ animation: 'gs-mascot-pupil-look 8s ease-in-out infinite' }}>
              <circle cx="118" cy="136" r="8" fill="#7126FF"/>
              <circle cx="118" cy="134" r="4" fill="white"/>
            </g>
          </g>
          <circle cx="112" cy="130" r="3" fill="white" opacity="0.9"/>

          {/* Right eye — blinking */}
          <ellipse cx="182" cy="136" rx="22" ry="24" fill="url(#mEye)"/>
          <g style={{ transformOrigin: '182px 136px', animation: 'gs-mascot-blink 5s ease-in-out 0.1s infinite' }}>
            <ellipse cx="182" cy="138" rx="15" ry="17" fill="url(#mPupil)"/>
            <g style={{ animation: 'gs-mascot-pupil-look 8s ease-in-out infinite' }}>
              <circle cx="182" cy="136" r="8" fill="#7126FF"/>
              <circle cx="182" cy="134" r="4" fill="white"/>
            </g>
          </g>
          <circle cx="176" cy="130" r="3" fill="white" opacity="0.9"/>

          {/* Mouth — smiling */}
          <path d="M124 166 Q150 180 176 166" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9"/>
          <path d="M124 166 Q150 180 176 166" stroke="#FF9BF8" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>

          {/* Chat bubble */}
          <g style={{ animation: 'gs-mascot-chat-pop 3s ease-in-out infinite' }}>
            <rect x="210" y="58" width="58" height="36" rx="12" fill="#FF6BF8"/>
            <path d="M218 94 l-8 10 l18 0z" fill="#FF6BF8"/>
            <circle cx="228" cy="76" r="4" fill="white"/>
            <circle cx="240" cy="76" r="4" fill="white"/>
            <circle cx="252" cy="76" r="4" fill="white"/>
          </g>
        </svg>
      </div>

      <Text as="p" variant="bodyLg" tone="subdued">
        {getGreeting()}
      </Text>
      <div style={{ marginTop: '4px', marginBottom: '28px' }}>
        <Text as="h2" variant="headingLg" fontWeight="bold">
          ¿Cómo puedo ayudarte?
        </Text>
      </div>

      {/* Suggestion chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '4px' }}>
        {['¿Qué hay de nuevo?', '¿Cómo registro una venta?', '¿Cómo hago un corte?'].map((prompt) => (
          <GlassCard
            key={prompt}
            enableWebGL={false}
            style={{
              borderRadius: '20px',
              padding: '0',
              cursor: aiEnabled && !chatLoading ? 'pointer' : 'default',
              opacity: aiEnabled && !chatLoading ? 1 : 0.5,
            }}
          >
            <button
              onClick={() => aiEnabled && !chatLoading && void sendMessage(prompt)}
              disabled={!aiEnabled || chatLoading}
              style={{
                all: 'unset',
                display: 'block',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--p-color-text)',
                whiteSpace: 'nowrap',
                cursor: 'inherit',
              }}
            >
              {prompt}
            </button>
          </GlassCard>
        ))}
      </div>

      {!aiEnabled && (
        <div style={{ marginTop: '24px', maxWidth: '320px' }}>
          <Banner
            tone="warning"
            title="Asistente no disponible"
            action={{ content: 'Configurar IA', url: '/settings?section=ai' }}
          >
            Activa un proveedor de IA en Configuración.
          </Banner>
        </div>
      )}
    </div>
  );

  // ── Chat view: messages ────────────────────────────────────────────────

  const renderChatMessages = () => (
    <div style={{ height: '100%', position: 'relative' }}>
      <div
        ref={chatContainerRef}
        onScroll={handleChatScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px 16px 24px',
        }}
      >
        {chatError && (
          <div style={{ marginBottom: '8px' }}>
            <Banner tone="critical" onDismiss={() => setChatError(null)}>
              {chatError}
            </Banner>
          </div>
        )}

        {chatMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isLast = idx === chatMessages.length - 1;
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                animation: 'gs-msg-in 200ms ease-out',
              }}
            >
              {isUser ? (
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: 'var(--p-border-radius-full)',
                    backgroundColor: '#f3f3f1',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: 'var(--p-color-text)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {/* Inline attachment thumbnails */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          style={{
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--p-color-border)',
                            backgroundColor: 'var(--p-color-bg-surface)',
                          }}
                        >
                          {att.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={att.previewUrl}
                              alt={att.file.name}
                              style={{ width: '80px', height: '60px', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{
                              width: '80px',
                              height: '60px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              padding: '4px',
                            }}>
                              <Icon source={AttachmentIcon} tone="subdued" />
                              <span style={{ fontSize: '9px', color: 'var(--p-color-text-subdued)', textAlign: 'center', lineHeight: '1.1', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '72px', whiteSpace: 'nowrap' }}>
                                {att.file.name}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.content}
                </div>
              ) : (
                <div style={{ maxWidth: '100%' }}>
                  <div
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: msg.error ? 'var(--p-color-text-caution)' : 'var(--p-color-text)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.error ? msg.content : renderMarkdown(msg.content)}
                  </div>
                  {!msg.error && (
                    <InlineStack gap="050" blockAlign="center">
                      <UnstyledButton onClick={() => handleCopyMessage(msg.id, msg.content)} accessibilityLabel="Copiar">
                        <div style={msgActionBtnStyle} title="Copiar">
                          <Icon source={copiedMsgId === msg.id ? CheckSmallIcon : ClipboardIcon} tone="subdued" />
                        </div>
                      </UnstyledButton>
                      <UnstyledButton accessibilityLabel="Me gusta">
                        <div style={msgActionBtnStyle} title="Me gusta">
                          <Icon source={ThumbsUpIcon} tone="subdued" />
                        </div>
                      </UnstyledButton>
                      <UnstyledButton accessibilityLabel="No me gusta">
                        <div style={msgActionBtnStyle} title="No me gusta">
                          <Icon source={ThumbsDownIcon} tone="subdued" />
                        </div>
                      </UnstyledButton>
                    </InlineStack>
                  )}
                  {/* Retry button on error */}
                  {msg.error && lastFailedMsg && (
                    <div style={{ marginTop: '8px' }}>
                      <Button variant="plain" size="slim" icon={ReplayIcon} onClick={handleRetry}>
                        Reintentar
                      </Button>
                    </div>
                  )}
                  {/* Contextual follow-up suggestions */}
                  {!msg.error && isLast && msg.suggestions && msg.suggestions.length > 0 && !chatLoading && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                      {msg.suggestions.map((suggestion) => (
                        <GlassCard
                          key={suggestion}
                          enableWebGL={false}
                          style={{
                            borderRadius: '16px',
                            padding: '0',
                            cursor: chatLoading ? 'default' : 'pointer',
                          }}
                        >
                          <button
                            onClick={() => !chatLoading && void sendMessage(suggestion)}
                            disabled={chatLoading}
                            style={{
                              all: 'unset',
                              display: 'block',
                              padding: '5px 12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: 'var(--p-color-text)',
                              whiteSpace: 'nowrap',
                              cursor: 'inherit',
                            }}
                          >
                            {suggestion}
                          </button>
                        </GlassCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Timestamp */}
              <div style={{ marginTop: '3px', paddingInline: '4px' }}>
                <Text as="span" variant="bodySm" tone="subdued">
                  {formatTimestamp(msg.timestamp)}
                </Text>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator with stop button */}
        {chatLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: 'gs-msg-in 200ms ease-out',
            }}
          >
            <InlineStack gap="100" blockAlign="center">
              {[0, 200, 400].map((delay) => (
                <span
                  key={delay}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--p-color-icon-interactive)',
                    display: 'inline-block',
                    animation: `gs-dot-pulse 1.4s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </InlineStack>
            <Text as="span" variant="bodySm" tone="subdued">
              Pensando...
            </Text>
            <UnstyledButton onClick={handleStopGeneration} accessibilityLabel="Detener generación">
              <div style={{ ...msgActionBtnStyle, color: 'var(--p-color-icon-caution)' }} title="Detener">
                <Icon source={StopCircleIcon} tone="caution" />
              </div>
            </UnstyledButton>
          </div>
        )}

        {/* Escalate to human — shown after 4+ messages */}
        {chatMessages.length >= 4 && !chatLoading && (
          <div style={{ textAlign: 'center', paddingTop: '4px' }}>
            <Button variant="plain" size="slim" icon={PersonIcon} onClick={handleEscalateToHuman}>
              Hablar con un agente humano
            </Button>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}>
          <Button variant="secondary" size="slim" icon={ArrowDownIcon} onClick={scrollToBottom}>
            Nuevo mensaje
          </Button>
        </div>
      )}
    </div>
  );

  // ── Chat view wrapper ──────────────────────────────────────────────────

  const renderChatView = () => {
    if (chatMessages.length === 0 && !chatLoading) return renderChatEmpty();
    return renderChatMessages();
  };

  // ── FAQ view ───────────────────────────────────────────────────────────

  const renderFAQView = () => {
    const activeCategoryLabel = FAQ_CATEGORIES.find((cat) => cat.id === faqCategory)?.label ?? 'Todas';

    return (
      <Box padding="300">
        <BlockStack gap="300">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <BlockStack gap="050">
                  <Text as="h3" variant="headingMd">
                    Base de Conocimiento
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Guías rápidas para resolver dudas del sistema.
                  </Text>
                </BlockStack>
                <Badge tone="info" size="medium">
                  {`${filteredFaq.length} ${filteredFaq.length === 1 ? 'artículo' : 'artículos'}`}
                </Badge>
              </InlineStack>

              <TextField
                label="Buscar"
                labelHidden
                value={faqSearch}
                onChange={setFaqSearch}
                placeholder="Buscar en la base de conocimiento..."
                autoComplete="off"
                prefix={<Icon source={SearchIcon} tone="base" />}
                clearButton
                onClearButtonClick={() => setFaqSearch('')}
              />

              <div style={{ overflowX: 'auto', paddingBottom: '2px' }}>
                <InlineStack gap="200" wrap={false}>
                  {FAQ_CATEGORIES.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={faqCategory === cat.id ? 'primary' : 'secondary'}
                      size="slim"
                      onClick={() => {
                        setFaqCategory(cat.id);
                        setExpandedFaq(null);
                      }}
                    >
                      {cat.label}
                    </Button>
                  ))}
                </InlineStack>
              </div>

              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <Text as="p" variant="bodySm" tone="subdued">
                  Categoría activa: {activeCategoryLabel}
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
            </BlockStack>
          </Card>

          {filteredFaq.length === 0 ? (
            <Card>
              <Box padding="500">
                <BlockStack gap="150" inlineAlign="center">
                  <Text as="p" alignment="center" tone="subdued">
                    No encontramos artículos para “{faqSearch}”.
                  </Text>
                  <Text as="p" alignment="center" variant="bodySm" tone="subdued">
                    Prueba con otra palabra o cambia la categoría.
                  </Text>
                </BlockStack>
              </Box>
            </Card>
          ) : (
            <Card padding="0">
              {filteredFaq.map((faq, idx) => {
                const isExpanded = expandedFaq === idx;
                const catLabel = FAQ_CATEGORIES.find((c) => c.id === faq.category)?.label;
                return (
                  <Box
                    key={faq.question}
                    borderBlockStartWidth={idx > 0 ? '025' : '0'}
                    borderColor="border"
                    padding="300"
                  >
                    <BlockStack gap="200">
                      <UnstyledButton onClick={() => setExpandedFaq(isExpanded ? null : idx)}>
                        <InlineStack align="space-between" blockAlign="start" wrap={false}>
                          <BlockStack gap="100">
                            {catLabel && (
                              <span>
                                <Badge tone="attention" size="small">
                                  {catLabel}
                                </Badge>
                              </span>
                            )}
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {faq.question}
                            </Text>
                          </BlockStack>
                          <Box>
                            <Icon source={isExpanded ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
                          </Box>
                        </InlineStack>
                      </UnstyledButton>

                      <Collapsible
                        id={`faq-${idx}`}
                        open={isExpanded}
                        transition={{ duration: '180ms', timingFunction: 'ease' }}
                      >
                        <Box
                          padding="300"
                          borderRadius="200"
                          background="bg-surface-secondary"
                          borderColor="border"
                          borderWidth="025"
                        >
                          <Text as="p" variant="bodySm" tone="subdued">
                            <span style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>{faq.answer}</span>
                          </Text>
                        </Box>
                      </Collapsible>
                    </BlockStack>
                  </Box>
                );
              })}
            </Card>
          )}

          <Card>
            <InlineStack gap="300" wrap>
              <Button
                url="https://github.com/OWSSamples/kiosko/wiki"
                external
                icon={ExternalIcon}
                size="slim"
                variant="secondary"
              >
                Ver documentación
              </Button>
              <Button
                url="https://github.com/OWSSamples/kiosko/issues/new"
                external
                icon={ExternalIcon}
                size="slim"
                variant="plain"
              >
                Reportar problema
              </Button>
            </InlineStack>
          </Card>
        </BlockStack>
      </Box>
    );
  };

  // ── Contact view ───────────────────────────────────────────────────────

  const renderContactView = () => (
    <Box padding="400">
      <BlockStack gap="400">
        {contactSent ? (
          <Card>
            <Box padding="600">
              <BlockStack gap="300" inlineAlign="center">
                <Box>
                  <div style={{ color: 'var(--p-color-icon-success)' }}>
                    <Icon source={StatusActiveIcon} tone="success" />
                  </div>
                </Box>
                <Text as="h2" variant="headingMd" alignment="center">
                  Solicitud registrada
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Folio <strong>#{ticketNumber}</strong>. Recibirás respuesta en las próximas{' '}
                  <strong>24 horas hábiles</strong>.
                </Text>
                <InlineStack align="center">
                  <Button
                    onClick={() => {
                      setContactSent(false);
                      setContactSubject('');
                      setContactMessage('');
                    }}
                  >
                    Enviar otra solicitud
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          </Card>
        ) : (
          <>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <InlineStack gap="400" wrap>
                <BlockStack gap="050">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Tiempo de respuesta
                  </Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    24 horas hábiles
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Urgencias críticas
                  </Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    2–4 horas
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Estado del sistema
                  </Text>
                  <InlineStack gap="100" blockAlign="center">
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--p-color-icon-success)',
                        display: 'inline-block',
                      }}
                    />
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Operativo
                    </Text>
                  </InlineStack>
                </BlockStack>
              </InlineStack>
            </Box>

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
                  placeholder="Describe el problema con detalle: qué hiciste, qué esperabas que pasara y qué ocurrió realmente."
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

            <Card padding="0">
              <Box padding="300">
                <Text as="h3" variant="headingMd">
                  Canales de contacto directo
                </Text>
              </Box>
              {[
                {
                  icon: EmailIcon,
                  label: 'Correo electrónico',
                  value: 'soporte@kiosko.app',
                  detail: 'Respuesta en 24 h hábiles',
                },
                {
                  icon: ChatIcon,
                  label: 'Chat en vivo',
                  value: 'Lunes a Viernes 9:00–18:00',
                  detail: 'Tiempo de espera ~2 min',
                },
                {
                  icon: QuestionCircleIcon,
                  label: 'Portal de soporte',
                  value: 'help.kiosko.app',
                  detail: 'Documentación y tickets',
                },
              ].map(({ icon: ChannelIcon, label, value, detail }) => (
                <Box key={label} borderBlockStartWidth="025" borderColor="border" padding="300">
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--p-border-radius-200)',
                        backgroundColor: 'var(--p-color-bg-surface-secondary)',
                        border: '1px solid var(--p-color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon source={ChannelIcon} tone="base" />
                    </div>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {label}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {value} · {detail}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              ))}
            </Card>
          </>
        )}
      </BlockStack>
    </Box>
  );

  // ── Shortcuts view ─────────────────────────────────────────────────────

  const renderShortcutsView = () => (
    <Box padding="400">
      <BlockStack gap="400">
        {shortcutSections.map((section) => (
          <Card key={section} padding="0">
            <Box
              padding="300"
              background="bg-surface-secondary"
              borderBlockEndWidth="025"
              borderColor="border"
            >
              <Text as="h3" variant="headingSm">
                {section}
              </Text>
            </Box>
            {SHORTCUTS.filter((s) => s.section === section).map((shortcut, idx) => (
              <Box
                key={shortcut.action}
                borderBlockStartWidth={idx > 0 ? '025' : '0'}
                borderColor="border"
                padding="300"
              >
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <Text as="span" variant="bodySm">
                    {shortcut.action}
                  </Text>
                  <InlineStack gap="100" blockAlign="center">
                    {shortcut.keys.map((key, ki) => (
                      <span
                        key={ki}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {ki > 0 && (
                          <Text as="span" variant="bodySm" tone="subdued">
                            +
                          </Text>
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
    </Box>
  );

  // ── Main render: Side panel ────────────────────────────────────────────

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes gs-panel-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes gs-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes gs-dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes gs-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gs-mascot-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes gs-mascot-breathe {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.03); }
        }
        @keyframes gs-mascot-blink {
          0%, 42%, 48%, 100% { transform: scaleY(1); }
          45% { transform: scaleY(0.08); }
        }
        @keyframes gs-mascot-antenna-sway {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(8deg); }
          75% { transform: rotate(-8deg); }
        }
        @keyframes gs-mascot-antenna-glow {
          0%, 100% { opacity: 0.6; r: 7; }
          50% { opacity: 1; r: 10; }
        }
        @keyframes gs-mascot-pupil-look {
          0%, 35%, 65%, 100% { transform: translateX(0); }
          40%, 60% { transform: translateX(3px); }
        }
        @keyframes gs-mascot-wave {
          0%, 30%, 100% { transform: rotate(0deg); }
          5% { transform: rotate(-12deg); }
          10% { transform: rotate(14deg); }
          15% { transform: rotate(-10deg); }
          20% { transform: rotate(8deg); }
          25% { transform: rotate(0deg); }
        }
        @keyframes gs-mascot-chat-pop {
          0%, 100% { transform: scale(1) translateY(0); opacity: 1; }
          50% { transform: scale(1.08) translateY(-2px); opacity: 0.9; }
        }
        @keyframes gs-mascot-led-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes gs-mascot-mouth-talk {
          0%, 70%, 100% { d: path("M124 166 Q150 180 176 166"); }
          10% { d: path("M124 166 Q150 188 176 166"); }
          20% { d: path("M124 166 Q150 175 176 166"); }
          35% { d: path("M124 166 Q150 190 176 166"); }
          50% { d: path("M124 166 Q150 172 176 166"); }
          60% { d: path("M124 166 Q150 185 176 166"); }
        }
        @keyframes gs-mascot-sparkle-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .gs-chat-input-wrapper {
          flex: 1;
          background: #f3f4f6;
          border: 1px solid rgba(28, 31, 35, 0.14);
          border-radius: 18px;
          padding: 0;
          transition: background-color 160ms ease;
        }
        .gs-chat-input-wrapper .Polaris-TextField {
          --pc-text-field-background: transparent;
          --pc-text-field-background-hover: transparent;
          --pc-text-field-background-active: transparent;
          --pc-text-field-border: transparent;
          --pc-text-field-border-hover: transparent;
          --pc-text-field-border-focus: transparent;
          --pc-text-field-shadow: none;
          --pc-text-field-backdrop-filter: none;
          background: transparent !important;
          border: none !important;
          border-radius: 18px;
          box-shadow: none !important;
          min-height: 38px;
          padding-inline: 0;
          transition: background-color 160ms ease, box-shadow 160ms ease;
        }
        .gs-chat-input-wrapper .Polaris-TextField::before,
        .gs-chat-input-wrapper .Polaris-TextField::after,
        .gs-chat-input-wrapper .Polaris-TextField__Backdrop {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .gs-chat-input-wrapper .Polaris-TextField:hover {
          background: transparent !important;
        }
        .gs-chat-input-wrapper .Polaris-TextField:focus-within {
          background: transparent !important;
          box-shadow: none !important;
        }
        .gs-chat-input-wrapper:focus-within {
          background: #eef0f3;
        }
        .gs-chat-input-wrapper .Polaris-TextField__Input {
          border: none !important;
          background: transparent !important;
          padding: 8px 16px !important;
          font-size: 14px !important;
          line-height: 1.4 !important;
          color: var(--p-color-text) !important;
          box-shadow: none !important;
        }
        .gs-chat-input-wrapper .Polaris-TextField__Input::placeholder {
          color: var(--p-color-text-subdued) !important;
        }
        .gs-chat-input-wrapper .Polaris-TextField__Input:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: '52px',
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.12)',
          zIndex: 519,
          animation: 'gs-backdrop-in 200ms ease-out',
          overscrollBehavior: 'contain',
        }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Side panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Centro de Ayuda"
        style={{
          position: 'fixed',
          top: '60px',
          right: '8px',
          bottom: '8px',
          width: '420px',
          maxWidth: 'calc(100vw - 16px)',
          backgroundColor: 'var(--p-color-bg-surface)',
          borderRadius: '16px',
          boxShadow: isChatMemoryOn
            ? '-10px 0 36px rgba(113, 38, 255, 0.12), -2px 0 10px rgba(0, 0, 0, 0.04)'
            : '-8px 0 26px rgba(0, 0, 0, 0.08), -2px 0 8px rgba(0, 0, 0, 0.04)',
          zIndex: 520,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'gs-panel-in 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 0 16px',
            height: '52px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
            flexShrink: 0,
            background: 'rgba(255, 255, 255, 0.62)',
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          }}
        >
          {/* Navigation dropdown */}
          <Popover
            active={navOpen}
            activator={
              <UnstyledButton onClick={() => setNavOpen((v) => !v)}>
                <InlineStack gap="100" blockAlign="center">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {headerLabel}
                  </Text>
                  {currentView === 'chat' && messageCount > 0 && (
                    <Badge tone="info" size="small">
                      {String(messageCount)}
                    </Badge>
                  )}
                  <Icon source={ChevronDownIcon} tone="base" />
                </InlineStack>
              </UnstyledButton>
            }
            onClose={() => setNavOpen(false)}
            preferredAlignment="left"
          >
            <ActionList
              items={[
                {
                  content: 'Iniciar conversación',
                  icon: SidekickIcon,
                  active: currentView === 'chat',
                  onAction: () => setCurrentView('chat'),
                },
                {
                  content: 'Base de Conocimiento',
                  icon: QuestionCircleIcon,
                  active: currentView === 'faq',
                  onAction: () => setCurrentView('faq'),
                },
                {
                  content: 'Contacto',
                  icon: EmailIcon,
                  active: currentView === 'contact',
                  onAction: () => setCurrentView('contact'),
                },
                {
                  content: 'Atajos de teclado',
                  icon: ExternalIcon,
                  active: currentView === 'shortcuts',
                  onAction: () => setCurrentView('shortcuts'),
                },
              ]}
              onActionAnyItem={() => setNavOpen(false)}
            />
          </Popover>

          {/* Header action icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {currentView === 'chat' && chatMessages.length > 0 ? (
              <>
                <UnstyledButton
                  accessibilityLabel="Exportar conversación"
                  onClick={handleExportChat}
                >
                  <div style={headerIconBtnStyle} title="Exportar conversación">
                    <Icon source={ExportIcon} tone="subdued" />
                  </div>
                </UnstyledButton>
                <UnstyledButton
                  accessibilityLabel="Nueva conversación"
                  onClick={handleNewChat}
                >
                  <div style={headerIconBtnStyle} title="Nueva conversación">
                    <Icon source={EditIcon} tone="subdued" />
                  </div>
                </UnstyledButton>
              </>
            ) : (
              <UnstyledButton
                accessibilityLabel={isChatMemoryOn ? 'Desactivar memoria del chat' : 'Activar memoria del chat'}
                onClick={toggleChatMemory}
              >
                <div
                  style={headerIconBtnStyle}
                  title={isChatMemoryOn ? 'Memoria del chat activada' : 'Memoria del chat desactivada'}
                  role="switch"
                  aria-checked={isChatMemoryOn}
                >
                  <Icon source={isChatMemoryOn ? ToggleOnIcon : ToggleOffIcon} tone={isChatMemoryOn ? 'success' : 'subdued'} />
                </div>
              </UnstyledButton>
            )}
            <UnstyledButton accessibilityLabel="Expandir">
              <div style={headerIconBtnStyle}>
                <Icon source={MaximizeIcon} tone="subdued" />
              </div>
            </UnstyledButton>
            <UnstyledButton accessibilityLabel="Cerrar" onClick={handleClose}>
              <div style={headerIconBtnStyle}>
                <Icon source={XSmallIcon} tone="subdued" />
              </div>
            </UnstyledButton>
          </div>
        </div>

        {/* ── Content area ───────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, overscrollBehavior: 'contain' }}>
          {currentView === 'chat' && renderChatView()}
          {currentView === 'faq' && renderFAQView()}
          {currentView === 'contact' && renderContactView()}
          {currentView === 'shortcuts' && renderShortcutsView()}
        </div>

        {/* ── Bottom input bar (chat only) ───────────────── */}
        {currentView === 'chat' && (
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.18)',
              padding: '0',
              flexShrink: 0,
              background: 'rgba(255, 255, 255, 0.62)',
              backdropFilter: 'blur(24px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            }}
          >
            {/* Active context badge + pending attachments */}
            {(contextLabel || pendingAttachments.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '8px 16px 0' }}>
                {contextLabel && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px 2px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor: '#f3e8ff',
                    color: '#7126FF',
                    border: '1px solid rgba(113, 38, 255, 0.2)',
                  }}>
                    <Icon source={TargetIcon} tone="magic" />
                    {contextLabel}
                    <UnstyledButton onClick={() => setContextSection('general')} accessibilityLabel="Limpiar contexto">
                      <div style={{ display: 'flex', cursor: 'pointer', marginLeft: '2px' }}>
                        <Icon source={XSmallIcon} tone="subdued" />
                      </div>
                    </UnstyledButton>
                  </div>
                )}
                {pendingAttachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--p-color-border)',
                      backgroundColor: 'var(--p-color-bg-surface-secondary)',
                    }}
                  >
                    {att.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.previewUrl}
                        alt={att.file.name}
                        style={{ width: '56px', height: '42px', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{
                        width: '56px',
                        height: '42px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1px',
                        padding: '4px',
                      }}>
                        <Icon source={AttachmentIcon} tone="subdued" />
                        <span style={{ fontSize: '7px', color: 'var(--p-color-text-subdued)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '48px', whiteSpace: 'nowrap' }}>
                          {att.file.name}
                        </span>
                      </div>
                    )}
                    <UnstyledButton onClick={() => removeAttachment(att.id)} accessibilityLabel={`Quitar ${att.file.name}`}>
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}>
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                          <path d="M1 1L7 7M7 1L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    </UnstyledButton>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_FILE_TYPES.join(',')}
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              aria-hidden="true"
            />

            {/* Input row */}
            <div
              onKeyDown={handleChatKeyDown}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
            >
              {chatMessages.length > 0 && (
                <Image
                  src="/illustrations/support-sidekick-mascot.svg"
                  alt=""
                  width={28}
                  height={28}
                  style={{ flexShrink: 0 }}
                />
              )}
              <div className="gs-chat-input-wrapper">
                <TextField
                  label="Mensaje"
                  labelHidden
                  value={chatInput}
                  onChange={setChatInput}
                  placeholder={contextLabel ? `Pregunta sobre ${contextLabel}...` : 'Pregunta lo que sea...'}
                  autoComplete="off"
                  disabled={!aiEnabled || chatLoading}
                />
              </div>
              <Popover
                active={promptsOpen}
                activator={
                  <UnstyledButton
                    onClick={() => setPromptsOpen((v) => !v)}
                    accessibilityLabel={promptsOpen ? 'Cerrar menú' : 'Más opciones'}
                  >
                    <div style={headerIconBtnStyle}>
                      <Icon source={promptsOpen ? XSmallIcon : PlusIcon} tone="subdued" />
                    </div>
                  </UnstyledButton>
                }
                onClose={() => setPromptsOpen(false)}
                preferredPosition="above"
                preferredAlignment="right"
              >
                <ActionList
                  items={[
                    {
                      content: 'Adjuntar archivo',
                      helpText: pendingAttachments.length >= MAX_FILES ? `Máximo ${MAX_FILES}` : 'Imagen, PDF, CSV, Excel',
                      icon: AttachmentIcon,
                      disabled: pendingAttachments.length >= MAX_FILES,
                      onAction: () => { setPromptsOpen(false); fileInputRef.current?.click(); },
                    },
                    ...CONTEXT_SECTIONS.filter((s) => s.id !== 'general').map((s) => ({
                      content: s.label,
                      icon: TargetIcon,
                      active: contextSection === s.id,
                      suffix: contextSection === s.id ? <Badge tone="success" size="small">Activo</Badge> : undefined,
                      onAction: () => {
                        setContextSection(contextSection === s.id ? 'general' : s.id);
                        setPromptsOpen(false);
                      },
                    })),
                  ]}
                />
              </Popover>
              {/* Voice / AI call button */}
              <UnstyledButton accessibilityLabel="Entrada de voz">
                <div style={headerIconBtnStyle} title="Entrada de voz">
                  <Icon source={MicrophoneIcon} tone="subdued" />
                </div>
              </UnstyledButton>
            </div>
          </div>
        )}

        {/* Accent line */}
        <div
          style={{
            height: '2px',
            flexShrink: 0,
            background: isChatMemoryOn
              ? 'linear-gradient(90deg, #7126FF, #00B8D4, #00D4AA)'
              : 'linear-gradient(90deg, #d4d4d8, #e4e4e7, #d4d4d8)',
          }}
        />
      </div>
    </>
  );
}
