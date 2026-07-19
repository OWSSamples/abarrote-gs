<p align="center">
  <img src="public/icon/OWS-Dash.png" alt="Kiosko" width="200" height="200" />
</p>

<h1 align="center">KIOSKO</h1>

<p align="center">
  <strong>Enterprise Point of Sale Platform for Mexican Retail</strong>
</p>

<p align="center">
  <code>Version 0.12.568 Prerelease | Proprietary Software</code>
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

## Executive Summary

**Kiosko** is an enterprise-grade point of sale platform engineered specifically for convenience stores, grocery shops, and small retail businesses in Mexico. This is not merely a POS system — it is a comprehensive business operating system.

Built on an **offline-first architecture** with real-time synchronization, native ESC/POS thermal printing, integration with 4 payment providers, electronic invoicing (CFDI 4.0), AI-powered analytics, and an enterprise-class user experience powered by Shopify Polaris.

```
System Metrics: 32 Database Tables | 24 Server Actions | 10 API Route Groups | 110+ Components | 481 Passing Tests | 25 Migrations
```

**Status:** Production-ready enterprise software. All rights reserved by OPENDEX Corporation.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Core Modules](#core-modules)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Data Model](#data-model)
- [Infrastructure](#infrastructure)
- [Testing Strategy](#testing-strategy)
- [Security Controls](#security-controls)
- [Deployment](#deployment)
- [Licensing](#licensing)

---

## System Architecture

### Four-Layer Enterprise Architecture

```
+---------------------------------------------------------------------+
|                      PRESENTATION LAYER                              |
|  Next.js 16 App Router · Shopify Polaris · Polaris Viz · Three.js   |
|  Zustand State Management (5 slices) · React 19 · Turbopack         |
+---------------------------------------------------------------------+
|                      APPLICATION LAYER                               |
|  24 Server Actions · 10 API Route Groups · 3 Cron Jobs              |
|  Action Factory Pattern · Safe Actions · Error Boundaries           |
+---------------------------------------------------------------------+
|                        DOMAIN LAYER                                  |
|  Entities: Product, Sale, SaleItem, Customer, Payment               |
|  Value Objects: Money, Quantity, StockLevel, Folio                  |
|  Domain Services: PricingService, StockService, PaymentService      |
|  Domain Events · Business Rules · Validation Logic                  |
+---------------------------------------------------------------------+
|                    INFRASTRUCTURE LAYER                              |
|  Neon PostgreSQL (32 tables) · Drizzle ORM · Redis (Upstash)        |
|  QStash Job Queue · AWS Cognito · S3/Vercel Blob · WebSerial API    |
|  Circuit Breaker · Rate Limiting · Distributed Locks                |
+---------------------------------------------------------------------+
```

### Offline-First Synchronization Pattern

```
                    +--------------+
                    |   IndexedDB  | <-- Cached Products
                    |  Offline DB  | <-- Pending Transactions
                    |              | <-- Cart State
                    +------+-------+
                           |
              +------------v------------+
              |     Hybrid POS Engine   |
              |  +--------+ +--------+  |
              |  | Online | |Offline |  |
              |  |  Mode  | |  Mode  |  |
              |  +--------+ +--------+  |
              |  Idempotency · Dedup    |
              +------------+------------+
                           |
              +------------v------------+
              |     SyncEngine v1       |
              |  BroadcastChannel       |--> Cross-tab synchronization
              |  Visibility Refresh     |--> Smart polling
              |  Network Reconnect      |--> Auto-recovery
              |  Circuit Breaker        |--> Fault tolerance
              +-------------------------+
```

---

## Core Modules

### Point of Sale System

| Feature | Specification |
|---------|---------------|
| **Hybrid Engine** | Online and offline transaction processing with sync queue, idempotency keys, and stale detection |
| **16 Payment Methods** | Cash, card terminal, card web, card manual, bank transfer, manual SPEI, Conekta SPEI, Stripe SPEI, OXXO Conekta, OXXO Stripe, Clip Checkout, Clip Terminal, PayPal, CoDi QR, credit (fiado), loyalty points |
| **ESC/POS Printing** | Direct USB thermal printer via WebSerial API. HTML iframe fallback. 80mm support |
| **Cash Drawer Control** | Automatic opening via ESC/POS pulse (RJ-11) on ticket print |
| **Barcode Scanning** | USB keyboard-wedge scanners + device camera (html5-qrcode) |
| **Ticket Designer** | Visual drag-and-drop editor with real-time preview. 3 template types: sales, cashout, supplier |
| **Card Surcharges** | Configurable commission (default 2.5%) applied automatically |
| **Discounts Engine** | Promotion rules engine with configurable conditions |

### Inventory Management

| Feature | Specification |
|---------|---------------|
| **Product Catalog** | SKU, barcode, cost/sale price, categories, expiration dates, minimum stock levels |
| **Smart Alerts** | Automatic detection of low stock, near-expiry, expired products, and shrinkage by severity |
| **Shrinkage Tracking** | Registration with reason codes (expiration, damage, theft, waste), photo evidence via DropZone |
| **Inventory Audits** | Physical count sessions with system variance reporting |
| **Bulk Operations** | Mass editing of prices, stock levels, and categories |
| **Import/Export** | CSV import with validation, Excel/ZIP export, PDF report generation |

### Analytics and Business Intelligence

| Feature | Specification |
|---------|---------------|
| **KPI Dashboard** | Daily sales, average ticket, low inventory alerts, active warnings — real-time updates |
| **ABC Analysis** | Product classification by revenue contribution (Pareto 80/20 principle) |
| **RFM Analysis** | Customer segmentation by Recency, Frequency, Monetary value |
| **Demand Forecasting** | Sales projections based on historical trends |
| **Inventory Aging** | Stock rotation analysis and identification of slow-moving products |
| **Product Margins** | Individual profitability analysis with cost vs price comparison |
| **Smart Reorder** | Automatic restocking suggestions based on sell-through velocity |
| **AI Receipt Scanner** | Automatic data extraction from receipts using OpenAI SDK |
| **Polaris Viz Charts** | Professional visualizations: hourly sales, monthly trends, top products |

### Payment Gateway Integration

| Provider | Connection Method | Supported Methods |
|----------|-------------------|-------------------|
| **Mercado Pago** | OAuth 2.0 | Terminal Point Smart + Web Checkout (React SDK) |
| **Stripe** | API Keys + Webhooks | Automatic SPEI + OXXO voucher |
| **Conekta** | API Keys + Webhooks | Automatic SPEI + OXXO voucher |
| **Clip** | API Keys + Webhooks | Checkout Link + PinPad Terminal |

Additional manual methods: **SPEI** (CLABE), **PayPal** (PayPal.Me), **Payment QR** (CoDi with auto-verification via Cobrar.io).

### Electronic Invoicing (CFDI 4.0)

PAC (Certified Service Provider) abstraction layer supporting:
- **Facturama** — Cloud-based invoicing
- **SW Sapien** — Fiscal stamping services
- **Finkok** — Digital certification

### Financial Management

| Module | Capabilities |
|--------|--------------|
| **Cash Register Close** | Daily closing by payment method, scheduled automatic closes, printed close reports |
| **Expense Tracking** | Category-based expenses, receipt scanning with AI, cash register integration |
| **Cash Movements** | Cash inflows/outflows, configurable opening balance |
| **Income Statement** | P&L format with revenue, COGS, expenses, and net profit |
| **Cash Flow** | Operational cash flow with trend analysis and margins |
| **Returns Processing** | Complete return workflow with automatic inventory reversal |

### Customer Loyalty Program

| Feature | Specification |
|---------|---------------|
| **Credit System (Fiado)** | Configurable credit limits, balance tracking, partial payments, detailed history |
| **Points Program** | Purchase-based accumulation, redemption as payment method, configurable expiration |
| **Customer Profiles** | Customer directory with KPIs, purchase history, RFM segmentation |

### Supplier Management

| Feature | Specification |
|---------|---------------|
| **Supplier Directory** | Contact information, categories, payment terms |
| **Purchase Orders** | Creation, status tracking (pending/shipped/received), order printing |
| **Receiving** | Automatic inventory update on receipt, receiving tickets |

### Authentication and Access Control (RBAC)

| Feature | Specification |
|---------|---------------|
| **AWS Cognito** | Email/password authentication, password recovery, secure sessions |
| **Role System** | Owner, Admin, Manager, Cashier, Warehouse, Accountant — fully customizable |
| **Granular Permissions** | 12+ permissions: manage_sales, cancel_sales, manage_inventory, view_reports, cashdrawer.open, etc. |
| **PIN Authentication** | Quick numeric PIN login for cashier changes |

### Customer Display

Client-facing display with 3D animations built with:
- **Three.js** + **React Three Fiber** + **Postprocessing**
- Displays products, prices, and promotions
- Configurable animations via settings panel

### Services and Top-ups

Payment services engine with 4 providers:
- **LocalProvider** — Local mobile top-ups
- **TuRecarga** — Top-up platform
- **Infopago** — Bill payments
- **Billpocket** — Diverse payment services

### Notification System

| Channel | Specification |
|---------|---------------|
| **Telegram** | Real-time critical stock alerts via bot |
| **In-App** | Notification center with severity and type filters |
| **Toast** | Transactional notification system (Sileo) |
| **QStash** | Async stock alerts via background jobs |

---

## Technology Stack

### Core Technologies

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router + Turbopack) | 16.2.3 |
| **Runtime** | React + React Compiler | 19.2.3 |
| **Language** | TypeScript (strict mode) | 6.0.2 |
| **Database** | Neon Serverless PostgreSQL | — |
| **ORM** | Drizzle ORM | 0.45.1 |
| **State Management** | Zustand (5 slices) | 5.0.11 |
| **Authentication** | AWS Cognito (aws-amplify + aws-jwt-verify) | 6.16 / 5.1 |
| **Deployment** | Vercel (Edge + Serverless) | — |
| **Package Manager** | Bun | 1.3+ |

### User Interface

| Technology | Purpose |
|------------|---------|
| **Shopify Polaris 13.9** | Complete design system — 110+ components |
| **Polaris Viz 16.16** | Data visualization and charts |
| **Tailwind CSS 4** | Utility-first styling |
| **Radix UI** | Accessible primitives |
| **Lucide React** | Icon library |
| **dnd-kit** | Drag and drop functionality (ticket designer, reordering) |
| **Three.js + R3F** | 3D customer display with postprocessing |

### Infrastructure Services

| Service | Purpose |
|---------|---------|
| **Upstash Redis** | Caching, rate limiting, distributed locks, idempotency keys |
| **Upstash QStash** | Background jobs (stock alerts, daily reports, payment polling) |
| **Vercel Blob / AWS S3** | File storage (logos, shrinkage evidence) |
| **Vercel Analytics** | Performance metrics |
| **Vercel Speed Insights** | Core Web Vitals monitoring |

### Payment Integrations

| Provider | Package | Version |
|----------|---------|---------|
| **Stripe** | stripe | 21.0.1 |
| **Mercado Pago** | mercadopago + @mercadopago/sdk-react | 2.0.15 / 0.0.19 |
| **Conekta** | conekta | 8.0.2 |
| **Clip** | Custom provider implementation | — |

### AI and Data Processing

| Technology | Purpose |
|------------|---------|
| **Vercel AI SDK** | AI model abstraction layer |
| **OpenAI** | Receipt extraction, data analysis |
| **Zod 4** | Schema validation and payload verification |
| **jsPDF + AutoTable** | PDF report generation |
| **JsBarcode** | Barcode generation |
| **html5-qrcode** | QR and barcode scanning via camera |

---

## Installation

### Prerequisites

| Tool | Minimum Version |
|------|-----------------|
| [Bun](https://bun.sh/) | 1.3+ |
| [Neon](https://neon.tech/) | Active account |
| [AWS Cognito](https://aws.amazon.com/cognito/) | User Pool with enabled App Client |

### Setup Procedure

```bash
# 1. Clone repository
git clone https://github.com/OWSSamples/abarrote-gs.git
cd abarrote-gs

# 2. Install dependencies
bun install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Database setup
bun run db:push      # Create schema in Neon
bun run db:seed      # Seed demo data (optional)

# 5. Start development server
bun run dev          # http://localhost:3000
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Development server (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Production server |
| `bun run lint` | ESLint validation |
| `bun run typecheck` | TypeScript strict mode check |
| `bun run test` | Vitest unit tests (481 tests) |
| `bun run test:e2e` | Playwright E2E tests (7 specs) |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Execute migrations |
| `bun run db:push` | Direct schema push |
| `bun run db:studio` | Drizzle Studio GUI |
| `bun run db:seed` | Seed demo data |
| `bun run format` | Prettier formatting |

---

## Configuration

### Environment Variables

```env
# -- Database Configuration --
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# -- AWS Cognito Configuration --
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_DOMAIN=
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# -- Redis Configuration (Upstash) --
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=

# -- Payment Providers (all optional) --
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MP_ACCESS_TOKEN=
CONEKTA_PRIVATE_KEY=
CLIP_API_KEY=
CLIP_SECRET_KEY=

# -- Storage Configuration --
BLOB_READ_WRITE_TOKEN=
# Alternative configuration:
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# -- AI Services (optional) --
OPENAI_API_KEY=

# -- Notification Services (optional) --
TELEGRAM_BOT_TOKEN=
```

---

## Data Model

**32 tables** organized by business domain:

```
CORE DOMAIN               SALES DOMAIN            INVENTORY DOMAIN
─────────────────         ─────────────────       ─────────────────
store_config              sale_records            products
feature_flags             sale_items              product_categories
audit_logs                devoluciones            merma_records
                          devolucion_items        inventory_audits
                          promotions              inventory_audit_items

FINANCE DOMAIN            CUSTOMER DOMAIN         SUPPLIER DOMAIN
─────────────────         ─────────────────       ─────────────────
cortes_caja               clientes                proveedores
gastos                    fiado_transactions      pedidos
cash_movements            fiado_items             pedido_items
                          loyalty_transactions

PAYMENT DOMAIN            AUTHENTICATION          SERVICES DOMAIN
─────────────────         ─────────────────       ─────────────────
payment_charges           role_definitions        servicios
payment_provider_conn     user_roles              cfdi_records
mercadopago_payments
mercadopago_refunds
oauth_states
```

---

## Infrastructure

### Background Job Schedule (QStash)

| Job Name | Schedule | Description |
|----------|----------|-------------|
| **daily-report** | 0 8 * * * | Daily sales summary report |
| **token-maintenance** | 0 6 * * * | OAuth token refresh and cleanup |
| **loyalty-expire** | 0 3 * * 1 | Weekly loyalty points expiration |
| **stock-alert** | On demand | Critical stock alerts via Telegram |
| **payment-poll** | On demand | Payment status polling |
| **notification** | On demand | Telegram notification dispatch |

### Webhook Endpoints

| Endpoint | Provider |
|----------|----------|
| `/api/webhooks/stripe` | Stripe (SPEI + OXXO confirmations) |
| `/api/webhooks/conekta` | Conekta (SPEI + OXXO confirmations) |
| `/api/webhooks/clip` | Clip (payment confirmations) |
| `/api/webhooks/cobrar` | Cobrar.io (QR payment verification) |
| `/api/webhooks/servicios` | Service providers (recharge status) |
| `/api/mercadopago/webhook` | MercadoPago (payment + refund events) |
| `/api/telegram/webhook` | Telegram bot commands |

### Resilience Patterns

| Pattern | Implementation |
|---------|----------------|
| **Circuit Breaker** | Auto-trip on consecutive failures, configurable cooldown |
| **Rate Limiting** | Tiered limits per endpoint (Upstash Redis) |
| **Distributed Locks** | Redis-based locks for stock operations |
| **Idempotency** | Redis keys to prevent duplicate transactions |
| **Soft Delete** | Logical deletion with restoration capability |
| **Feature Flags** | Database-driven feature toggles |
| **Audit Logging** | Immutable log of critical operations |

---

## Testing Strategy

| Test Type | Framework | Files | Tests |
|-----------|-----------|-------|-------|
| **Unit Tests** | Vitest 4.1 | 31 | 481 |
| **E2E Tests** | Playwright 1.59 | 7 | — |

```bash
bun run test              # Execute unit tests
bun run test:watch        # Watch mode for development
bun run test:ci           # CI/CD mode
bun run test:e2e          # Headless E2E tests
bun run test:e2e:ui       # E2E tests with UI
```

### Domain Coverage

- **Domain Layer**: Folio, Money, Quantity, StockLevel, Product, Sale, SaleItem, PricingService, StockService
- **Infrastructure Layer**: Circuit breaker, cache management, rate limiting, Redis key patterns, idempotency, soft delete, feature flags, job schemas
- **Application Layer**: Action factory, audit logging, authentication errors, validation schemas, pagination, helpers, logger, navigation, utilities, crypto, RFC validation

---

## Security Controls

| Control | Implementation |
|---------|----------------|
| **Authentication** | AWS Cognito (email/password) with server-side JWT verification |
| **Authorization** | RBAC with 12+ granular permissions |
| **Input Validation** | Zod 4 schemas on all Server Actions |
| **Rate Limiting** | Upstash Redis per endpoint and user |
| **CSRF Protection** | Next.js built-in protections |
| **SQL Injection Prevention** | Drizzle ORM parameterized queries |
| **XSS Prevention** | React auto-escaping + input sanitization |
| **Webhook Verification** | Signature validation (Stripe, QStash, Conekta) |
| **Secrets Management** | Server-only environment variables, no client exposure |
| **Audit Trail** | Immutable logging of sensitive operations |

---

## Deployment

### Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
bun add -g vercel

# Link project
vercel link

# Deploy preview
vercel

# Deploy production
vercel --prod
```

The project includes `vercel.json` configuration with:
- 3 scheduled cron jobs
- Extended function duration for webhooks (30s) and imports (60s)
- Regional deployment configuration

---

## Licensing

This software is proprietary property of **OPENDEX Corporation**. All rights reserved.

Unauthorized copying, distribution, modification, or use of this software is strictly prohibited. This codebase contains confidential and proprietary information protected by trade secret laws and international copyright treaties.

For licensing inquiries, contact: legal@opendex.com

See the [LICENSE](LICENSE) file for complete terms and conditions.

---

## Support and Documentation

- **Architecture Documentation**: `/docs/architecture/`
- **Security Policy**: [SECURITY.md](SECURITY.md)
- **Development Roadmap**: `/docs/ROADMAP_MASTER.md`
- **Agent Guidelines**: [AGENTS.md](AGENTS.md)

---

<p align="center">
  <strong>KIOSKO Enterprise POS Platform</strong>
</p>

<p align="center">
  Engineered for Mexican retailers who deserve world-class technology.
</p>

<p align="center">
  <sub>OPENDEX Corporation | 2024–2026 | All Rights Reserved</sub>
</p>
