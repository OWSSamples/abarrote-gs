# ADR-007: Cloudflare Kumo para páginas de autenticación

## Status
Accepted

## Context
Las páginas de autenticación (login, forgot-password, reset-password) usaban componentes Shopify Polaris. El equipo determinó que el look genérico de Polaris Card no era adecuado para la primera impresión del usuario en el login. Se evaluaron múltiples iteraciones de diseño con Polaris puro sin satisfacer los requisitos de UX.

## Decision
Usar `@cloudflare/kumo` v2.2.1 **exclusivamente** para las páginas de autenticación. El resto de la aplicación (dashboard, settings, etc.) permanece en Shopify Polaris.

### Componentes Kumo utilizados
- `LayerCard` — Contenedor card con shadow y bordes
- `Text` — Tipografía con variantes heading/body/secondary/mono
- `Button` — Botones primary/secondary/ghost con loading state
- `Input` — Campos de texto con label, description, error integrados
- `SensitiveInput` — Campo de contraseña con toggle show/hide built-in
- `Link` — Enlaces con variantes inline/current/plain
- `@phosphor-icons/react` — Iconografía (EnvelopeSimple, WarningDiamond, CheckCircle)

### Configuración CSS
- `@cloudflare/kumo/styles/tailwind` importado en `globals.css` (tema tokens)
- `@source "../../node_modules/@cloudflare/kumo/dist"` para escaneo Tailwind de clases kumo
- No se usa `kumo-standalone.css` para evitar conflictos con el Tailwind existente

## Consequences

### Positivas
- UX de login profesional y diferenciado del dashboard
- SensitiveInput elimina código custom para toggle de contraseña
- Input con label/error integrado reduce boilerplate
- Kumo usa Tailwind internamente → consistente con el stack existente

### Negativas
- Dos design systems en la misma app (Polaris + Kumo)
- Dependencia adicional: `@phosphor-icons/react` (requerido por Kumo)
- `npm install --legacy-peer-deps` necesario por conflictos React 19

### Riesgos
- Posible conflicto CSS entre tokens Polaris y Kumo si se mezclan en la misma página
- Mitigación: Kumo se usa SOLO en `/auth/*` routes, que no cargan el frame Polaris

## Archivos modificados
- `src/app/globals.css` — Import de kumo styles + @source
- `src/components/auth/AuthLayout.tsx` — Polaris → Kumo (LayerCard, Text, Link)
- `src/components/auth/LoginForm.tsx` — Polaris → Kumo (Button, Input, SensitiveInput, Text)
- `src/components/auth/ForgotPasswordForm.tsx` — Polaris → Kumo
- `src/components/auth/ResetPasswordForm.tsx` — Polaris → Kumo
