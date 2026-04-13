<p align="center">
  <img src="public/icon/OWS-Dash.png" alt="Kiosko" width="120" height="120" />
</p>

<h1 align="center">Kiosko</h1>s

<p align="center">
  <strong>Sistema de Punto de Venta de Nueva Generación para el Comercio Mexicano</strong>
</p>

<p align="center">
  <code>v0.12.568 Edition Prerelease</code>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Polaris-13.9-7AB55C?logo=shopify" alt="Polaris" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql" alt="Neon" />
  <img src="https://img.shields.io/badge/Tests-481%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License" />
</p>

---

## Visión General

**Kiosko** es una plataforma integral de punto de venta diseñada específicamente para abarrotes, tiendas de conveniencia y pequeños comercios en México. No es solo un POS — es un sistema operativo completo para tu negocio.

Construido sobre una arquitectura **offline-first** con sincronización en tiempo real, impresión térmica nativa vía ESC/POS, 4 proveedores de pago integrados, sistema de facturación electrónica (CFDI), analíticos con inteligencia artificial y una experiencia de usuario de clase enterprise con Shopify Polaris.

```
32 tablas · 24 server actions · 10 grupos de API · 110+ componentes · 481 tests · 25 migraciones
```

---

## Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Módulos del Sistema](#módulos-del-sistema)
- [Stack Tecnológico](#stack-tecnológico)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Modelo de Datos](#modelo-de-datos)
- [Infraestructura](#infraestructura)
- [Testing](#testing)
- [Seguridad](#seguridad)
- [Despliegue](#despliegue)
- [Licencia](#licencia)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CAPA DE PRESENTACIÓN                        │
│  Next.js 16 App Router · Shopify Polaris · Polaris Viz · Three.js  │
│  Zustand (5 slices) · React 19 · Turbopack                        │
├─────────────────────────────────────────────────────────────────────┤
│                         CAPA DE APLICACIÓN                          │
│  24 Server Actions · 10 API Route Groups · 3 Cron Jobs             │
│  Action Factory · Safe Actions · Error Boundary                    │
├─────────────────────────────────────────────────────────────────────┤
│                          CAPA DE DOMINIO                            │
│  Entities: Product, Sale, SaleItem                                 │
│  Value Objects: Money, Quantity, StockLevel, Folio                 │
│  Services: PricingService, StockService                            │
│  Domain Events · Business Rules · Validation                      │
├─────────────────────────────────────────────────────────────────────┤
│                       CAPA DE INFRAESTRUCTURA                       │
│  Neon PostgreSQL (32 tablas) · Drizzle ORM · Redis (Upstash)      │
│  QStash Jobs · Firebase Auth · S3/Vercel Blob · WebSerial          │
│  Circuit Breaker · Rate Limiting · Distributed Locks               │
└─────────────────────────────────────────────────────────────────────┘
```

### Patrón Offline-First

```
                    ┌──────────────┐
                    │   IndexedDB  │ ◄── Productos cacheados
                    │  Offline DB  │ ◄── Ventas pendientes
                    │              │ ◄── Estado del carrito
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │     Hybrid POS Engine   │
              │  ┌────────┐ ┌────────┐  │
              │  │ Online │ │Offline │  │
              │  │  Mode  │ │  Mode  │  │
              │  └────────┘ └────────┘  │
              │  Idempotency · Dedup    │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │     SyncEngine v1       │
              │  BroadcastChannel       │──► Cross-tab sync
              │  Visibility Refresh     │──► Smart polling
              │  Network Reconnect      │──► Auto-recovery
              │  Circuit Breaker        │──► Fault tolerance
              └─────────────────────────┘
```

---

## Módulos del Sistema

### 💰 Punto de Venta

| Característica | Detalle |
|---|---|
| **Motor Híbrido** | Venta online y offline con cola de sincronización, idempotencia y detección de stale |
| **16 Métodos de Pago** | Efectivo, tarjeta terminal, tarjeta web, tarjeta manual, transferencia, SPEI manual, SPEI Conekta, SPEI Stripe, OXXO Conekta, OXXO Stripe, Clip Checkout, Clip Terminal, PayPal, QR CoDi, fiado, puntos |
| **Impresión ESC/POS** | Impresión directa a térmicas USB vía WebSerial. Fallback a HTML iframe. Soporte 80mm |
| **Cajón de Dinero** | Apertura automática vía pulso ESC/POS (RJ-11) al imprimir ticket |
| **Escáner** | USB keyboard-wedge + cámara del dispositivo (html5-qrcode) |
| **Ticket Designer** | Editor visual drag-and-drop con vista previa en tiempo real. 3 tipos: venta, corte, proveedor |
| **Recargos por Tarjeta** | Comisión configurable (default 2.5%) aplicada automáticamente |
| **Descuentos y Promociones** | Motor de promociones con reglas configurables |

### 📦 Inventario

| Característica | Detalle |
|---|---|
| **Catálogo** | SKU, código de barras, precio costo/venta, categorías, caducidad, stock mínimo |
| **Alertas Inteligentes** | Detección automática de stock bajo, próximo a vencer, vencido y mermas por severidad |
| **Mermas** | Registro con motivo (expiración, daño, robo, desperdicio), evidencia fotográfica vía DropZone |
| **Auditorías** | Sesiones de auditoría de inventario con conteo físico vs sistema |
| **Edición Masiva** | Bulk edit de precios, stock y categorías |
| **Import/Export** | CSV import con validación, Excel/ZIP export, PDF generation |

### 📊 Analíticos e Inteligencia Artificial

| Característica | Detalle |
|---|---|
| **Dashboard KPIs** | Ventas del día, ticket promedio, inventario bajo, alertas activas — actualización en tiempo real |
| **Análisis ABC** | Clasificación de productos por contribución al ingreso (Pareto 80/20) |
| **Análisis RFM** | Segmentación de clientes por Recency, Frequency, Monetary value |
| **Pronóstico de Demanda** | Proyección de ventas basada en tendencias históricas |
| **Aging de Inventario** | Rotación de stock y detección de productos estancados |
| **Márgenes por Producto** | Análisis de rentabilidad individual con costo vs precio |
| **Smart Reorder** | Sugerencias automáticas de reabastecimiento basadas en velocidad de venta |
| **AI Receipt Scanner** | Extracción automática de datos de recibos con OpenAI SDK |
| **Polaris Viz** | Gráficas profesionales: ventas por hora, tendencias mensuales, top productos |

### 💳 Pagos Integrados — 4 Proveedores

| Proveedor | Conexión | Métodos |
|---|---|---|
| **Mercado Pago** | OAuth 2.0 | Terminal Point Smart + Checkout Web (SDK React) |
| **Stripe** | API Keys + Webhook | SPEI automático + OXXO voucher |
| **Conekta** | API Keys + Webhook | SPEI automático + OXXO voucher |
| **Clip** | API Keys + Webhook | Checkout Link + Terminal PinPad |

Plus métodos manuales: **SPEI** (CLABE), **PayPal** (PayPal.Me), **QR de Cobro** (CoDi con auto-verificación vía Cobrar.io).

### 🧾 Facturación Electrónica (CFDI)

Abstracción de PAC (Proveedor Autorizado de Certificación) con soporte para:
- **Facturama** — Facturación en la nube
- **SW Sapien** — Timbrado fiscal
- **Finkok** — Certificación digital

### 🏪 Gestión Financiera

| Módulo | Capacidades |
|---|---|
| **Corte de Caja** | Cierre diario con desglose por método, cortes automáticos programados, impresión de corte |
| **Gastos** | Registro por categoría, escaneo de recibos con IA, integración con corte de caja |
| **Movimientos** | Entradas/salidas de efectivo, fondo inicial configurable |
| **Estado de Resultados** | P&L format con ingresos, costos, gastos y utilidad neta |
| **Flujo de Efectivo** | Cash flow operativo con tendencia y margen |
| **Devoluciones** | Proceso completo con reversión automática de inventario |

### 👥 Clientes y Lealtad

| Característica | Detalle |
|---|---|
| **Fiado (Crédito)** | Límite configurable, seguimiento de saldos, abonos parciales, historial detallado |
| **Programa de Puntos** | Acumulación por compra, canje como método de pago, expiración configurable |
| **Perfiles** | Directorio de clientes con KPIs, historial de compras, segmentación RFM |

### 🚚 Proveedores y Pedidos

| Característica | Detalle |
|---|---|
| **Directorio** | Proveedores con datos de contacto, categoría, condiciones de pago |
| **Órdenes de Compra** | Creación, seguimiento de estados (pendiente/enviado/recibido), impresión de orden |
| **Recepción** | Actualización automática de inventario al recibir, ticket de recepción |

### 🔒 Autenticación y Roles (RBAC)

| Característica | Detalle |
|---|---|
| **Firebase Auth** | Email/password, recuperación de contraseña, sesiones seguras |
| **Roles** | Owner, Admin, Gerente, Cajero, Almacenista, Contador — totalmente customizables |
| **Permisos Granulares** | 12+ permisos: `manage_sales`, `cancel_sales`, `manage_inventory`, `view_reports`, `cashdrawer.open`, etc. |
| **PIN Pad** | Autenticación rápida por PIN numérico para cambio de cajero |

### 🖥️ Customer Display

Pantalla de cara al cliente con animaciones 3D construida con:
- **Three.js** + **React Three Fiber** + **Postprocessing**
- Muestra productos, precios y promociones
- Animaciones configurables desde settings

### 📱 Servicios y Recargas

Motor de pagos de servicios con 4 proveedores:
- **LocalProvider** — Recargas telefónicas locales
- **TuRecarga** — Plataforma de recargas
- **Infopago** — Pagos de servicios
- **Billpocket** — Pagos diversos

### 🔔 Notificaciones

| Canal | Detalle |
|---|---|
| **Telegram** | Alertas de stock crítico en tiempo real vía bot |
| **In-App** | Centro de notificaciones con filtros por severidad y tipo |
| **Toast** | Sistema de notificaciones transaccionales (Sileo) |
| **QStash** | Alertas asíncronas de stock vía background jobs |

---

## Stack Tecnológico

### Core

| Capa | Tecnología | Versión |
|---|---|---|
| **Framework** | Next.js (App Router + Turbopack) | 16.2.3 |
| **Runtime** | React + React Compiler | 19.2.3 |
| **Language** | TypeScript (strict mode) | 6.0.2 |
| **Database** | Neon Serverless PostgreSQL | — |
| **ORM** | Drizzle ORM | 0.45.1 |
| **State** | Zustand (5 slices) | 5.0.11 |
| **Auth** | Firebase Authentication + Admin | 12.10 / 13.7 |
| **Deployment** | Vercel (Edge + Serverless) | — |
| **Package Manager** | Bun | 1.3+ |

### UI & Design

| Tecnología | Uso |
|---|---|
| **Shopify Polaris 13.9** | Design system completo — 110+ componentes |
| **Polaris Viz 16.16** | Gráficas y visualizaciones de datos |
| **Tailwind CSS 4** | Utilidades de estilo |
| **Radix UI** | Primitivas accesibles |
| **Lucide React** | Iconografía complementaria |
| **dnd-kit** | Drag and drop (ticket designer, reordenamiento) |
| **Three.js + R3F** | Pantalla de cliente 3D con postprocessing |

### Infraestructura

| Servicio | Uso |
|---|---|
| **Upstash Redis** | Cache, rate limiting, distributed locks, idempotencia |
| **Upstash QStash** | Background jobs (stock alerts, daily reports, payment polling) |
| **Vercel Blob / AWS S3** | Almacenamiento de archivos (logos, evidencia de mermas) |
| **Vercel Analytics** | Métricas de rendimiento |
| **Vercel Speed Insights** | Core Web Vitals |

### Integraciones de Pago

| Proveedor | Paquete | Versión |
|---|---|---|
| **Stripe** | `stripe` | 21.0.1 |
| **Mercado Pago** | `mercadopago` + `@mercadopago/sdk-react` | 2.0.15 / 0.0.19 |
| **Conekta** | `conekta` | 8.0.2 |
| **Clip** | Custom provider | — |

### AI & Data

| Tecnología | Uso |
|---|---|
| **Vercel AI SDK** | Abstracción de modelos de IA |
| **OpenAI** | Extracción de recibos, análisis de datos |
| **Zod 4** | Validación de schemas y payloads |
| **jsPDF + AutoTable** | Generación de reportes PDF |
| **JsBarcode** | Generación de códigos de barras |
| **html5-qrcode** | Escaneo de QR y códigos de barras por cámara |

---

## Instalación

### Prerrequisitos

| Herramienta | Versión Mínima |
|---|---|
| [Bun](https://bun.sh/) | 1.3+ |
| [Neon](https://neon.tech/) | Cuenta activa |
| [Firebase](https://firebase.google.com/) | Proyecto con Auth habilitado |

### Setup

```bash
# 1. Clonar
git clone https://github.com/OWSSamples/abarrote-gs.git
cd abarrote-gs

# 2. Instalar dependencias
bun install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 4. Setup de base de datos
bun run db:push      # Crear schema en Neon
bun run db:seed      # Datos de demo (opcional)

# 5. Iniciar
bun run dev          # → http://localhost:3000
```

### Scripts

| Comando | Descripción |
|---|---|
| `bun run dev` | Servidor de desarrollo (Turbopack) |
| `bun run build` | Build de producción |
| `bun run start` | Servidor de producción |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript strict check |
| `bun run test` | Vitest (481 unit tests) |
| `bun run test:e2e` | Playwright (7 E2E specs) |
| `bun run db:generate` | Generar migraciones Drizzle |
| `bun run db:migrate` | Ejecutar migraciones |
| `bun run db:push` | Push schema directo |
| `bun run db:studio` | Drizzle Studio (GUI) |
| `bun run db:seed` | Datos de demo |
| `bun run format` | Prettier |

---

## Configuración

### Variables de Entorno

```env
# ── Base de Datos ──
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# ── Firebase ──
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_KEY=    # JSON (para Admin SDK)

# ── Redis (Upstash) ──
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=

# ── Pagos (todos opcionales) ──
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MP_ACCESS_TOKEN=
CONEKTA_PRIVATE_KEY=
CLIP_API_KEY=
CLIP_SECRET_KEY=

# ── Storage ──
BLOB_READ_WRITE_TOKEN=           # Vercel Blob
# O alternativamente:
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# ── AI (opcional) ──
OPENAI_API_KEY=

# ── Notificaciones (opcional) ──
TELEGRAM_BOT_TOKEN=
```

---

## Modelo de Datos

**32 tablas** organizadas por dominio:

```
CORE                    VENTAS                  INVENTARIO
─────────────────       ─────────────────       ─────────────────
store_config            sale_records            products
feature_flags           sale_items              product_categories
audit_logs              devoluciones            merma_records
                        devolucion_items        inventory_audits
                        promotions              inventory_audit_items

FINANZAS                CLIENTES                PROVEEDORES
─────────────────       ─────────────────       ─────────────────
cortes_caja             clientes                proveedores
gastos                  fiado_transactions      pedidos
cash_movements          fiado_items             pedido_items
                        loyalty_transactions

PAGOS                   AUTH                    SERVICIOS
─────────────────       ─────────────────       ─────────────────
payment_charges         role_definitions        servicios
payment_provider_conn   user_roles              cfdi_records
mercadopago_payments
mercadopago_refunds
oauth_states
```

---

## Infraestructura

### Background Jobs (QStash)

| Job | Schedule | Descripción |
|---|---|---|
| **daily-report** | `0 8 * * *` | Reporte diario de ventas |
| **token-maintenance** | `0 6 * * *` | Mantenimiento de tokens OAuth |
| **loyalty-expire** | `0 3 * * 1` | Expiración semanal de puntos de lealtad |
| **stock-alert** | On demand | Alertas de stock crítico vía Telegram |
| **payment-poll** | On demand | Polling de estado de pagos |
| **notification** | On demand | Envío de notificaciones Telegram |

### Webhooks

| Endpoint | Proveedor |
|---|---|
| `/api/webhooks/stripe` | Stripe (SPEI + OXXO confirmations) |
| `/api/webhooks/conekta` | Conekta (SPEI + OXXO confirmations) |
| `/api/webhooks/clip` | Clip (payment confirmations) |
| `/api/webhooks/cobrar` | Cobrar.io (QR payment verification) |
| `/api/webhooks/servicios` | Service providers (recharge status) |
| `/api/mercadopago/webhook` | MercadoPago (payment + refund events) |
| `/api/telegram/webhook` | Telegram bot commands |

### Patrones de Resiliencia

| Patrón | Implementación |
|---|---|
| **Circuit Breaker** | Auto-trip en errores consecutivos, cooldown configurable |
| **Rate Limiting** | Tiers por endpoint (Upstash) |
| **Distributed Locks** | Redis locks para operaciones de stock |
| **Idempotency** | Keys Redis para prevenir duplicados |
| **Soft Delete** | Borrado lógico con restauración |
| **Feature Flags** | Toggle de funcionalidades por DB |
| **Audit Log** | Registro inmutable de operaciones críticas |

---

## Testing

| Tipo | Framework | Archivos | Tests |
|---|---|---|---|
| **Unit** | Vitest 4.1 | 31 | 481 |
| **E2E** | Playwright 1.59 | 7 | — |

```bash
bun run test              # Unit tests
bun run test:watch        # Watch mode
bun run test:ci           # CI mode
bun run test:e2e          # E2E headless
bun run test:e2e:ui       # E2E con UI
```

### Cobertura por Dominio

- **Domain**: `Folio`, `Money`, `Quantity`, `StockLevel`, `Product`, `Sale`, `SaleItem`, `PricingService`, `StockService`
- **Infrastructure**: Circuit breaker, cache, rate limiting, Redis keys, idempotency, soft delete, feature flags, job schemas
- **Application**: Action factory, audit log, auth errors, validation schemas, pagination, helpers, logger, navigation, utils, crypto, RFC validation

---

## Seguridad

| Control | Implementación |
|---|---|
| **Autenticación** | Firebase Auth (email/password) con verificación server-side |
| **Autorización** | RBAC con 12+ permisos granulares |
| **Validación** | Zod 4 schemas en todas las Server Actions |
| **Rate Limiting** | Upstash Redis por endpoint y usuario |
| **CSRF** | Next.js built-in protections |
| **SQL Injection** | Drizzle ORM parameterized queries |
| **XSS** | React auto-escaping + sanitización de inputs |
| **Webhook Verification** | Signature validation (Stripe, QStash, Conekta) |
| **Secrets** | Server-only env vars, no exposición al cliente |
| **Audit Trail** | Log inmutable de operaciones sensibles |

---

## Despliegue

### Vercel (Recomendado)

```bash
# Instalar CLI
bun add -g vercel

# Vincular proyecto
vercel link

# Deploy preview
vercel

# Deploy producción
vercel --prod
```

El proyecto incluye `vercel.json` con:
- 3 cron jobs programados
- Extended function duration para webhooks (30s) e imports (60s)
- Configuración de regiones

---

## Licencia

Licencia propietaria de **OPENDEX**. Consulta el archivo [LICENSE](LICENSE) para términos completos.

---

<p align="center">
  <strong>Kiosko</strong> — Construido para los tenderos de México que merecen tecnología de clase mundial.
</p>

<p align="center">
  <sub>OPENDEX Corporation · 2024–2026</sub>
</p>
