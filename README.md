<div align="center">

# 🏪 Abarrotes GS — Sistema de Punto de Venta

**Sistema integral de gestión para tiendas de abarrotes en México**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Shopify Polaris](https://img.shields.io/badge/Polaris-13.9-96BF48?style=flat-square&logo=shopify)](https://polaris.shopify.com/)
[![Neon](https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=flat-square&logo=postgresql)](https://neon.tech/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## 📋 Descripción

**Abarrotes GS** es un sistema completo de punto de venta (POS) diseñado específicamente para tiendas de abarrotes y pequeños comercios en México. Construido con tecnologías modernas de producción, ofrece gestión de inventario, ventas con escáner de código de barras, crédito a clientes (fiado), corte de caja, gastos, proveedores e integración con terminal Mercado Pago.

## ✨ Características Principales

### 💰 Punto de Venta (POS)
- Registro de ventas con escáner de código de barras
- 5 métodos de pago: efectivo, tarjeta, tarjeta manual, transferencia y fiado
- Cálculo automático de IVA (16%), cambio y comisión por tarjeta
- Tickets de venta estilo profesional (formato monoespaciado para impresora térmica)
- Integración con terminal Mercado Pago Point Smart

### 📦 Inventario
- Catálogo de productos con SKU, código de barras, precio costo y precio venta
- Control de stock mínimo con alertas automáticas
- Registro de mermas (expiración, daño, desperdicio)
- Gestión de productos perecederos con fecha de caducidad

### 🧾 Corte de Caja
- Cierre diario con desglose por método de pago
- Comparación efectivo esperado vs. contado
- Cálculo automático de diferencias
- Historial completo de cortes con impresión de ticket

### 📝 Fiado (Crédito a Clientes)
- Registro de clientes con límite de crédito
- Ventas a crédito directamente desde el POS
- Seguimiento de saldos y abonos
- Historial detallado con productos de cada operación

### 💸 Gastos
- Registro de gastos por categoría (renta, servicios, salarios, etc.)
- Control de comprobantes fiscales
- Integración con corte de caja diario

### 🚚 Proveedores y Pedidos
- Directorio de proveedores con datos de contacto
- Creación y seguimiento de pedidos de compra
- Estados de pedido (pendiente, enviado, recibido)

### 📊 Dashboard y Reportes
- KPIs en tiempo real (ventas del día, inventario, alertas)
- Gráficas de ventas por hora y tendencias
- Top productos más vendidos
- Reportes por método de pago
- Exportación de datos a CSV

### ⚙️ Configuración
- Datos de la tienda personalizables
- Configuración de impresora térmica
- Gestión de cajeros

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Framework** | Next.js (App Router + Turbopack) | 16.1.6 |
| **UI** | React | 19.2.3 |
| **Design System** | Shopify Polaris | 13.9.5 |
| **Iconos** | Polaris Icons | 9.3.1 |
| **Gráficas** | Polaris Viz | 16.16.0 |
| **Estado** | Zustand | 5.0.11 |
| **Base de Datos** | Neon PostgreSQL (Serverless) | — |
| **ORM** | Drizzle ORM | 0.45.1 |
| **Estilos** | Tailwind CSS | 4.x |
| **Lenguaje** | TypeScript | 5.x |
| **Runtime** | Bun | 1.3+ |

---

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── actions/
│   │   └── db-actions.ts        # Server Actions (CRUD con Neon DB)
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                 # Página principal
│   └── PolarisProvider.tsx      # Provider de Shopify Polaris (es-MX)
├── components/
│   ├── actions/                 # Acciones rápidas del dashboard
│   ├── caja/                    # Corte de caja
│   ├── charts/                  # Gráficas de ventas
│   ├── dashboard/               # Vista principal del dashboard
│   ├── export/                  # Exportación CSV
│   ├── fiado/                   # Gestión de fiado/crédito
│   ├── filters/                 # Filtros avanzados
│   ├── gastos/                  # Gestión de gastos
│   ├── inventory/               # Tabla de inventario
│   ├── kpi/                     # Tarjetas KPI
│   ├── metrics/                 # Top productos
│   ├── modals/                  # Modales (producto, venta, ticket)
│   ├── navigation/              # Sidebar de navegación
│   ├── notifications/           # Sistema de toast (Sileo)
│   ├── reports/                 # Vista de reportes
│   ├── sales/                   # Historial de ventas
│   ├── settings/                # Configuración de la tienda
│   └── suppliers/               # Gestión de proveedores
├── db/
│   ├── index.ts                 # Conexión Neon + Drizzle
│   ├── schema.ts                # 13 tablas PostgreSQL
│   └── seed.ts                  # Datos de prueba
├── lib/
│   ├── mercadopago.ts           # Integración Mercado Pago Point
│   └── utils.ts                 # Utilidades (formatCurrency, etc.)
├── store/
│   └── dashboardStore.ts        # Store global (Zustand)
└── types/
    └── index.ts                 # Tipos TypeScript
```

---

## 🗄️ Modelo de Datos

El sistema cuenta con **13 tablas** en PostgreSQL:

| Tabla | Descripción |
|-------|-------------|
| `products` | Catálogo de productos |
| `sale_records` | Registro de ventas |
| `sale_items` | Detalle de productos por venta |
| `merma_records` | Registro de mermas |
| `pedidos` | Órdenes de compra |
| `pedido_items` | Detalle de productos por pedido |
| `clientes` | Directorio de clientes |
| `fiado_transactions` | Operaciones de crédito |
| `fiado_items` | Productos de cada operación fiado |
| `gastos` | Registro de gastos |
| `proveedores` | Directorio de proveedores |
| `cortes_caja` | Historial de cortes de caja |

---

## 🚀 Instalación

### Prerrequisitos

- [Bun](https://bun.sh/) >= 1.3
- Cuenta en [Neon](https://neon.tech/) (tier gratuito disponible)

### 1. Clonar el repositorio

```bash
git clone https://github.com/OWSSamples/abarrote-gs.git
cd abarrote-gs
```

### 2. Instalar dependencias

```bash
bun install
```

### 3. Configurar variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto:

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> Obtén tu connection string desde el dashboard de [Neon](https://console.neon.tech/).

### 4. Inicializar la base de datos

```bash
# Crear las tablas en Neon
bun run db:push

# (Opcional) Cargar datos de prueba
bun run db:seed
```

### 5. Iniciar el servidor de desarrollo

```bash
bun run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## 📜 Scripts Disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `bun run dev` | Servidor de desarrollo (Turbopack) |
| `build` | `bun run build` | Build de producción |
| `start` | `bun run start` | Servidor de producción |
| `lint` | `bun run lint` | Ejecutar ESLint |
| `db:generate` | `bun run db:generate` | Generar migraciones Drizzle |
| `db:migrate` | `bun run db:migrate` | Ejecutar migraciones |
| `db:push` | `bun run db:push` | Push schema directo a BD |
| `db:studio` | `bun run db:studio` | Abrir Drizzle Studio (GUI) |
| `db:seed` | `bun run db:seed` | Cargar datos de prueba |

---

## 🖨️ Impresión de Tickets

Los tickets de venta y corte de caja están diseñados en formato **monoespaciado puro** (`<pre>`), optimizados para impresoras térmicas de 58mm/80mm. El formato incluye:

- Razón social y datos fiscales
- RFC y régimen fiscal
- Desglose de productos con cantidades y precios
- IVA desglosado al 16%
- Código de transacción
- Leyendas legales

---

## 🔐 Variables de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | Connection string de Neon PostgreSQL | ✅ |

> **Nota:** El archivo `.env.local` está incluido en `.gitignore` y nunca se sube al repositorio.

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para cambios mayores, abre primero un issue para discutir la propuesta.

1. Fork del proyecto
2. Crea tu rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de tus cambios (`git commit -m 'feat: agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

<div align="center">

Hecho con ❤️ para los tenderos de México

</div>
