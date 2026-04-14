'use client';

import { useCallback, useState, useRef, useTransition, useEffect } from 'react';
import {
  Card,
  BlockStack,
  Banner,
  Button,
  InlineStack,
  Text,
  Box,
  DropZone,
  Spinner,
  TextField,
  Badge,
  InlineGrid,
  Icon,
  Checkbox,
  Divider,
  RangeSlider,
  ButtonGroup,
  Tooltip,
  Thumbnail,
  Popover,
  OptionList,
  ColorPicker,
  Collapsible,
} from '@shopify/polaris';
import {
  DesktopIcon,
  ClipboardIcon,
  DeleteIcon,
  ImageIcon,
  ExternalIcon,
  StatusActiveIcon,
  PlayIcon,
  RefreshIcon,
  ViewIcon,
  PaintBrushFlatIcon,
  ClockIcon,
  SettingsIcon,
  GiftCardIcon,
  StoreIcon,
  CheckIcon,
  StarFilledIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TextFontIcon,
  SoundIcon,
  MobileIcon,
  ColorIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TextIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { uploadFile } from '@/lib/storage';
import { parseError } from '@/lib/errors';
import type {
  CustomerDisplayAnimation,
  CustomerDisplayPromoAnimation,
  TransitionSpeed,
  CustomerDisplayTheme,
  CustomerDisplayMessageStyle,
  MessageStyle,
  MessageTextSize,
  MessageTextWeight,
  MessageTextAlign,
} from '@/types';
import {
  CUSTOMER_DISPLAY_ANIMATIONS,
  CUSTOMER_DISPLAY_PROMO_ANIMATIONS,
  TRANSITION_SPEEDS,
  CUSTOMER_DISPLAY_THEMES,
  MESSAGE_TEXT_SIZES,
  MESSAGE_TEXT_WEIGHTS,
  MESSAGE_TEXT_ALIGNS,
  DEFAULT_CUSTOMER_DISPLAY_MESSAGE_STYLE,
} from '@/types';

// ═══════════════════════════════════════════════════════════
// Color helpers (hex ↔ HSB for Polaris ColorPicker)
// ═══════════════════════════════════════════════════════════

function hexToHsb(hex: string): { hue: number; saturation: number; brightness: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / d + 2) * 60;
    else hue = ((r - g) / d + 4) * 60;
  }
  const saturation = max === 0 ? 0 : d / max;
  return { hue, saturation, brightness: max };
}

function hsbToHex({ hue, saturation, brightness }: { hue: number; saturation: number; brightness: number }): string {
  const c = brightness * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = brightness - c;
  let r = 0,
    g = 0,
    b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ═══════════════════════════════════════════════════════════
// Constants / Labels
// ═══════════════════════════════════════════════════════════

const IDLE_ANIM_LABELS: Record<CustomerDisplayAnimation, string> = {
  none: 'Sin animación',
  fade: 'Desvanecer (Fade)',
  slideUp: 'Deslizar arriba',
  slideDown: 'Deslizar abajo',
  slideLeft: 'Deslizar izquierda',
  slideRight: 'Deslizar derecha',
  zoom: 'Zoom',
  bounce: 'Rebote',
};

const PROMO_ANIM_LABELS: Record<CustomerDisplayPromoAnimation, string> = {
  none: 'Sin animación',
  slideUp: 'Deslizar arriba',
  slideLeft: 'Deslizar izquierda',
  slideRight: 'Deslizar derecha',
  fade: 'Desvanecer (Fade)',
  zoom: 'Zoom',
  pulse: 'Pulso (infinito)',
  kenBurns: 'Ken Burns (zoom lento)',
};

const SPEED_LABELS: Record<TransitionSpeed, string> = {
  slow: 'Lenta (1.2s)',
  normal: 'Normal (0.6s)',
  fast: 'Rápida (0.3s)',
};

const THEME_META: Record<CustomerDisplayTheme, { label: string; bg: string; text: string; accent: string }> = {
  light: { label: 'Claro', bg: '#ffffff', text: '#1a1a1a', accent: '#008060' },
  dark: { label: 'Oscuro', bg: '#1a1c1e', text: '#f1f1f1', accent: '#36d399' },
  brand: { label: 'Marca', bg: '#0a2540', text: '#ffffff', accent: '#00d4aa' },
};

const MAX_PROMO_IMAGES = 5;

/** Parse the JSON-serialized promo images field. Backward-compatible: plain URL → [url]. */
function parsePromoImages(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string' && u.length > 0);
  } catch {
    // Not JSON → treat as single URL
  }
  return raw.startsWith('http') ? [raw] : [];
}

function serializePromoImages(urls: string[]): string {
  if (urls.length === 0) return '';
  if (urls.length === 1) return JSON.stringify(urls); // Still JSON for consistency
  return JSON.stringify(urls);
}

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export function CustomerDisplaySectionV4() {
  // ── Store ──
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const doSave = useDashboardStore((s) => s.saveStoreConfig);

  // ── Local optimistic state for ALL fields ──
  // Text fields
  const [welcome, setWelcome] = useState(storeConfig.customerDisplayWelcome ?? '');
  const [farewell, setFarewell] = useState(storeConfig.customerDisplayFarewell ?? '');
  const [promoText, setPromoText] = useState(storeConfig.customerDisplayPromoText ?? '');
  // Toggle/select fields — optimistic local state
  const [enabled, setEnabled] = useState(storeConfig.customerDisplayEnabled ?? false);
  const [promoImages, setPromoImages] = useState<string[]>(
    parsePromoImages(storeConfig.customerDisplayPromoImage ?? ''),
  );
  const [idleAnim, setIdleAnim] = useState<CustomerDisplayAnimation>(
    (storeConfig.customerDisplayIdleAnimation ?? 'fade') as CustomerDisplayAnimation,
  );
  const [promoAnim, setPromoAnim] = useState<CustomerDisplayPromoAnimation>(
    (storeConfig.customerDisplayPromoAnimation ?? 'slideUp') as CustomerDisplayPromoAnimation,
  );
  const [speed, setSpeed] = useState<TransitionSpeed>(
    (storeConfig.customerDisplayTransitionSpeed ?? 'normal') as TransitionSpeed,
  );
  const [showClock, setShowClock] = useState(storeConfig.customerDisplayShowClock ?? true);
  const [theme, setTheme] = useState<CustomerDisplayTheme>(
    (storeConfig.customerDisplayTheme ?? 'light') as CustomerDisplayTheme,
  );
  const [carousel, setCarousel] = useState(storeConfig.customerDisplayIdleCarousel ?? false);
  const [carouselSec, setCarouselSec] = useState(storeConfig.customerDisplayCarouselInterval ?? '5');
  // Extended settings
  const [customLogo, setCustomLogo] = useState(storeConfig.customerDisplayLogo ?? '');
  const [fontScale, setFontScale] = useState(storeConfig.customerDisplayFontScale ?? '1');
  const [autoReturnSec, setAutoReturnSec] = useState(storeConfig.customerDisplayAutoReturnSec ?? '6');
  const [accentColor, setAccentColor] = useState(storeConfig.customerDisplayAccentColor ?? '');
  const [soundEnabled, setSoundEnabled] = useState(storeConfig.customerDisplaySoundEnabled ?? false);
  const [orientation, setOrientation] = useState(storeConfig.customerDisplayOrientation ?? 'landscape');
  // Message styling
  const [msgStyle, setMsgStyle] = useState<CustomerDisplayMessageStyle>(
    storeConfig.customerDisplayMessageStyle ?? { ...DEFAULT_CUSTOMER_DISPLAY_MESSAGE_STYLE },
  );
  const [msgExpandedSlot, setMsgExpandedSlot] = useState<'welcome' | 'farewell' | 'promo' | null>(null);

  // Sync ALL local state when store hydrates (initial load or external update)
  useEffect(() => {
    setWelcome(storeConfig.customerDisplayWelcome ?? '');
    setFarewell(storeConfig.customerDisplayFarewell ?? '');
    setPromoText(storeConfig.customerDisplayPromoText ?? '');
    setEnabled(storeConfig.customerDisplayEnabled ?? false);
    setPromoImages(parsePromoImages(storeConfig.customerDisplayPromoImage ?? ''));
    setIdleAnim((storeConfig.customerDisplayIdleAnimation ?? 'fade') as CustomerDisplayAnimation);
    setPromoAnim((storeConfig.customerDisplayPromoAnimation ?? 'slideUp') as CustomerDisplayPromoAnimation);
    setSpeed((storeConfig.customerDisplayTransitionSpeed ?? 'normal') as TransitionSpeed);
    setShowClock(storeConfig.customerDisplayShowClock ?? true);
    setTheme((storeConfig.customerDisplayTheme ?? 'light') as CustomerDisplayTheme);
    setCarousel(storeConfig.customerDisplayIdleCarousel ?? false);
    setCarouselSec(storeConfig.customerDisplayCarouselInterval ?? '5');
    setCustomLogo(storeConfig.customerDisplayLogo ?? '');
    setFontScale(storeConfig.customerDisplayFontScale ?? '1');
    setAutoReturnSec(storeConfig.customerDisplayAutoReturnSec ?? '6');
    setAccentColor(storeConfig.customerDisplayAccentColor ?? '');
    setSoundEnabled(storeConfig.customerDisplaySoundEnabled ?? false);
    setOrientation(storeConfig.customerDisplayOrientation ?? 'landscape');
    setMsgStyle(storeConfig.customerDisplayMessageStyle ?? { ...DEFAULT_CUSTOMER_DISPLAY_MESSAGE_STYLE });
  }, [storeConfig]);

  // ── UI state ──
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [idleAnimPop, setIdleAnimPop] = useState(false);
  const [promoAnimPop, setPromoAnimPop] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const displayUrl = typeof window !== 'undefined' ? `${window.location.origin}/display` : '/display';
  const isBusy = isPending || status === 'saving';

  // ── Optimistic save: update local state immediately, persist to server, rollback on error ──
  const save = useCallback(
    async (field: string, value: unknown, rollback?: () => void) => {
      setStatus('saving');
      setErrorMsg(null);
      try {
        await doSave({ [field]: value });
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        rollback?.();
        setErrorMsg(parseError(err).description);
        setStatus('error');
      }
    },
    [doSave],
  );

  const debouncedSave = useCallback(
    (field: string, val: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(field, val), 800);
    },
    [save],
  );

  // ── Optimistic handlers ──
  const toggleEnabled = useCallback(() => {
    const prev = enabled;
    setEnabled(!prev);
    startTransition(() => {
      save('customerDisplayEnabled', !prev, () => setEnabled(prev));
    });
  }, [enabled, save]);

  const onWelcome = useCallback(
    (v: string) => {
      setWelcome(v);
      debouncedSave('customerDisplayWelcome', v);
    },
    [debouncedSave],
  );
  const onFarewell = useCallback(
    (v: string) => {
      setFarewell(v);
      debouncedSave('customerDisplayFarewell', v);
    },
    [debouncedSave],
  );
  const onPromo = useCallback(
    (v: string) => {
      setPromoText(v);
      debouncedSave('customerDisplayPromoText', v);
    },
    [debouncedSave],
  );

  const onTheme = useCallback(
    (t: CustomerDisplayTheme) => {
      const prev = theme;
      setTheme(t);
      save('customerDisplayTheme', t, () => setTheme(prev));
    },
    [theme, save],
  );

  const onIdleAnim = useCallback(
    (v: string) => {
      const prev = idleAnim;
      setIdleAnim(v as CustomerDisplayAnimation);
      setIdleAnimPop(false);
      save('customerDisplayIdleAnimation', v, () => setIdleAnim(prev));
    },
    [idleAnim, save],
  );

  const onPromoAnim = useCallback(
    (v: string) => {
      const prev = promoAnim;
      setPromoAnim(v as CustomerDisplayPromoAnimation);
      setPromoAnimPop(false);
      save('customerDisplayPromoAnimation', v, () => setPromoAnim(prev));
    },
    [promoAnim, save],
  );

  const onSpeed = useCallback(
    (s: TransitionSpeed) => {
      const prev = speed;
      setSpeed(s);
      save('customerDisplayTransitionSpeed', s, () => setSpeed(prev));
    },
    [speed, save],
  );

  const onShowClock = useCallback(
    (v: boolean) => {
      const prev = showClock;
      setShowClock(v);
      save('customerDisplayShowClock', v, () => setShowClock(prev));
    },
    [showClock, save],
  );

  const onCarousel = useCallback(
    (v: boolean) => {
      const prev = carousel;
      setCarousel(v);
      save('customerDisplayIdleCarousel', v, () => setCarousel(prev));
    },
    [carousel, save],
  );

  const onCarouselSec = useCallback(
    (v: number) => {
      const prev = carouselSec;
      const str = String(v);
      setCarouselSec(str);
      save('customerDisplayCarouselInterval', str, () => setCarouselSec(prev));
    },
    [carouselSec, save],
  );

  const onFontScale = useCallback(
    (v: number) => {
      const prev = fontScale;
      const str = String(v);
      setFontScale(str);
      save('customerDisplayFontScale', str, () => setFontScale(prev));
    },
    [fontScale, save],
  );

  const onAutoReturn = useCallback(
    (v: number) => {
      const prev = autoReturnSec;
      const str = String(v);
      setAutoReturnSec(str);
      save('customerDisplayAutoReturnSec', str, () => setAutoReturnSec(prev));
    },
    [autoReturnSec, save],
  );

  const onAccentColor = useCallback(
    (v: string) => {
      setAccentColor(v);
      debouncedSave('customerDisplayAccentColor', v);
    },
    [debouncedSave],
  );

  const onSoundEnabled = useCallback(
    (v: boolean) => {
      const prev = soundEnabled;
      setSoundEnabled(v);
      save('customerDisplaySoundEnabled', v, () => setSoundEnabled(prev));
    },
    [soundEnabled, save],
  );

  const onOrientation = useCallback(
    (v: string) => {
      const prev = orientation;
      setOrientation(v);
      save('customerDisplayOrientation', v, () => setOrientation(prev));
    },
    [orientation, save],
  );

  /** Update a single message slot's style property and auto-save the full object. */
  const updateMsgSlot = useCallback(
    <K extends keyof MessageStyle>(slot: 'welcome' | 'farewell' | 'promo', prop: K, value: MessageStyle[K]) => {
      setMsgStyle((prev) => {
        const next: CustomerDisplayMessageStyle = {
          ...prev,
          [slot]: { ...prev[slot], [prop]: value },
        };
        // debounce save for text fields, immediate for selects
        if (prop === 'subtitle' || prop === 'textColor') {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => save('customerDisplayMessageStyle', next), 800);
        } else {
          save('customerDisplayMessageStyle', next);
        }
        return next;
      });
    },
    [save],
  );

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2500);
    } catch {
      /* noop */
    }
  }, [displayUrl]);

  const openDisplay = useCallback(() => {
    const w = orientation === 'portrait' ? 768 : 1024;
    const h = orientation === 'portrait' ? 1024 : 768;
    window.open('/display', 'customer_display', `width=${w},height=${h},menubar=no,toolbar=no`);
  }, [orientation]);

  const onLogoDrop = useCallback((_a: File[], rej: File[]) => {
    if (rej.length) setErrorMsg('Solo imágenes (JPG, PNG, WebP) de máximo 2 MB.');
  }, []);

  const onLogoAccepted = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setErrorMsg(null);
      try {
        const ext = file.name.split('.').pop() ?? 'webp';
        const url = await uploadFile(file, `display/logo-${Date.now()}.${ext}`);
        setCustomLogo(url);
        await save('customerDisplayLogo', url, () => setCustomLogo(customLogo));
      } catch (err) {
        setErrorMsg(parseError(err).description);
      } finally {
        setUploading(false);
      }
    },
    [save, customLogo],
  );

  const removeLogo = useCallback(() => {
    const prev = customLogo;
    setCustomLogo('');
    save('customerDisplayLogo', '', () => setCustomLogo(prev));
  }, [customLogo, save]);

  const onImageDrop = useCallback((_a: File[], rej: File[]) => {
    if (rej.length) setErrorMsg('Solo imágenes (JPG, PNG, WebP) de máximo 2 MB.');
  }, []);

  const onImageAccepted = useCallback(
    async (files: File[]) => {
      if (promoImages.length >= MAX_PROMO_IMAGES) {
        setErrorMsg(`Máximo ${MAX_PROMO_IMAGES} imágenes promocionales.`);
        return;
      }
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setErrorMsg(null);
      try {
        const ext = file.name.split('.').pop() ?? 'webp';
        const url = await uploadFile(file, `promo/display-${Date.now()}.${ext}`);
        const updated = [...promoImages, url];
        setPromoImages(updated);
        await save('customerDisplayPromoImage', serializePromoImages(updated), () => setPromoImages(promoImages));
      } catch (err) {
        setErrorMsg(parseError(err).description);
      } finally {
        setUploading(false);
      }
    },
    [save, promoImages],
  );

  const removeImage = useCallback(
    (index: number) => {
      const prev = [...promoImages];
      const updated = promoImages.filter((_, i) => i !== index);
      setPromoImages(updated);
      save('customerDisplayPromoImage', serializePromoImages(updated), () => setPromoImages(prev));
    },
    [promoImages, save],
  );

  const reorderImage = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= promoImages.length) return;
      const prev = [...promoImages];
      const updated = [...promoImages];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      setPromoImages(updated);
      save('customerDisplayPromoImage', serializePromoImages(updated), () => setPromoImages(prev));
    },
    [promoImages, save],
  );

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <BlockStack gap="400">
      {/* Beta notice */}
      <Banner tone="warning" title="Sección en Beta">
        <p>
          La <strong>Pantalla del Cliente</strong> está en fase Beta.
          Las animaciones 3D, temas y configuraciones pueden presentar
          comportamientos inesperados o cambios en futuras actualizaciones.
        </p>
      </Banner>

      {/* Banners */}
      {errorMsg && (
        <Banner tone="critical" onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Banner>
      )}
      {status === 'saved' && (
        <Banner tone="success" onDismiss={() => setStatus('idle')}>
          Cambios guardados.
        </Banner>
      )}

      {/* ═══════════════════════════════════════════════════
          CARD 1 — Estado y acceso rápido
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <InlineStack gap="300" blockAlign="center">
              <Box
                padding="200"
                background={enabled ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                borderRadius="200"
              >
                <Icon source={DesktopIcon} tone={enabled ? 'success' : 'subdued'} />
              </Box>
              <BlockStack gap="050">
                <Text variant="headingMd" as="h3">
                  Pantalla del cliente
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Segundo monitor o tablet para mostrar la compra.
                </Text>
              </BlockStack>
            </InlineStack>
            <Badge tone={enabled ? 'success' : undefined}>{enabled ? 'Activa' : 'Inactiva'}</Badge>
          </InlineStack>

          <Box background="bg-surface-secondary" borderRadius="200" padding="300">
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <InlineStack gap="200" blockAlign="center">
                <Icon source={StatusActiveIcon} tone={enabled ? 'success' : 'subdued'} />
                <Text variant="bodySm" as="span" tone="subdued">
                  {displayUrl}
                </Text>
              </InlineStack>
              <ButtonGroup>
                <Tooltip content="Copiar URL">
                  <Button icon={ClipboardIcon} size="slim" onClick={copyUrl}>
                    {urlCopied ? '✓ Copiado' : 'Copiar'}
                  </Button>
                </Tooltip>
                <Tooltip content="Abrir en ventana 1024×768">
                  <Button icon={ExternalIcon} size="slim" variant="primary" onClick={openDisplay} disabled={!enabled}>
                    Abrir pantalla
                  </Button>
                </Tooltip>
              </ButtonGroup>
            </InlineStack>
          </Box>

          <InlineStack align="end">
            <Button
              onClick={toggleEnabled}
              loading={isBusy}
              variant={enabled ? 'secondary' : 'primary'}
              tone={enabled ? 'critical' : undefined}
            >
              {enabled ? 'Desactivar pantalla' : 'Activar pantalla'}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 2 — Mensajes personalizados (diseñador)
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={TextIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Mensajes personalizados
                </Text>
                <Badge tone="info">Auto-guardado</Badge>
              </InlineStack>
              <Text variant="bodySm" as="p" tone="subdued">
                Configura el contenido y estilo de cada mensaje.
              </Text>
            </BlockStack>
          </InlineStack>

          {/* ─── Welcome Message ─── */}
          <MessageSlotDesigner
            label="Mensaje de bienvenida"
            description="Se muestra en la pantalla de espera."
            icon={StoreIcon}
            textValue={welcome}
            onTextChange={onWelcome}
            textPlaceholder="Ej: ¡Bienvenido a nuestra tienda!"
            maxLength={120}
            style={msgStyle.welcome}
            onStyleChange={(prop, value) => updateMsgSlot('welcome', prop, value)}
            expanded={msgExpandedSlot === 'welcome'}
            onToggle={() => setMsgExpandedSlot((p) => (p === 'welcome' ? null : 'welcome'))}
          />

          <Divider />

          {/* ─── Farewell Message ─── */}
          <MessageSlotDesigner
            label="Mensaje de despedida"
            description="Se muestra al finalizar una venta."
            icon={StarFilledIcon}
            textValue={farewell}
            onTextChange={onFarewell}
            textPlaceholder="Ej: ¡Gracias por su compra!"
            maxLength={120}
            style={msgStyle.farewell}
            onStyleChange={(prop, value) => updateMsgSlot('farewell', prop, value)}
            expanded={msgExpandedSlot === 'farewell'}
            onToggle={() => setMsgExpandedSlot((p) => (p === 'farewell' ? null : 'farewell'))}
          />

          <Divider />

          {/* ─── Promo Message ─── */}
          <MessageSlotDesigner
            label="Texto promocional"
            description="Aparece con ícono de regalo en pantalla de espera."
            icon={GiftCardIcon}
            textValue={promoText}
            onTextChange={onPromo}
            textPlaceholder="Ej: 2×1 en refrescos · Solo hoy"
            maxLength={200}
            multiline
            style={msgStyle.promo}
            onStyleChange={(prop, value) => updateMsgSlot('promo', prop, value)}
            expanded={msgExpandedSlot === 'promo'}
            onToggle={() => setMsgExpandedSlot((p) => (p === 'promo' ? null : 'promo'))}
          />
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 3 — Imágenes promocionales
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Icon source={ImageIcon} tone="subdued" />
              </Box>
              <BlockStack gap="050">
                <Text variant="headingMd" as="h3">
                  Imágenes promocionales
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Se muestran en pantalla de espera. Recomendado: 1200×400px.
                </Text>
              </BlockStack>
            </InlineStack>
            <Badge tone={promoImages.length >= MAX_PROMO_IMAGES ? 'warning' : 'info'}>
              {`${promoImages.length}/${MAX_PROMO_IMAGES}`}
            </Badge>
          </InlineStack>

          {/* Image gallery */}
          {promoImages.length > 0 && (
            <BlockStack gap="300">
              {promoImages.map((url, idx) => (
                <Box key={url} background="bg-surface-secondary" borderRadius="200" padding="300">
                  <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Text variant="bodySm" as="span" tone="subdued" fontWeight="bold">
                        {idx + 1}
                      </Text>
                      <Thumbnail source={url} alt={`Promo ${idx + 1}`} size="small" />
                      <Text variant="bodySm" as="span" tone="subdued" truncate>
                        {url.split('/').pop() ?? 'imagen'}
                      </Text>
                    </InlineStack>
                    <InlineStack gap="100" blockAlign="center">
                      <Tooltip content="Mover izquierda">
                        <Button
                          icon={ChevronLeftIcon}
                          size="slim"
                          variant="plain"
                          disabled={idx === 0}
                          onClick={() => reorderImage(idx, idx - 1)}
                          accessibilityLabel="Mover izquierda"
                        />
                      </Tooltip>
                      <Tooltip content="Mover derecha">
                        <Button
                          icon={ChevronRightIcon}
                          size="slim"
                          variant="plain"
                          disabled={idx === promoImages.length - 1}
                          onClick={() => reorderImage(idx, idx + 1)}
                          accessibilityLabel="Mover derecha"
                        />
                      </Tooltip>
                      <Tooltip content="Eliminar imagen">
                        <Button
                          icon={DeleteIcon}
                          size="slim"
                          variant="plain"
                          tone="critical"
                          onClick={() => removeImage(idx)}
                          accessibilityLabel="Eliminar"
                        />
                      </Tooltip>
                    </InlineStack>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          )}

          {/* Upload zone (hidden when max reached) */}
          {promoImages.length < MAX_PROMO_IMAGES && (
            <DropZone
              accept="image/*"
              type="image"
              allowMultiple={false}
              onDrop={onImageDrop}
              onDropAccepted={onImageAccepted}
            >
              {uploading ? (
                <Box padding="600">
                  <BlockStack gap="200" inlineAlign="center">
                    <Spinner size="small" />
                    <Text variant="bodySm" as="span" tone="subdued">
                      Subiendo...
                    </Text>
                  </BlockStack>
                </Box>
              ) : (
                <DropZone.FileUpload actionHint="JPG, PNG o WebP · Máximo 2 MB" />
              )}
            </DropZone>
          )}

          {promoImages.length >= MAX_PROMO_IMAGES && (
            <Banner tone="warning">
              Has alcanzado el límite de {MAX_PROMO_IMAGES} imágenes. Elimina una para subir más.
            </Banner>
          )}
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 4 — Tema visual
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={PaintBrushFlatIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                Tema visual
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Selecciona la paleta de colores de la pantalla.
              </Text>
            </BlockStack>
          </InlineStack>

          <InlineStack gap="300" blockAlign="stretch">
            {CUSTOMER_DISPLAY_THEMES.map((t) => {
              const mt = THEME_META[t];
              const active = theme === t;
              return (
                <div
                  key={t}
                  role="button"
                  tabIndex={0}
                  onClick={() => onTheme(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onTheme(t);
                  }}
                  style={{
                    cursor: 'pointer',
                    border: active ? `2px solid ${mt.accent}` : '2px solid transparent',
                    borderRadius: 12,
                    padding: 12,
                    background: active ? 'var(--p-color-bg-surface-selected)' : 'var(--p-color-bg-surface-secondary)',
                  }}
                >
                  <BlockStack gap="200" inlineAlign="center">
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: mt.bg,
                        border: `2px solid ${mt.accent}`,
                      }}
                    />
                    <Text variant="bodySm" as="span" fontWeight={active ? 'bold' : undefined}>
                      {mt.label}
                    </Text>
                    {active && <Icon source={CheckIcon} tone="success" />}
                  </BlockStack>
                </div>
              );
            })}
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 5 — Animaciones
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="500">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={PlayIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                Animaciones
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Configura cómo aparecen los elementos en la pantalla.
              </Text>
            </BlockStack>
          </InlineStack>

          <Divider />

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Idle animation — Popover + OptionList */}
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" fontWeight="semibold">
                Animación de entrada
              </Text>
              <Popover
                active={idleAnimPop}
                activator={
                  <Button onClick={() => setIdleAnimPop((p) => !p)} disclosure fullWidth textAlign="left">
                    {IDLE_ANIM_LABELS[idleAnim]}
                  </Button>
                }
                onClose={() => setIdleAnimPop(false)}
                fullWidth
              >
                <OptionList
                  onChange={(sel) => {
                    onIdleAnim(sel[0]);
                  }}
                  options={CUSTOMER_DISPLAY_ANIMATIONS.map((v) => ({ label: IDLE_ANIM_LABELS[v], value: v }))}
                  selected={[idleAnim]}
                />
              </Popover>
              <Text variant="bodySm" as="p" tone="subdued">
                Cómo entran los elementos al iniciar.
              </Text>
            </BlockStack>

            {/* Promo animation — Popover + OptionList */}
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" fontWeight="semibold">
                Animación de promoción
              </Text>
              <Popover
                active={promoAnimPop}
                activator={
                  <Button onClick={() => setPromoAnimPop((p) => !p)} disclosure fullWidth textAlign="left">
                    {PROMO_ANIM_LABELS[promoAnim]}
                  </Button>
                }
                onClose={() => setPromoAnimPop(false)}
                fullWidth
              >
                <OptionList
                  onChange={(sel) => {
                    onPromoAnim(sel[0]);
                  }}
                  options={CUSTOMER_DISPLAY_PROMO_ANIMATIONS.map((v) => ({ label: PROMO_ANIM_LABELS[v], value: v }))}
                  selected={[promoAnim]}
                />
              </Popover>
              <Text variant="bodySm" as="p" tone="subdued">
                Efecto para la imagen/texto de promo.
              </Text>
            </BlockStack>
          </InlineGrid>

          <Divider />

          {/* Speed — segmented buttons */}
          <BlockStack gap="200">
            <Text variant="bodySm" as="p" fontWeight="semibold">
              Velocidad de transición
            </Text>
            <ButtonGroup variant="segmented">
              {TRANSITION_SPEEDS.map((s) => (
                <Button key={s} pressed={speed === s} onClick={() => onSpeed(s)}>
                  {SPEED_LABELS[s]}
                </Button>
              ))}
            </ButtonGroup>
          </BlockStack>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 6 — Reloj y carrusel
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={ClockIcon} tone="subdued" />
            </Box>
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                Reloj y carrusel
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Controla el reloj digital y la rotación de contenido.
              </Text>
            </BlockStack>
          </InlineStack>

          <Divider />

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <BlockStack gap="300">
              <Checkbox
                label="Mostrar reloj digital"
                checked={showClock}
                onChange={onShowClock}
                helpText="Hora y fecha en la pantalla de espera."
              />
              <Checkbox
                label="Carrusel automático"
                checked={carousel}
                onChange={onCarousel}
                helpText="Alterna bienvenida → promo → imagen."
              />
            </BlockStack>

            {carousel && (
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" fontWeight="semibold">
                  Intervalo del carrusel
                </Text>
                <RangeSlider
                  label={`${carouselSec} segundos`}
                  value={Number(carouselSec)}
                  min={3}
                  max={15}
                  step={1}
                  onChange={(v) => onCarouselSec(v as number)}
                  output
                />
                <Text variant="bodySm" as="p" tone="subdued">
                  Tiempo entre cada slide.
                </Text>
              </BlockStack>
            )}
          </InlineGrid>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 6.1 — Logo personalizado
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={ImageIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                Logo de pantalla
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Logo que aparece en la pantalla de espera. Si no se configura, se usa el logo general.
              </Text>
            </BlockStack>
          </InlineStack>

          {customLogo ? (
            <InlineStack gap="400" blockAlign="center">
              <Thumbnail source={customLogo} alt="Logo display" size="large" />
              <Button icon={DeleteIcon} tone="critical" variant="plain" onClick={removeLogo}>
                Eliminar logo
              </Button>
            </InlineStack>
          ) : (
            <DropZone
              accept="image/*"
              type="image"
              allowMultiple={false}
              onDrop={onLogoDrop}
              onDropAccepted={onLogoAccepted}
            >
              {uploading ? (
                <Box padding="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <Spinner size="small" />
                    <Text variant="bodySm" as="span" tone="subdued">
                      Subiendo...
                    </Text>
                  </BlockStack>
                </Box>
              ) : (
                <DropZone.FileUpload actionHint="JPG, PNG o WebP · Recomendado: cuadrado 200×200px" />
              )}
            </DropZone>
          )}
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 6.2 — Personalización avanzada
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="500">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={TextFontIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                Personalización avanzada
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Tipografía, colores y comportamiento.
              </Text>
            </BlockStack>
          </InlineStack>

          <Divider />

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Font scale */}
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" fontWeight="semibold">
                Tamaño de fuente
              </Text>
              <RangeSlider
                label={`${Number(fontScale).toFixed(1)}x`}
                value={Number(fontScale) * 10}
                min={7}
                max={15}
                step={1}
                onChange={(v) => onFontScale((v as number) / 10)}
                output
              />
              <Text variant="bodySm" as="p" tone="subdued">
                Escala del texto: 0.7x (pequeño) → 1.5x (grande).
              </Text>
            </BlockStack>

            {/* Auto return */}
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" fontWeight="semibold">
                Tiempo auto-retorno
              </Text>
              <RangeSlider
                label={`${autoReturnSec} segundos`}
                value={Number(autoReturnSec)}
                min={3}
                max={30}
                step={1}
                onChange={(v) => onAutoReturn(v as number)}
                output
              />
              <Text variant="bodySm" as="p" tone="subdued">
                Segundos para volver a pantalla de espera después de una venta.
              </Text>
            </BlockStack>
          </InlineGrid>

          <Divider />

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Accent color */}
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={ColorIcon} tone="subdued" />
                <Text variant="bodySm" as="p" fontWeight="semibold">
                  Color de acento personalizado
                </Text>
              </InlineStack>
              <InlineStack gap="300" blockAlign="center">
                <Popover
                  active={colorPickerOpen}
                  onClose={() => setColorPickerOpen(false)}
                  activator={
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: accentColor || THEME_META[theme].accent,
                        border: '2px solid var(--p-color-border)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setColorPickerOpen(true)}
                      role="button"
                      tabIndex={0}
                      title="Clic para elegir color"
                    />
                  }
                >
                  <Box padding="300">
                    <ColorPicker
                      color={hexToHsb(accentColor || THEME_META[theme].accent)}
                      onChange={(hsb) => onAccentColor(hsbToHex(hsb))}
                    />
                  </Box>
                </Popover>
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    labelHidden
                    value={accentColor}
                    onChange={onAccentColor}
                    placeholder="#00d4aa"
                    maxLength={9}
                    autoComplete="off"
                    helpText="Hex (ej. #FF6B00). Vacío = color del tema."
                  />
                </div>
              </InlineStack>
            </BlockStack>

            {/* Sound */}
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={SoundIcon} tone="subdued" />
                <Text variant="bodySm" as="p" fontWeight="semibold">
                  Sonido de notificación
                </Text>
              </InlineStack>
              <Checkbox
                label="Reproducir sonido al iniciar venta"
                checked={soundEnabled}
                onChange={onSoundEnabled}
                helpText="Un beep corto cuando se agrega el primer producto."
              />
            </BlockStack>
          </InlineGrid>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 6.3 — Orientación de pantalla
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={MobileIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                Orientación de pantalla
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Selecciona según la posición de tu monitor o tablet.
              </Text>
            </BlockStack>
          </InlineStack>

          <InlineStack gap="300" blockAlign="stretch">
            {[
              { value: 'landscape', label: 'Horizontal', desc: 'Monitor estándar', width: 64, height: 40 },
              { value: 'portrait', label: 'Vertical', desc: 'Tablet o pantalla girada', width: 40, height: 64 },
            ].map((opt) => {
              const active = orientation === opt.value;
              return (
                <div
                  key={opt.value}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOrientation(opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onOrientation(opt.value);
                  }}
                  style={{
                    cursor: 'pointer',
                    border: active ? '2px solid var(--p-color-border-emphasis)' : '2px solid transparent',
                    borderRadius: 12,
                    padding: 16,
                    background: active ? 'var(--p-color-bg-surface-selected)' : 'var(--p-color-bg-surface-secondary)',
                    minWidth: 140,
                  }}
                >
                  <BlockStack gap="200" inlineAlign="center">
                    <div
                      style={{
                        width: opt.width,
                        height: opt.height,
                        borderRadius: 6,
                        border: '2px solid var(--p-color-border)',
                        background: active ? 'var(--p-color-bg-fill-info)' : 'var(--p-color-bg-surface)',
                      }}
                    />
                    <Text variant="bodySm" as="span" fontWeight={active ? 'bold' : undefined}>
                      {opt.label}
                    </Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {opt.desc}
                    </Text>
                    {active && <Icon source={CheckIcon} tone="success" />}
                  </BlockStack>
                </div>
              );
            })}
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════
          CARD 7 — Vista previa
          ═══════════════════════════════════════════════════ */}
      <PreviewCard
        theme={theme}
        welcome={welcome}
        farewell={farewell}
        promoText={promoText}
        promoImages={promoImages}
        showClock={showClock}
        storeName={storeConfig.storeName ?? 'Tu Tienda'}
        logoUrl={customLogo || storeConfig.logoUrl || ''}
        accentColor={accentColor}
        fontScale={fontScale}
        orientation={orientation}
        msgStyle={msgStyle}
        phone={storeConfig.phone ?? ''}
        address={storeConfig.address ?? ''}
      />

      {/* ═══════════════════════════════════════════════════
          CARD 8 — Info técnica
          ═══════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={SettingsIcon} tone="subdued" />
            </Box>
            <Text variant="headingMd" as="h3">
              Información técnica
            </Text>
          </InlineStack>
          <Divider />
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Sincronización en tiempo real
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Cambios se reflejan al instante en /display via BroadcastChannel.
                </Text>
              </BlockStack>
              <Badge tone="success">Activa</Badge>
            </InlineStack>
            <Divider />
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Auto-retorno a espera
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Después de cada venta, la pantalla vuelve al modo espera automáticamente.
                </Text>
              </BlockStack>
              <Badge tone="info">{`${autoReturnSec} segundos`}</Badge>
            </InlineStack>
            <Divider />
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Modo pantalla completa
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Oculta la navegación del navegador automáticamente. Usa F11 para máximo efecto.
                </Text>
              </BlockStack>
              <Badge tone="info">Automático</Badge>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

// ═══════════════════════════════════════════════════════════
// Message Slot Designer sub-component
// ═══════════════════════════════════════════════════════════

const SIZE_LABELS: Record<MessageTextSize, string> = {
  sm: 'Pequeño',
  md: 'Mediano',
  lg: 'Grande',
  xl: 'Extra grande',
  '2xl': 'Máximo',
};

const WEIGHT_LABELS: Record<MessageTextWeight, string> = {
  regular: 'Normal',
  semibold: 'Semi-negrita',
  bold: 'Negrita',
};

const ALIGN_LABELS: Record<MessageTextAlign, string> = {
  left: '← Izquierda',
  center: 'Centro',
  right: 'Derecha →',
};

interface MessageSlotDesignerProps {
  label: string;
  description: string;
  icon: typeof StoreIcon;
  textValue: string;
  onTextChange: (v: string) => void;
  textPlaceholder: string;
  maxLength: number;
  multiline?: boolean;
  style: MessageStyle;
  onStyleChange: <K extends keyof MessageStyle>(prop: K, value: MessageStyle[K]) => void;
  expanded: boolean;
  onToggle: () => void;
}

function MessageSlotDesigner({
  label,
  description,
  icon,
  textValue,
  onTextChange,
  textPlaceholder,
  maxLength,
  multiline,
  style,
  onStyleChange,
  expanded,
  onToggle,
}: MessageSlotDesignerProps) {
  const [colorPop, setColorPop] = useState(false);

  return (
    <BlockStack gap="300">
      {/* Header row — text field + expand button */}
      <InlineStack gap="300" blockAlign="start" wrap={false}>
        <Box padding="200" background="bg-surface-secondary" borderRadius="200" minWidth="36px">
          <Icon source={icon} tone="info" />
        </Box>
        <div style={{ flex: 1 }}>
          <TextField
            label={label}
            placeholder={textPlaceholder}
            value={textValue}
            onChange={onTextChange}
            maxLength={maxLength}
            showCharacterCount
            multiline={multiline ? 2 : undefined}
            helpText={description}
            autoComplete="off"
          />
        </div>
        <div style={{ paddingTop: 24 }}>
          <Tooltip content={expanded ? 'Ocultar opciones de estilo' : 'Personalizar estilo'}>
            <Button
              icon={expanded ? ChevronUpIcon : ChevronDownIcon}
              size="slim"
              variant={expanded ? 'primary' : 'tertiary'}
              onClick={onToggle}
              accessibilityLabel="Personalizar estilo"
            />
          </Tooltip>
        </div>
      </InlineStack>

      {/* Collapsible styling panel */}
      <Collapsible
        open={expanded}
        id={`msg-style-${label}`}
        transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
      >
        <Box background="bg-surface-secondary" borderRadius="200" padding="400">
          <BlockStack gap="400">
            {/* Subtitle */}
            <TextField
              label="Subtítulo"
              placeholder="Ej: Estamos a su servicio"
              value={style.subtitle}
              onChange={(v) => onStyleChange('subtitle', v)}
              maxLength={120}
              showCharacterCount
              helpText="Texto secundario que aparece debajo del mensaje principal."
              autoComplete="off"
            />

            {/* Text size + weight */}
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" fontWeight="semibold">
                  Tamaño de texto
                </Text>
                <ButtonGroup variant="segmented">
                  {MESSAGE_TEXT_SIZES.map((s) => (
                    <Button
                      key={s}
                      pressed={style.textSize === s}
                      onClick={() => onStyleChange('textSize', s)}
                      size="slim"
                    >
                      {SIZE_LABELS[s]}
                    </Button>
                  ))}
                </ButtonGroup>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodySm" as="p" fontWeight="semibold">
                  Peso de fuente
                </Text>
                <ButtonGroup variant="segmented">
                  {MESSAGE_TEXT_WEIGHTS.map((w) => (
                    <Button
                      key={w}
                      pressed={style.textWeight === w}
                      onClick={() => onStyleChange('textWeight', w)}
                      size="slim"
                    >
                      {WEIGHT_LABELS[w]}
                    </Button>
                  ))}
                </ButtonGroup>
              </BlockStack>
            </InlineGrid>

            {/* Alignment */}
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" fontWeight="semibold">
                Alineación
              </Text>
              <ButtonGroup variant="segmented">
                {MESSAGE_TEXT_ALIGNS.map((a) => (
                  <Button
                    key={a}
                    pressed={style.textAlign === a}
                    onClick={() => onStyleChange('textAlign', a)}
                    size="slim"
                  >
                    {ALIGN_LABELS[a]}
                  </Button>
                ))}
              </ButtonGroup>
            </BlockStack>

            {/* Color + toggles */}
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" fontWeight="semibold">
                  Color del texto
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Popover
                    active={colorPop}
                    onClose={() => setColorPop(false)}
                    activator={
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: style.textColor || 'var(--p-color-text)',
                          border: '2px solid var(--p-color-border)',
                          cursor: 'pointer',
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={() => setColorPop(true)}
                        title="Elegir color de texto"
                      />
                    }
                  >
                    <Box padding="300">
                      <ColorPicker
                        color={hexToHsb(style.textColor || '#1a1a1a')}
                        onChange={(hsb) => onStyleChange('textColor', hsbToHex(hsb))}
                      />
                    </Box>
                  </Popover>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label=""
                      labelHidden
                      value={style.textColor}
                      onChange={(v) => onStyleChange('textColor', v)}
                      placeholder="Vacío = color del tema"
                      maxLength={9}
                      autoComplete="off"
                    />
                  </div>
                </InlineStack>
              </BlockStack>

              <BlockStack gap="300">
                <Checkbox
                  label="Texto en mayúsculas"
                  checked={style.uppercase}
                  onChange={(v) => onStyleChange('uppercase', v)}
                  helpText="Convierte el texto a MAYÚSCULAS."
                />
                <Checkbox
                  label="Mostrar ícono"
                  checked={style.showIcon}
                  onChange={(v) => onStyleChange('showIcon', v)}
                  helpText="Muestra el ícono junto al mensaje."
                />
              </BlockStack>
            </InlineGrid>

            {/* Live mini-preview */}
            <Divider />
            <BlockStack gap="100">
              <Text variant="bodySm" as="p" tone="subdued" fontWeight="semibold">
                Vista previa del estilo
              </Text>
              <Box background="bg-surface" borderRadius="200" padding="300">
                <div style={{ textAlign: style.textAlign }}>
                  <Text
                    variant={SIZE_TO_POLARIS_VARIANT[style.textSize]}
                    as="p"
                    fontWeight={style.textWeight === 'regular' ? undefined : style.textWeight}
                    alignment={toPolarisAlign(style.textAlign)}
                  >
                    <span
                      style={{
                        color: style.textColor || undefined,
                        textTransform: style.uppercase ? 'uppercase' : undefined,
                      }}
                    >
                      {textValue || textPlaceholder}
                    </span>
                  </Text>
                  {style.subtitle && (
                    <Text variant="bodySm" as="p" tone="subdued" alignment={toPolarisAlign(style.textAlign)}>
                      {style.subtitle}
                    </Text>
                  )}
                </div>
              </Box>
            </BlockStack>
          </BlockStack>
        </Box>
      </Collapsible>
    </BlockStack>
  );
}

function toPolarisAlign(align: string | undefined): 'start' | 'center' | 'end' {
  if (align === 'left') return 'start';
  if (align === 'right') return 'end';
  return 'center';
}

const SIZE_TO_POLARIS_VARIANT: Record<MessageTextSize, 'bodySm' | 'bodyMd' | 'bodyLg' | 'headingMd' | 'headingLg'> = {
  sm: 'bodySm',
  md: 'bodyMd',
  lg: 'bodyLg',
  xl: 'headingMd',
  '2xl': 'headingLg',
};

// ═══════════════════════════════════════════════════════════
// Advanced Preview — faithful replica of /display page
// ═══════════════════════════════════════════════════════════

/** Full theme config matching the actual display page */
const DISPLAY_THEMES: Record<
  CustomerDisplayTheme,
  {
    bg: string;
    bgGradient: string;
    text: string;
    textMuted: string;
    accent: string;
    promoBg: string;
    border: string;
    decorLine: string;
  }
> = {
  light: {
    bg: '#ffffff',
    bgGradient: 'radial-gradient(ellipse at 50% 0%, #f0fdf4 0%, #ffffff 50%, #f8fafc 100%)',
    text: '#1a1a1a',
    textMuted: '#6d7175',
    accent: '#008060',
    promoBg: 'rgba(0, 128, 96, 0.08)',
    border: '#e1e3e5',
    decorLine: 'linear-gradient(90deg, transparent, #008060, transparent)',
  },
  dark: {
    bg: '#0f1114',
    bgGradient: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0f1114 50%, #0a0c0e 100%)',
    text: '#f1f1f1',
    textMuted: '#9a9da0',
    accent: '#36d399',
    promoBg: 'rgba(54, 211, 153, 0.12)',
    border: '#2a2d31',
    decorLine: 'linear-gradient(90deg, transparent, #36d399, transparent)',
  },
  brand: {
    bg: '#0a2540',
    bgGradient: 'radial-gradient(ellipse at 50% 0%, #1e4d7a 0%, #0a2540 50%, #061b2e 100%)',
    text: '#ffffff',
    textMuted: '#b0c4de',
    accent: '#00d4aa',
    promoBg: 'rgba(0, 212, 170, 0.12)',
    border: '#1e4d7a',
    decorLine: 'linear-gradient(90deg, transparent, #00d4aa, transparent)',
  },
};

const PREVIEW_TEXT_SIZE: Record<MessageTextSize, { main: string; sub: string }> = {
  sm: { main: '0.7em', sub: '0.6em' },
  md: { main: '0.85em', sub: '0.65em' },
  lg: { main: '1em', sub: '0.75em' },
  xl: { main: '1.25em', sub: '0.85em' },
  '2xl': { main: '1.6em', sub: '0.9em' },
};

interface PreviewProps {
  theme: CustomerDisplayTheme;
  welcome: string;
  farewell: string;
  promoText: string;
  promoImages: string[];
  showClock: boolean;
  storeName: string;
  logoUrl: string;
  accentColor: string;
  fontScale: string;
  orientation: string;
  msgStyle: CustomerDisplayMessageStyle;
  phone: string;
  address: string;
}

/** Sample sale data for preview */
const SAMPLE_ITEMS = [
  { name: 'Coca-Cola 600ml', qty: 2, price: 15.0, sub: 30.0 },
  { name: 'Pan Bimbo Grande', qty: 1, price: 52.0, sub: 52.0 },
  { name: 'Sabritas Original', qty: 3, price: 18.5, sub: 55.5 },
];
const SAMPLE_TOTAL = 137.5;
const SAMPLE_IVA = 19.03;

function PreviewCard({
  theme,
  welcome,
  farewell,
  promoText,
  promoImages,
  showClock,
  storeName,
  logoUrl,
  accentColor,
  fontScale,
  orientation,
  msgStyle,
  phone,
  address,
}: PreviewProps) {
  const [mode, setMode] = useState<'idle' | 'sale' | 'done'>('idle');
  const [key, setKey] = useState(0);
  const replay = useCallback(() => setKey((k) => k + 1), []);

  const t = DISPLAY_THEMES[theme];
  const accent = accentColor || t.accent;
  const scale = Number(fontScale) || 1;
  const isPortrait = orientation === 'portrait';
  const aspectRatio = isPortrait ? '9 / 16' : '16 / 9';
  const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const ws = msgStyle.welcome;
  const fs = msgStyle.farewell;
  const ps = msgStyle.promo;

  const welcomeText = welcome || `¡Bienvenido a ${storeName}!`;
  const farewellText = farewell || 'Gracias por su preferencia';

  return (
    <Card>
      <BlockStack gap="400">
        {/* Controls */}
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Icon source={ViewIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                Vista previa avanzada
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Réplica exacta de la pantalla del cliente.
              </Text>
            </BlockStack>
          </InlineStack>
          <ButtonGroup>
            <Button
              size="slim"
              pressed={mode === 'idle'}
              onClick={() => {
                setMode('idle');
                replay();
              }}
            >
              Espera
            </Button>
            <Button
              size="slim"
              pressed={mode === 'sale'}
              onClick={() => {
                setMode('sale');
                replay();
              }}
            >
              Venta
            </Button>
            <Button
              size="slim"
              pressed={mode === 'done'}
              onClick={() => {
                setMode('done');
                replay();
              }}
            >
              Finalizada
            </Button>
            <Tooltip content="Reproducir animación">
              <Button icon={RefreshIcon} size="slim" onClick={replay} />
            </Tooltip>
          </ButtonGroup>
        </InlineStack>

        {/* Preview frame — exact aspect ratio + scale */}
        <div
          style={{
            borderRadius: 12,
            border: '2px solid var(--p-color-border)',
            overflow: 'hidden',
            position: 'relative',
            aspectRatio,
            maxHeight: 480,
          }}
        >
          <div
            key={key}
            style={{
              position: 'absolute',
              inset: 0,
              fontSize: `${scale * 0.55}rem`,
              overflow: 'hidden',
            }}
          >
            {/* ══════════════ IDLE ══════════════ */}
            {mode === 'idle' && (
              <div
                style={{
                  background: t.bgGradient,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.2em',
                  padding: '2em 1.5em',
                  position: 'relative',
                }}
              >
                {/* Decorative line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '10%',
                    right: '10%',
                    height: 2,
                    background: t.decorLine,
                  }}
                />

                {/* Logo */}
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={storeName}
                    style={{ width: '3.5em', height: '3.5em', borderRadius: '0.6em', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '3.5em',
                      height: '3.5em',
                      borderRadius: '0.8em',
                      background: accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '1.6em',
                      fontWeight: 700,
                    }}
                  >
                    {storeName.charAt(0)}
                  </div>
                )}

                {/* Welcome message */}
                <div style={{ width: '100%', textAlign: ws.textAlign }}>
                  <div
                    style={{
                      fontSize: PREVIEW_TEXT_SIZE[ws.textSize].main,
                      fontWeight: ws.textWeight === 'bold' ? 700 : ws.textWeight === 'semibold' ? 600 : 400,
                      color: ws.textColor || t.text,
                      textTransform: ws.uppercase ? 'uppercase' : undefined,
                      lineHeight: 1.3,
                    }}
                  >
                    {welcomeText}
                  </div>
                  {ws.subtitle && (
                    <div
                      style={{
                        fontSize: PREVIEW_TEXT_SIZE[ws.textSize].sub,
                        color: accent,
                        marginTop: '0.3em',
                      }}
                    >
                      {ws.subtitle}
                    </div>
                  )}
                </div>

                {/* Promo text */}
                {promoText && (
                  <div
                    style={{
                      background: t.promoBg,
                      borderRadius: '0.5em',
                      padding: '0.5em 1em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4em',
                      justifyContent:
                        ps.textAlign === 'center' ? 'center' : ps.textAlign === 'right' ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    {ps.showIcon && <span style={{ fontSize: '1em' }}>🎁</span>}
                    <span
                      style={{
                        fontSize: PREVIEW_TEXT_SIZE[ps.textSize].main,
                        fontWeight: ps.textWeight === 'bold' ? 700 : ps.textWeight === 'semibold' ? 600 : 400,
                        color: ps.textColor || accent,
                        textTransform: ps.uppercase ? 'uppercase' : undefined,
                      }}
                    >
                      {promoText}
                    </span>
                  </div>
                )}

                {/* Promo image */}
                {promoImages.length > 0 && promoImages[0] && (
                  <img
                    src={promoImages[0]}
                    alt="Promo"
                    style={{
                      maxWidth: '80%',
                      maxHeight: '6em',
                      borderRadius: '0.5em',
                      objectFit: 'cover',
                    }}
                  />
                )}

                {/* Clock */}
                {showClock && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3em',
                      color: t.textMuted,
                      fontSize: '1.1em',
                    }}
                  >
                    🕐 {now}
                  </div>
                )}

                {/* Bottom contact */}
                {(phone || address) && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '0.8em',
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      color: t.textMuted,
                      fontSize: '0.6em',
                    }}
                  >
                    {phone && `Tel. ${phone}`}
                    {phone && address && ' · '}
                    {address}
                  </div>
                )}

                {/* Bottom decorative line */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '10%',
                    right: '10%',
                    height: 2,
                    background: t.decorLine,
                  }}
                />
              </div>
            )}

            {/* ══════════════ SALE ══════════════ */}
            {mode === 'sale' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#f6f6f7',
                }}
              >
                {/* Header bar */}
                <div
                  style={{
                    padding: '0.6em 1em',
                    background: '#fff',
                    borderBottom: '1px solid #e1e3e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt=""
                        style={{ width: '1.6em', height: '1.6em', borderRadius: 4, objectFit: 'contain' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '1.6em',
                          height: '1.6em',
                          borderRadius: 4,
                          background: accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '0.8em',
                          fontWeight: 700,
                        }}
                      >
                        {storeName.charAt(0)}
                      </div>
                    )}
                    <strong style={{ fontSize: '0.85em' }}>{storeName}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em' }}>
                    <span style={{ fontSize: '0.65em', color: '#6d7175' }}>🕐 {now}</span>
                    <span
                      style={{
                        fontSize: '0.6em',
                        background: '#e4f5e9',
                        color: '#0d7a47',
                        padding: '0.15em 0.5em',
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {SAMPLE_ITEMS.reduce((s, i) => s + i.qty, 0)} artículos
                    </span>
                  </div>
                </div>

                {/* Body split */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                  {/* Left — items table */}
                  <div style={{ flex: 1.6, padding: '0.8em', overflowY: 'auto' }}>
                    <div
                      style={{
                        fontSize: '0.65em',
                        color: '#6d7175',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        marginBottom: '0.6em',
                        letterSpacing: '0.05em',
                      }}
                    >
                      📋 Su compra
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7em' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e1e3e5' }}>
                          <th style={{ textAlign: 'left', padding: '0.4em', color: '#6d7175', fontWeight: 500 }}>
                            Cant.
                          </th>
                          <th style={{ textAlign: 'left', padding: '0.4em', color: '#6d7175', fontWeight: 500 }}>
                            Producto
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.4em', color: '#6d7175', fontWeight: 500 }}>
                            P.Unit.
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.4em', color: '#6d7175', fontWeight: 500 }}>
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_ITEMS.map((item) => (
                          <tr key={item.name} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '0.4em' }}>
                              <span
                                style={{
                                  background: '#e4f5e9',
                                  color: '#0d7a47',
                                  padding: '0.1em 0.4em',
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  fontSize: '0.85em',
                                }}
                              >
                                {item.qty}
                              </span>
                            </td>
                            <td style={{ padding: '0.4em', fontWeight: 600 }}>{item.name}</td>
                            <td style={{ padding: '0.4em', textAlign: 'right', color: '#6d7175' }}>
                              ${item.price.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.4em', textAlign: 'right', fontWeight: 600 }}>
                              ${item.sub.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Right — totals */}
                  <div style={{ flex: 1, padding: '0.8em', display: 'flex', flexDirection: 'column', gap: '0.6em' }}>
                    <div style={{ background: '#fff', borderRadius: 8, padding: '0.8em', border: '1px solid #e1e3e5' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.75em',
                          marginBottom: '0.3em',
                        }}
                      >
                        <span>Subtotal</span>
                        <span>${SAMPLE_TOTAL.toFixed(2)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.6em',
                          color: '#6d7175',
                          marginBottom: '0.5em',
                        }}
                      >
                        <span>IVA (16%)</span>
                        <span>${SAMPLE_IVA.toFixed(2)}</span>
                      </div>
                      <div
                        style={{
                          borderTop: '1px solid #e1e3e5',
                          paddingTop: '0.5em',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.9em', fontWeight: 700 }}>TOTAL</span>
                        <span style={{ fontSize: '1.3em', fontWeight: 800 }}>${SAMPLE_TOTAL.toFixed(2)}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '0.6em',
                        border: '1px solid #e1e3e5',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.6em', color: '#6d7175' }}>Método de pago</div>
                      <div style={{ fontSize: '0.8em', fontWeight: 700, marginTop: '0.2em' }}>💵 Efectivo</div>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '0.6em', color: '#6d7175', marginTop: 'auto' }}>
                      Gracias por su preferencia
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ FINISHED ══════════════ */}
            {mode === 'done' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1em',
                  padding: '2em 1.5em',
                }}
              >
                {/* Check icon */}
                <div
                  style={{
                    width: '3em',
                    height: '3em',
                    borderRadius: '50%',
                    background: '#e4f5e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5em',
                  }}
                >
                  ✓
                </div>

                {/* Thanks heading */}
                <div style={{ fontSize: '1.4em', fontWeight: 700, color: '#0d7a47', textAlign: 'center' }}>
                  ¡Gracias por su compra!
                </div>

                {/* Receipt card */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: '1em',
                    border: '1px solid #e1e3e5',
                    minWidth: '50%',
                    maxWidth: '75%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8em',
                      marginBottom: '0.4em',
                    }}
                  >
                    <span style={{ color: '#6d7175' }}>Total pagado</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1em' }}>${SAMPLE_TOTAL.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      borderTop: '1px solid #e1e3e5',
                      paddingTop: '0.4em',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.7em',
                    }}
                  >
                    <span style={{ color: '#6d7175' }}>Método</span>
                    <span style={{ background: '#f0f0f0', padding: '0.1em 0.5em', borderRadius: 6, fontWeight: 500 }}>
                      Efectivo
                    </span>
                  </div>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7em', marginTop: '0.3em' }}
                  >
                    <span style={{ color: '#6d7175' }}>Folio</span>
                    <span style={{ fontWeight: 600 }}>V-00042</span>
                  </div>
                  <div
                    style={{
                      borderTop: '1px solid #e1e3e5',
                      paddingTop: '0.4em',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75em',
                      marginTop: '0.3em',
                    }}
                  >
                    <span style={{ color: '#6d7175' }}>Su cambio</span>
                    <span style={{ fontWeight: 700, color: '#b98900' }}>${(200 - SAMPLE_TOTAL).toFixed(2)}</span>
                  </div>
                </div>

                {/* Farewell message — uses actual styling */}
                <div
                  style={{
                    textAlign: fs.textAlign,
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3em',
                      justifyContent:
                        fs.textAlign === 'center' ? 'center' : fs.textAlign === 'right' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {fs.showIcon && <span>⭐</span>}
                    <span
                      style={{
                        fontSize: PREVIEW_TEXT_SIZE[fs.textSize].main,
                        fontWeight: fs.textWeight === 'bold' ? 700 : fs.textWeight === 'semibold' ? 600 : 400,
                        color: fs.textColor || '#6d7175',
                        textTransform: fs.uppercase ? 'uppercase' : undefined,
                      }}
                    >
                      {farewellText}
                    </span>
                    {fs.showIcon && <span>⭐</span>}
                  </div>
                  {fs.subtitle && (
                    <div style={{ fontSize: PREVIEW_TEXT_SIZE[fs.textSize].sub, color: '#6d7175', marginTop: '0.2em' }}>
                      {fs.subtitle}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Orientation badge overlay */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {isPortrait ? '📱 Vertical' : '🖥️ Horizontal'} · {`${scale}x`}
          </div>
        </div>

        {/* Mode label */}
        <InlineStack align="center">
          <Badge tone="info">
            {mode === 'idle' ? 'Pantalla de espera' : mode === 'sale' ? 'Venta activa' : 'Venta finalizada'}
          </Badge>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
