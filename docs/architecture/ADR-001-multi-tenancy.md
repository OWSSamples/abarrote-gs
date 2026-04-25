# ADR-001: Estrategia de Multi-Tenancy (Multi-Tienda)

- **Estado:** Propuesta — pendiente de aprobación
- **Fecha:** 2026-04-22
- **Decisores:** Owner del producto + arquitecto
- **Contexto técnico:** Next.js 16, Drizzle + Neon Postgres, Firebase Auth, ~30 tablas operativas

---

## 1. Contexto

Hoy el sistema es **single-tenant** en la práctica:

- `store_config` es una tabla de **una sola fila** con `id = 'main'` hardcodeado (~12 lugares: [src/lib/ai.ts](src/lib/ai.ts), [src/lib/oauth-providers.ts](src/lib/oauth-providers.ts), entre otros).
- `AuthenticatedUser` solo expone `uid, email, roleId, permissions` — no hay `storeId`/`tenantId`.
- Existe un **placeholder de UI** para multi-tienda en [src/store/dashboardStore.ts](src/store/dashboardStore.ts) (`activeStoreId: 'main'`, `stores: [...]`) y un [`StoreSelector`](src/components/navigation/StoreSelector.tsx) con etiqueta "Agregar sucursal — Próximamente".
- `payment_provider_connections.storeId` ya tiene la columna pero siempre se usa con valor `'main'`.

Llegamos al momento de escalar a clientes con **varias sucursales** o de ofrecer la app como **SaaS multi-cliente**. Antes de tocar código necesitamos definir el modelo.

---

## 2. Decisores que necesitamos aclarar (BLOQUEANTE)

Antes de elegir, el owner del producto debe responder:

| #   | Pregunta                                                                                                                               | Impacto                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Q1  | ¿Una "instancia de Kiosko" sirve a una sola **empresa/dueño** que tiene varias sucursales, o sirve a **varios dueños** independientes? | Define si la frontera es **store** o **tenant**            |
| Q2  | ¿Productos, proveedores y precios se comparten entre sucursales o cada una tiene los suyos?                                            | Define si los catálogos son **globales** o **por-tienda**  |
| Q3  | ¿El inventario es **por sucursal** (Sucursal A tiene 10 unidades, B tiene 5) o **agregado** (hay 15 unidades en algún lugar)?          | Crítico — implica nueva tabla `product_stock_by_store`     |
| Q4  | ¿Un usuario puede operar en **una** sucursal o en **varias**?                                                                          | Define si `userId→storeId` es 1:1 (FK) o N:N (tabla pivot) |
| Q5  | ¿Configuración de impuestos, CFDI, métodos de pago e integraciones (MP, Stripe…) es por sucursal o global?                             | Define si `store_config` se duplica por tienda             |
| Q6  | ¿Reportes y analítica son siempre por sucursal o el dueño los ve consolidados?                                                         | Afecta queries y permisos                                  |

**Recomendación de defaults para PYMEs mexicanas (caso típico de abarrote):**

- Q1: 1 dueño → N sucursales (no SaaS multi-cliente todavía)
- Q2: Catálogo de productos global, precios pueden ser globales con override por tienda
- Q3: Inventario por sucursal
- Q4: Un usuario opera en una sucursal a la vez (con switch para owner/admin)
- Q5: `store_config` por sucursal (ticket, dirección, terminales) + `tenant_config` global (CFDI, IA, OAuth)
- Q6: Owner ve consolidado, cajero solo ve su sucursal

---

## 3. Opciones consideradas

### Opción A — **Schema-per-store** (separación física)

Una base de datos lógica por sucursal. Drizzle conecta dinámicamente.

- ✅ Aislamiento total. Fácil de cumplir con regulaciones tipo "datos no se mezclan".
- ✅ Backups y borrado por tienda son triviales.
- ❌ Costoso en Neon (cada DB = un branch o instancia)
- ❌ Migraciones se vuelven N veces más lentas
- ❌ No permite consolidación cross-store sin un proceso ETL externo
- ❌ Nuestro placeholder UI ya asume DB compartida — habría que reescribir

### Opción B — **Row-level multi-tenancy con `store_id`** (compartido, columna discriminadora)

Una sola DB; cada tabla operativa lleva `store_id` y todas las queries lo filtran.

- ✅ Mínimo costo en Neon (1 DB)
- ✅ Reportes consolidados son trivialmente `SUM(...) GROUP BY store_id`
- ✅ Compatible con la UI placeholder y `paymentProviderConnections.storeId` ya existente
- ✅ Migración incremental — añadimos columna sin romper nada
- ❌ Riesgo de **data leak** si alguna query se olvida de filtrar → necesitamos disciplina (tests + helper centralizado)
- ❌ Backup/restore selectivo por tienda requiere `pg_dump --where`

### Opción C — **Híbrido: tenant compartido + store_id por sucursal**

Si en el futuro Q1 cambia a multi-cliente: añadir `tenant_id` por encima de `store_id`. Hoy todo el mundo es `tenant_id = 'default'`.

- ✅ Permite crecer sin re-migrar
- ✅ Mismo modelo operativo que Opción B hoy
- ❌ Doble columna en muchas tablas (overhead de claridad mental)

---

## 4. Recomendación

**Opción B con preparación para Opción C.**

Razones:

1. La UI placeholder, `payment_provider_connections.storeId` y el `StoreSelector` ya apuntan a este modelo.
2. Coste cero en Neon vs. branches por sucursal.
3. Permite migración **incremental** sin romper datos existentes (todo va a `store_id = 'main'`).
4. Si en 1 año llega multi-tenant SaaS, añadir `tenant_id` es una migración aditiva.

---

## 5. Plan de implementación (5 fases, reversibles)

### Fase 1 — Fundación (1 PR, ~2 h)

- Crear tabla `stores`:
  ```sql
  CREATE TABLE stores (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    created_at  timestamp DEFAULT now() NOT NULL,
    deleted_at  timestamp
  );
  INSERT INTO stores (id, name) VALUES ('main', 'Tienda Principal');
  ```
- Crear tabla `user_store_access` (Q4 = N:N, permite owner switch):
  ```sql
  CREATE TABLE user_store_access (
    user_id    text NOT NULL,
    store_id   text NOT NULL REFERENCES stores(id),
    is_default boolean DEFAULT false NOT NULL,
    PRIMARY KEY (user_id, store_id)
  );
  ```
- Backfill: cada usuario existente recibe acceso a `'main'`.
- Sin cambios funcionales todavía.

### Fase 2 — Scoping en auth (1 PR, ~3 h)

- Añadir `storeId` a `AuthenticatedUser`:
  - Lee de cookie `__store_id` o, si no existe, del default en `user_store_access`.
- Nuevo helper: `requireStoreScope(): { user, storeId }` (NO toca `requireAuth`).
- Tests: 1 con un solo store (default), 1 con múltiples + cookie selectora.

### Fase 3 — Añadir `store_id` a tablas operativas (1 PR por dominio, ~5 h)

Tablas afectadas (~15):
`products`, `product_categories`, `sale_records`, `sale_items`, `cortes_caja`, `cash_movements`, `clientes`, `fiado_*`, `pedidos`, `gastos`, `merma_records`, `loyalty_transactions`, `devoluciones*`, `inventory_audits`, `proveedores`.

Para cada una:

1. Migración aditiva: `ALTER TABLE ... ADD COLUMN store_id text NOT NULL DEFAULT 'main' REFERENCES stores(id);`
2. Drop default después del backfill (en una segunda migración, una semana después).
3. Reescribir queries en el module action correspondiente para filtrar por `storeId` del scope.
4. Test de regresión: la query devuelve solo filas de la tienda actual.

### Fase 4 — `store_config` por sucursal (1 PR, ~3 h)

- Cambiar PK de `store_config` de "fila única" a `store_id` FK.
- Backfill: la fila `'main'` queda asociada a `store_id = 'main'`.
- Eliminar todos los `eq(storeConfig.id, 'main')` hardcodeados (usar `storeId` del scope).
- `oauth-providers.ts` y `ai.ts` ya reciben `storeId` por parámetro.

### Fase 5 — UI funcional (1 PR, ~4 h)

- Habilitar el "Agregar sucursal" del [`StoreSelector`](src/components/navigation/StoreSelector.tsx).
- Página `/dashboard/settings/sucursales` para CRUD de stores (solo owner).
- Switcher en topbar persiste en cookie `__store_id`.
- Reportes consolidados con tabs "Esta sucursal" / "Todas".

---

## 6. Riesgos y mitigaciones

| Riesgo                                                | Mitigación                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Olvidar filtrar `store_id` en una query → leak        | (a) Helper `scopedDb(storeId)` que envuelve queries de tablas marcadas como tenant. (b) Test de "smoke" que crea 2 tiendas con datos distintos y verifica aislamiento por endpoint. (c) Lint custom que prohíbe `db.select().from(productsTable)` sin `.where(eq(... store_id, ...))` |
| Migración rompe datos existentes                      | Todas las migraciones de Fase 3 son **aditivas** con DEFAULT 'main'. Reversible con `ALTER TABLE DROP COLUMN`                                                                                                                                                                         |
| Cajero ve datos de otra sucursal                      | Cookie de scope se valida en `requireStoreScope`; si no existe acceso → fallback a su default + log                                                                                                                                                                                   |
| Cache de Redis mezcla datos                           | Prefijar TODAS las claves de cache con `storeId:`. Bonus: invalidación por sucursal                                                                                                                                                                                                   |
| Reportes se vuelven más lentos                        | Index compuesto `(store_id, created_at)` en cada tabla nueva                                                                                                                                                                                                                          |
| Inventario por sucursal (Q3) requiere migración mayor | Si Q3 = "agregado", saltarlo y dejar `products.current_stock` global. Si Q3 = "por sucursal", crear `product_stock_by_store(productId, storeId, qty)` en una sub-fase                                                                                                                 |

---

## 7. Lo que **no** vamos a hacer (alcance explícito)

- **No** vamos a soportar multi-cliente SaaS hoy (eso es Opción C — preparado, no implementado).
- **No** vamos a fragmentar la DB (Opción A descartada).
- **No** vamos a tocar Firebase Auth — los usuarios siguen siendo globales, el acceso a sucursales se controla en `user_store_access`.
- **No** vamos a duplicar OAuth tokens por sucursal en Fase 1 — hoy MercadoPago/Stripe es único por instalación.

---

## 8. Decisión

> **Pendiente.** Necesitamos respuestas a Q1–Q6 (sección 2) antes de empezar Fase 1.
> Una vez aprobadas las respuestas, el plan completo de 5 fases tiene un esfuerzo estimado de **~17 h de implementación** + 1 semana de soak/migración progresiva.

---

## 9. Métricas de éxito

- 0 queries de tablas operativas sin filtro `store_id` (verificado por lint).
- 0 escapes de datos cross-store en suite de tests de aislamiento.
- Reportes "todas las sucursales" se computan con la misma query + `GROUP BY store_id`.
- Owner puede crear una nueva sucursal y empezar a vender en <2 minutos sin tocar DB.
