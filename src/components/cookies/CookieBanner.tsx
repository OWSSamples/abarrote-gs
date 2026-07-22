'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { Button } from '@cloudflare/kumo/components/button';
import { Switch } from '@cloudflare/kumo/components/switch';
import { Text } from '@cloudflare/kumo/components/text';
import { useCookieConsent, type CookiePreferences } from './CookieConsentProvider';

export function CookieBanner() {
  const { showBanner, showPreferences, acceptAll, rejectAll, openPreferences } =
    useCookieConsent();

  if (!showBanner || showPreferences) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md"
    >
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
        <Text variant="heading3" as="h2">
          <span id="cookie-banner-title">Usamos cookies</span>
        </Text>
        <div className="mt-2">
          <Text variant="secondary" size="sm" as="p">
            Utilizamos cookies estrictamente necesarias para que el sitio funcione. Con tu
            consentimiento, también usamos cookies para mejorar el rendimiento, recordar
            preferencias y entender el uso del producto. Lee nuestra{' '}
            <NextLink href="/cookies" className="text-blue-600 underline">
              Política de Cookies
            </NextLink>
            .
          </Text>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" size="sm" onClick={rejectAll}>
            Rechazar opcionales
          </Button>
          <Button variant="secondary" size="sm" onClick={openPreferences}>
            Personalizar
          </Button>
          <Button variant="primary" size="sm" onClick={acceptAll}>
            Aceptar todas
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CookiePreferencesModal() {
  const { showPreferences, preferences, closePreferences, savePreferences, acceptAll, rejectAll } =
    useCookieConsent();
  const [draft, setDraft] = useState<CookiePreferences>(preferences);

  // Sincronizar draft cada vez que se abre el modal
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset draft only when the preferences modal opens.
    if (showPreferences) setDraft(preferences);
  }, [showPreferences, preferences]);

  if (!showPreferences) return null;

  function update(key: keyof CookiePreferences, value: boolean) {
    setDraft((d) => ({ ...d, [key]: value, necessary: true }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-prefs-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      onClick={closePreferences}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-5 py-4">
          <Text variant="heading3" as="h2">
            <span id="cookie-prefs-title">Preferencias de cookies</span>
          </Text>
          <div className="mt-1">
            <Text variant="secondary" size="sm" as="p">
              Controla qué categorías de cookies puede utilizar Kiosko en tu navegador.
            </Text>
          </div>
        </div>

        {/* Categorías */}
        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <CategoryRow
              title="Estrictamente necesarias"
              description="Permiten autenticación, seguridad, prevención de fraude y funciones esenciales del sitio. No se pueden desactivar."
              checked
              disabled
            />
            <CategoryRow
              title="Funcionalidad y preferencias"
              description="Recuerdan tu idioma, tema visual (claro/oscuro), zona horaria y configuración de la interfaz."
              checked={draft.functional}
              onChange={(v) => update('functional', v)}
            />
            <CategoryRow
              title="Analíticas y rendimiento"
              description="Métricas agregadas y anónimas para entender cómo se usa el producto y mejorarlo."
              checked={draft.analytics}
              onChange={(v) => update('analytics', v)}
            />
            <CategoryRow
              title="Marketing y comunicación"
              description="Permiten medir la efectividad de campañas y personalizar comunicaciones. Kiosko no vende información personal."
              checked={draft.marketing}
              onChange={(v) => update('marketing', v)}
            />
          </div>
          <div className="mt-4">
            <Text variant="secondary" size="xs" as="p">
              Más detalle en la{' '}
              <NextLink href="/cookies" className="text-blue-600 underline">
                Política de Cookies
              </NextLink>{' '}
              y el{' '}
              <NextLink href="/privacy" className="text-blue-600 underline">
                Aviso de Privacidad
              </NextLink>
              .
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" size="sm" onClick={rejectAll}>
              Rechazar opcionales
            </Button>
            <Button variant="secondary" size="sm" onClick={acceptAll}>
              Aceptar todas
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" size="sm" onClick={closePreferences}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={() => savePreferences(draft)}>
              Guardar preferencias
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CategoryRowProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}

function CategoryRow({ title, description, checked, disabled, onChange }: CategoryRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="min-w-0 flex-1">
        <Text variant="heading3" as="h3">
          {title}
        </Text>
        <div className="mt-1">
          <Text variant="secondary" size="sm" as="p">
            {description}
          </Text>
        </div>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        size="sm"
        aria-label={title}
        onCheckedChange={onChange}
        className="mt-1 shrink-0"
      />
    </div>
  );
}
