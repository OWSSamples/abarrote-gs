'use client';

import { useEffect } from 'react';
import { Text }    from '@cloudflare/kumo/components/text';
import { Button }  from '@cloudflare/kumo/components/button';
import { Badge }   from '@cloudflare/kumo/components/badge';
import { Banner }  from '@cloudflare/kumo/components/banner';
import {
  ArrowClockwise24Regular,
  Home24Regular,
  Chat24Regular,
  Warning24Regular,
  WifiOff24Regular,
  ShieldError24Regular,
} from '@fluentui/react-icons';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error(`[DashboardError] digest=${error.digest}`);
    }
  }, [error.digest]);

  const isNetworkError = /fetch|network|timeout|econnrefused/i.test(error.message ?? '');

  const meta = isNetworkError
    ? {
        badge:       'Conexión interrumpida' as const,
        badgeVariant:'yellow-subtle' as const,
        icon:        <WifiOff24Regular />,
        title:       'Error de conexión',
        description: 'No pudimos comunicarnos con los servidores. Verifica tu conexión a internet e inténtalo de nuevo.',
        suggestions: [
          'Verifica tu conexión a internet',
          'Asegúrate de que tu VPN o firewall no bloquee el acceso',
          'Intenta recargar la página',
        ],
      }
    : {
        badge:       'Error inesperado' as const,
        badgeVariant:'red-subtle' as const,
        icon:        <ShieldError24Regular />,
        title:       'No pudimos cargar esta sección',
        description: 'Algo inesperado ocurrió al procesar esta vista. Nuestro equipo técnico fue notificado automáticamente y ya estamos trabajando en solucionarlo — no esperábamos este error.',
        suggestions: [
          'Intenta refrescar la página',
          'Vuelve al dashboard y abre la sección nuevamente',
          'Si el problema persiste, contacta a soporte con la referencia inferior',
        ],
      };

  return (
    <div className="err-shell">
      <div className="err-card">

        {/* ── Banner de estado ── */}
        <Banner
          variant={isNetworkError ? 'warning' : 'error'}
          className="err-banner"
        >
          <div className="err-banner-inner">
            <span className="err-banner-icon" aria-hidden="true">
              {meta.icon}
            </span>
            <Text as="span" className="err-banner-text">
              {meta.badge}
            </Text>
          </div>
        </Banner>

        {/* ── Cuerpo principal ── */}
        <div className="err-body">

          {/* Título */}
          <div className="err-heading-row">
            <Badge variant={meta.badgeVariant} className="err-badge">
              {meta.badge}
            </Badge>
            <Text as="h1" className="err-title">
              {meta.title}
            </Text>
          </div>

          {/* Descripción */}
          <Text as="p" className="err-description">
            {meta.description}
          </Text>

          {/* Divisor */}
          <hr className="err-divider" />

          {/* Sugerencias */}
          <div className="err-suggestions">
            <Text as="h2" className="err-suggestions-title">
              Qué puedes intentar
            </Text>
            <ul className="err-list">
              {meta.suggestions.map((tip) => (
                <li key={tip} className="err-list-item">
                  <Text as="span" className="err-list-text">
                    {tip}
                  </Text>
                </li>
              ))}
            </ul>
          </div>

          {/* Código de referencia */}
          {error.digest && (
            <>
              <hr className="err-divider" />
              <div className="err-reference">
                <Text as="span" className="err-reference-label">
                  Código de referencia:
                </Text>
                <code className="err-reference-code">{error.digest}</code>
              </div>
            </>
          )}

          {/* Divisor */}
          <hr className="err-divider" />

          {/* Acciones */}
          <div className="err-actions">
            <Button
              type="button"
              variant="primary"
              size="base"
              icon={<ArrowClockwise24Regular />}
              onClick={reset}
            >
              Reintentar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="base"
              icon={<Home24Regular />}
              onClick={() => { window.location.href = '/dashboard'; }}
            >
              Volver al inicio
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="base"
              icon={<Chat24Regular />}
              onClick={() => { window.location.href = '/dashboard/help'; }}
            >
              Contactar soporte
            </Button>
          </div>
        </div>
      </div>

      {/* ── Footer de estado ── */}
      <div className="err-footer">
        <span className="err-footer-dot" aria-hidden="true" />
        <Text as="span" className="err-footer-text">
          Sistema operativo · Tus datos están seguros
        </Text>
      </div>

      <style>{`
        .err-shell {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 16px 32px;
          min-height: 60vh;
        }

        .err-card {
          width: 100%;
          max-width: 680px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }

        /* Banner superior */
        .err-banner {
          border-radius: 0 !important;
          border-left: none !important;
          border-right: none !important;
          border-top: none !important;
          border-bottom: 1px solid #e5e7eb !important;
        }

        .err-banner-inner {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .err-banner-icon {
          display: flex;
          align-items: center;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .err-banner-icon svg {
          width: 18px;
          height: 18px;
        }

        .err-banner-text {
          font-size: 14px !important;
          font-weight: 500 !important;
        }

        /* Cuerpo */
        .err-body {
          padding: 32px 36px 36px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .err-heading-row {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .err-badge {
          align-self: flex-start;
        }

        .err-title {
          font-size: 26px !important;
          font-weight: 700 !important;
          color: #111827 !important;
          line-height: 1.25 !important;
          margin: 0 !important;
        }

        .err-description {
          font-size: 14px !important;
          color: #4b5563 !important;
          line-height: 1.6 !important;
          margin: 0 !important;
        }

        .err-divider {
          border: none;
          border-top: 1px solid #f3f4f6;
          margin: 0;
        }

        /* Sugerencias */
        .err-suggestions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .err-suggestions-title {
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #111827 !important;
        }

        .err-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .err-list-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding-left: 4px;
        }

        .err-list-item::before {
          content: '•';
          color: #9ca3af;
          font-size: 14px;
          flex-shrink: 0;
          line-height: 22px;
        }

        .err-list-text {
          font-size: 14px !important;
          color: #6b7280 !important;
          line-height: 22px !important;
        }

        /* Referencia */
        .err-reference {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .err-reference-label {
          font-size: 13px !important;
          color: #9ca3af !important;
        }

        .err-reference-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          padding: 3px 10px;
          border-radius: 6px;
          background: #f9fafb;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          user-select: all;
        }

        /* Acciones */
        .err-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* Footer */
        .err-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
        }

        .err-footer-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          flex-shrink: 0;
        }

        .err-footer-text {
          font-size: 13px !important;
          color: #9ca3af !important;
        }

        @media (max-width: 640px) {
          .err-body { padding: 24px 20px 28px; }
          .err-title { font-size: 22px !important; }
          .err-actions { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </div>
  );
}
