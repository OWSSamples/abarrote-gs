# ADR-002: Transformación UI Enterprise con Polaris

- **Estado:** Aprobado
- **Fecha:** 2026-05-07
- **Contexto:** Dev solo, 1-5 tiendas, <$50/mes, prioridad UI/UX

---

## Contexto

Kiosko es un sistema POS + inventario para abarrotes mexicanos, construido con Next.js 16, React 19 y **Shopify Polaris 13**. La arquitectura backend (DDD, circuit breaker, RBAC, multi-payment) está sólida con score **7/10 enterprise**.

El área de oportunidad principal es la **capa UI**:
- Componentes Polaris usados correctamente pero sin abstracciones reutilizables
- Sin design system centralizado (tokens, patrones, componentes compound)
- Sin design tokens propios (dependencia 100% en defaults de Polaris)
- Formularios sin patrón estandarizado
- DataTables manuales sin sorteo/filtros abstractos
- Mobile bottom nav con CSS-in-JS inline (no Tailwind)
- Sin documentación de componentes

## Decisión

Implementar una **transformación UI enterprise en 4 fases** usando Polaris al máximo nivel con abstracciones propias encima.

---

## Fase 1: Design System Foundation (Semana 1-2)

### 1.1 Design Tokens (`src/design-system/tokens.ts`)
```typescript
export const tokens = {
  color: {
    brand: { primary: 'var(--color-blue-zodiac)', ... },
    status: { success: 'var(--p-color-bg-success)', ... },
  },
  spacing: { ... }, // Map Polaris spacing tokens
  typography: { ... },
  breakpoint: { mobile: 480, tablet: 768, desktop: 1024, wide: 1440 },
} as const;
```

### 1.2 Componentes Compound Reutilizables
| Componente | Propósito | Polaris Base |
|-----------|-----------|-------------|
| `<PageShell>` | Wrapper para todas las páginas con header, breadcrumbs, actions | Page + Layout |
| `<DataGrid>` | Tabla con sort, filter, pagination, bulk actions | IndexTable + Filters |
| `<FormField>` | Label + Input + Error + Hint unificado | TextField/Select |
| `<StatCard>` | KPI card con trend, sparkline, tooltip | Card + Text |
| `<StatusBadge>` | Badge semántico por dominio (venta, stock, pago) | Badge |
| `<EmptyState>` | Estado vacío consistente con CTA | EmptyState |
| `<ConfirmDialog>` | Modal de confirmación reutilizable | Modal |

### 1.3 Layout System
- `<DashboardGrid>` — Grid responsivo 12-col con breakpoints retail
- `<ActionBar>` — Barra de acciones contextual (bulk operations)
- `<SplitView>` — Master-detail para productos/clientes

---

## Fase 2: Componentes Enterprise (Semana 3-4)

### 2.1 DataGrid Enterprise
```
Features:
- Column sorting (client + server)
- Filter bar con chips
- Pagination cursor-based
- Row selection + bulk actions
- Column visibility toggle
- Export inline (CSV/PDF)
- Empty/Loading/Error states
- Mobile card view (auto-switch < 768px)
```

### 2.2 Form System Enterprise
```
Features:
- Zod schema → auto-generate form fields
- Inline validation con debounce
- Multi-step forms con progress
- Dirty state tracking
- Auto-save draft (localStorage)
- Submit con loading + optimistic UI
```

### 2.3 Navigation Refresh
```
Mejoras:
- Command Palette (Ctrl+K) con fuzzy search
- Breadcrumbs automáticos por ruta
- Sidebar colapsable con state persistido
- Mobile bottom nav → Polaris ActionSheet
- Notification center con history
```

---

## Fase 3: Páginas Rediseñadas (Semana 5-8)

### Páginas priorizadas por impacto:
1. **Dashboard Home** — Hero KPIs + sparklines + quick actions grid
2. **POS/Caja** — Fullscreen mode, keyboard shortcuts, split payment UI
3. **Productos** — DataGrid enterprise + quick edit inline
4. **Inventario** — Stock heatmap + alerts dashboard
5. **Analytics** — Polaris Viz dashboards con date range picker
6. **Configuración** — Settings sections con tabs + search

---

## Fase 4: Polish & Accessibility (Semana 9-10)

- WCAG 2.2 AA audit completo
- Keyboard navigation en todos los modals/dropdowns
- Skip-to-content link
- Focus management en SPA navigation
- Color contrast ratios verificados
- Screen reader testing (VoiceOver/NVDA)
- Performance budget: FCP < 1.5s, LCP < 2.5s, CLS < 0.1

---

## Arquitectura de Componentes

```
src/
├── design-system/              # NEW: Foundation
│   ├── tokens.ts               # Design tokens
│   ├── index.ts                # Barrel exports
│   └── hooks/                  # useBreakpoint, useTheme
│
├── components/
│   ├── patterns/               # NEW: Enterprise patterns
│   │   ├── PageShell.tsx       # Standard page wrapper
│   │   ├── DataGrid/           # Table abstraction
│   │   │   ├── DataGrid.tsx
│   │   │   ├── DataGridFilters.tsx
│   │   │   ├── DataGridPagination.tsx
│   │   │   └── useDataGrid.ts
│   │   ├── FormField.tsx       # Form field wrapper
│   │   ├── FormSection.tsx     # Grouped form fields
│   │   ├── StatCard.tsx        # KPI card
│   │   ├── StatusBadge.tsx     # Semantic badges
│   │   ├── ConfirmDialog.tsx   # Confirmation modal
│   │   ├── SplitView.tsx       # Master-detail
│   │   └── ActionBar.tsx       # Bulk action bar
│   │
│   ├── navigation/             # IMPROVED
│   ├── ui/                     # EXISTING custom primitives
│   └── [domain]/               # EXISTING domain components
```

---

## Opciones Consideradas

### Opción A: Migrar a shadcn/ui (Rechazada)
- **Pro:** Más flexible, Tailwind-native
- **Contra:** Reescribir 20+ páginas, perder Polaris Viz, romper design consistency
- **Veredicto:** Demasiado costoso para dev solo

### Opción B: Polaris + Abstracciones Enterprise (Elegida) ✅
- **Pro:** Aprovechar inversión existente, Polaris Viz, i18n, accessibility built-in
- **Contra:** Vendor lock-in Shopify
- **Veredicto:** ROI máximo — mejorar sin reescribir

### Opción C: Design system desde cero (Rechazada)
- **Pro:** Control total
- **Contra:** Meses de trabajo, no viable para dev solo
- **Veredicto:** Over-engineering

---

## Consecuencias

### Positivas
- UI consistente enterprise-grade sin reescritura masiva
- Componentes reutilizables reducen código por página ~40%
- Accessibility WCAG 2.2 AA por default
- Mobile-first con breakpoints retail-optimized
- Onboarding de futuros devs más rápido (patterns documentados)

### Negativas
- Dependencia en Polaris como foundation layer
- Necesita disciplina para no bypasear los patterns
- Overhead de abstracción inicial (se paga en 3+ páginas)

### Riesgos
- Polaris 14+ puede romper abstracciones → mitigar con tests
- Solo dev → mantener scope pequeño por iteración

---

## Métricas de Éxito

| Métrica | Actual | Target |
|---------|--------|--------|
| Lines of code per page | ~400 | ~150 |
| Consistent page pattern | ~60% | 100% |
| WCAG 2.2 AA compliance | Unknown | Pass |
| Mobile usability score | Unknown | >90 |
| FCP (First Contentful Paint) | Unknown | <1.5s |
| Component reuse rate | ~20% | >60% |
