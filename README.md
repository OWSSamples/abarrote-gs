# Abarrotes GS - Sistema de Punto de Venta

Sistema integral de gestión para tiendas de abarrotes y pequeños comercios en México. Solución completa que incluye punto de venta, gestión de inventario, control de crédito a clientes, corte de caja, gastos, proveedores y sistema de roles con autenticación.

## Características Principales

### Punto de Venta (POS)
- Registro de ventas con soporte para escáner de código de barras
- Múltiples métodos de pago: efectivo, tarjeta, transferencia, tarjeta manual y fiado
- Cálculo automático de IVA (16%), cambio y comisión por tarjeta
- Generación de tickets de venta optimizados para impresoras térmicas (58mm/80mm)
- Integración con terminal Mercado Pago Point Smart
- Sistema de puntos de lealtad (monedero electrónico)
- Cancelación de ventas con reversión automática de inventario

### Gestión de Inventario
- Catálogo completo de productos con SKU, código de barras, precio de costo y precio de venta
- Control de stock mínimo con sistema de alertas automáticas
- Registro y seguimiento de mermas (expiración, daño, desperdicio)
- Gestión de productos perecederos con fecha de caducidad
- Actualización de stock en tiempo real
- Categorización de productos

### Corte de Caja
- Cierre diario con desglose detallado por método de pago
- Comparación entre efectivo esperado y efectivo contado
- Cálculo automático de diferencias y fondo inicial
- Historial completo de cortes con capacidad de impresión
- Integración con gastos del día
- Generación automática de cortes programados

### Sistema de Fiado (Crédito a Clientes)
- Registro de clientes con límite de crédito personalizado
- Ventas a crédito directamente desde el punto de venta
- Seguimiento detallado de saldos y abonos
- Historial completo con productos de cada operación
- Alertas de límite de crédito
- Gestión de pagos parciales

### Control de Gastos
- Registro de gastos por categoría (renta, servicios, salarios, proveedores, mantenimiento, impuestos)
- Control de comprobantes fiscales
- Integración automática con corte de caja diario
- Edición y eliminación de registros
- Filtrado por fecha y categoría

### Gestión de Proveedores y Pedidos
- Directorio completo de proveedores con datos de contacto
- Creación y seguimiento de órdenes de compra
- Estados de pedido (pendiente, enviado, recibido)
- Actualización automática de inventario al recibir pedidos
- Historial de pedidos por proveedor

### Dashboard y Reportes
- KPIs en tiempo real (ventas del día, inventario bajo, alertas de caducidad)
- Gráficas de ventas por hora y tendencias mensuales
- Top productos más vendidos
- Reportes detallados por método de pago
- Exportación de datos a formato CSV
- Vista de analíticas avanzadas

### Sistema de Autenticación y Roles
- Autenticación con Firebase Authentication
- Sistema de roles personalizables (owner, admin, gerente, cajero, almacenista, contador)
- Control de acceso granular por permisos
- Gestión de usuarios y asignación de roles
- Perfil de usuario con información personalizada
- Recuperación de contraseña

### Configuración
- Datos de la tienda personalizables (razón social, RFC, régimen fiscal)
- Configuración de impresora térmica
- Gestión de cajeros y empleados
- Parámetros de IVA y comisiones
- Configuración de terminal Mercado Pago

## Stack Tecnológico

### Frontend
- **Framework:** Next.js 16.1.6 (App Router con Turbopack)
- **UI Library:** React 19.2.3
- **Design System:** Shopify Polaris 13.9.5
- **Icons:** Polaris Icons 9.3.1
- **Charts:** Polaris Viz 16.16.0
- **State Management:** Zustand 5.0.11
- **Styling:** Tailwind CSS 4.x
- **Language:** TypeScript 5.x

### Backend
- **Database:** Neon PostgreSQL (Serverless)
- **ORM:** Drizzle ORM 0.45.1
- **Authentication:** Firebase Authentication
- **Runtime:** Bun 1.3+

### Integraciones
- **Payments:** Mercado Pago Point API
- **Barcode:** JsBarcode para generación de códigos
- **PDF Generation:** jsPDF con autotable
- **Notifications:** Sileo (toast system)

## Estructura del Proyecto

```
src/
├── app/
│   ├── actions/
│   │   └── db-actions.ts           # Server Actions (CRUD operations)
│   ├── api/
│   │   └── sync/                   # API endpoints para sincronización
│   ├── auth/
│   │   └── [[...pathname]]/        # Rutas de autenticación
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── PolarisProvider.tsx
├── components/
│   ├── actions/                    # Acciones rápidas del dashboard
│   ├── analytics/                  # Vista de analíticas
│   ├── auth/                       # Componentes de autenticación
│   ├── caja/                       # Corte de caja
│   ├── charts/                     # Gráficas de ventas
│   ├── dashboard/                  # Vista principal
│   ├── export/                     # Exportación CSV
│   ├── fiado/                      # Gestión de fiado
│   ├── filters/                    # Filtros avanzados
│   ├── gastos/                     # Gestión de gastos
│   ├── inventory/                  # Tablas de inventario
│   ├── kpi/                        # Tarjetas KPI
│   ├── metrics/                    # Métricas y top productos
│   ├── modals/                     # Modales del sistema
│   ├── navigation/                 # Navegación y topbar
│   ├── notifications/              # Sistema de notificaciones
│   ├── pedidos/                    # Gestión de pedidos
│   ├── reports/                    # Vista de reportes
│   ├── roles/                      # Gestión de roles
│   ├── sales/                      # Historial de ventas
│   ├── scanner/                    # Escáner de cámara
│   ├── settings/                   # Configuración
│   ├── suppliers/                  # Gestión de proveedores
│   └── ui/                         # Componentes UI reutilizables
├── db/
│   ├── index.ts                    # Conexión a Neon
│   ├── schema.ts                   # Schema de 13 tablas
│   ├── seed.ts                     # Datos de prueba
│   └── audit-schema.ts             # Schema de auditoría
├── lib/
│   ├── auth/                       # Utilidades de autenticación
│   ├── audit.ts                    # Sistema de auditoría
│   ├── backup.ts                   # Respaldos
│   ├── cache.ts                    # Sistema de caché
│   ├── firebase.ts                 # Configuración Firebase
│   ├── mercadopago.ts              # Integración Mercado Pago
│   ├── offline.ts                  # Soporte offline
│   ├── printer.ts                  # Utilidades de impresión
│   ├── stock-lock.ts               # Control de concurrencia
│   ├── usePermissions.ts           # Hook de permisos
│   └── utils.ts                    # Utilidades generales
├── store/
│   └── dashboardStore.ts           # Store global con Zustand
└── types/
    └── index.ts                    # Definiciones TypeScript

public/
├── logo_for_kiosko_login.svg       # Logo del sistema
└── ...                             # Otros assets
```

## Modelo de Datos

El sistema utiliza 13 tablas en PostgreSQL:

### Tablas Principales

**store_config**
- Configuración general de la tienda (nombre, RFC, régimen fiscal, parámetros)

**products**
- Catálogo de productos con SKU, código de barras, precios y stock

**sale_records**
- Registro maestro de ventas con totales y método de pago

**sale_items**
- Detalle de productos por cada venta

**merma_records**
- Registro de mermas con razón y valor

**pedidos**
- Órdenes de compra a proveedores

**pedido_items**
- Detalle de productos por pedido

**clientes**
- Directorio de clientes con límite de crédito

**fiado_transactions**
- Operaciones de crédito (fiado y abonos)

**fiado_items**
- Productos de cada operación de fiado

**gastos**
- Registro de gastos por categoría

**proveedores**
- Directorio de proveedores

**cortes_caja**
- Historial de cortes de caja

**role_definitions**
- Definición de roles y permisos

**user_roles**
- Asignación de roles a usuarios

**servicios**
- Registro de recargas y pagos de servicios

## Instalación

### Prerrequisitos

- Bun >= 1.3 (https://bun.sh/)
- Cuenta en Neon (https://neon.tech/)
- Cuenta en Firebase (https://firebase.google.com/)

### Pasos de Instalación

1. Clonar el repositorio

```bash
git clone https://github.com/OWSSamples/abarrote-gs.git
cd abarrote-gs
```

2. Instalar dependencias

```bash
bun install
```

3. Configurar variables de entorno

Crear archivo `.env.local` en la raíz del proyecto:

```env
# Neon Database
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Inicializar la base de datos

```bash
# Crear las tablas en Neon
bun run db:push

# Cargar datos de prueba (opcional)
bun run db:seed
```

5. Iniciar el servidor de desarrollo

```bash
bun run dev
```

La aplicación estará disponible en http://localhost:3000

## Scripts Disponibles

```bash
# Desarrollo
bun run dev              # Servidor de desarrollo con Turbopack
bun run build            # Build de producción
bun run start            # Servidor de producción
bun run lint             # Ejecutar ESLint

# Base de datos
bun run db:generate      # Generar migraciones Drizzle
bun run db:migrate       # Ejecutar migraciones
bun run db:push          # Push schema directo a BD
bun run db:studio        # Abrir Drizzle Studio (GUI)
bun run db:seed          # Cargar datos de prueba
```

## Configuración de Firebase

1. Crear proyecto en Firebase Console
2. Habilitar Authentication con Email/Password
3. Obtener las credenciales del proyecto
4. Agregar las variables de entorno en `.env.local`

## Configuración de Mercado Pago (Opcional)

Para habilitar pagos con terminal Mercado Pago Point:

1. Obtener Access Token de Mercado Pago
2. Registrar Device ID de tu terminal
3. Configurar en la sección de Configuración del sistema

## Sistema de Permisos

El sistema incluye permisos granulares:

- `view_dashboard` - Ver dashboard principal
- `manage_sales` - Gestionar ventas
- `manage_inventory` - Gestionar inventario
- `manage_clients` - Gestionar clientes
- `manage_suppliers` - Gestionar proveedores
- `manage_expenses` - Gestionar gastos
- `view_reports` - Ver reportes
- `manage_cash_register` - Gestionar corte de caja
- `manage_users` - Gestionar usuarios
- `manage_settings` - Gestionar configuración
- `cancel_sales` - Cancelar ventas

## Impresión de Tickets

Los tickets están diseñados en formato monoespaciado optimizado para impresoras térmicas de 58mm/80mm. Incluyen:

- Datos fiscales completos (RFC, régimen fiscal)
- Desglose de productos con cantidades y precios
- IVA desglosado al 16%
- Código de barras de transacción
- Leyendas legales personalizables

## Seguridad

- Autenticación mediante Firebase Authentication
- Control de acceso basado en roles (RBAC)
- Validación de permisos en cliente y servidor
- Protección de rutas mediante middleware
- Sanitización de datos de entrada
- Conexión segura a base de datos (SSL)

## Optimizaciones

- Server-side rendering con Next.js App Router
- Compilación optimizada con Turbopack
- State management eficiente con Zustand
- Queries optimizadas con Drizzle ORM
- Lazy loading de componentes
- Caché de datos frecuentes
- Soporte para modo offline (en desarrollo)

## Roadmap

- [ ] Modo offline completo con sincronización
- [ ] Integración con proveedores de recargas (Seycel)
- [ ] Reportes avanzados con filtros personalizados
- [ ] Aplicación móvil nativa
- [ ] Integración con SAT para facturación electrónica
- [ ] Dashboard de múltiples sucursales
- [ ] API REST pública para integraciones

## Soporte

Para reportar problemas o solicitar características, crear un issue en el repositorio de GitHub.

## Licencia

Este proyecto está bajo la licencia PROPETARITY OPENDEX. Consultar el archivo LICENSE para más detalles.

## Créditos

Desarrollado para los tenderos de México que buscan modernizar sus operaciones con tecnología accesible y profesional.
