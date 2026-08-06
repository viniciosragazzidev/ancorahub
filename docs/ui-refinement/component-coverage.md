# Cobertura de Componentes e Rotas - Refinamento Global UI / Design System

> Matriz oficial de controle e auditoria para o alinhamento 100% transversal ao Design System do Âncora CRM.

---

## 1. Cobertura por Família de Componentes

### Família 1 — Fundamentos & Tokens
- [x] Tokens Visuais (`DESIGN.md`, HSL tailwind, CSS variables)
- [x] Escala Unificada de Espaçamento & Radii (8px base radius)
- [x] Token de Motion Central (`src/lib/motion.ts`)
- [x] Catálogo de Tipografia Operacional (Geist font)

### Família 2 — Controles de Entrada
- [x] `Button` (`src/components/ui/button.tsx`)
- [x] `Select` / `AppSelect` (`src/components/ui/select.tsx`) — **100% Migrado (0 violações nativas)**
- [x] `Combobox` / `AppCombobox` (`src/components/ui/combobox.tsx`) — **Criado & Integrado**
- [x] `Input` (`src/components/ui/input.tsx`)
- [x] `Textarea` (`src/components/ui/textarea.tsx`)
- [x] `Checkbox` (`src/components/ui/checkbox.tsx`)
- [x] `Switch` / `RadioGroup`
- [x] `DatePicker` / `DateRangePicker`

### Família 3 — Navegação & Estrutura
- [x] `Sidebar` (`src/components/corretop-sidebar.tsx`, `platform-admin-sidebar.tsx`)
- [x] `DashboardHeader` / `PlatformAdminHeader`
- [x] `Tabs` (`src/components/ui/tabs.tsx`)
- [x] `Breadcrumbs` (`src/components/ui/breadcrumb.tsx`)

### Família 4 — Feedback & Overlays
- [x] `Toast` (`src/components/ui/sonner.tsx`)
- [x] `Alert` / `ContextNote` (`src/components/ui/context-note.tsx`)
- [x] `Dialog` / `Modal` (`src/components/ui/dialog.tsx`)
- [x] `Drawer` / `Sheet` (`src/components/ui/sheet.tsx`, `drawer.tsx`)
- [x] `Tooltip` (`src/components/ui/tooltip.tsx`)

### Família 5 — Exibição de Dados & Catálogo Visual
- [x] `Table` & `DataTable` (`src/components/ui/table.tsx`)
- [x] `StatCard` / Bento Cards (`src/components/ui/card.tsx`)
- [x] `Badge` / Status (`src/components/status-badges.tsx`, `badge.tsx`)
- [x] `Visual Design System Catalog` (`/internal/design-system`) — **Criado**

---

## 2. Auditoria Automatizada do Design System (`npm run ui:audit`)

| Regra | Alvo | Status | Controles Detectados |
|---|---|:---:|:---:|
| `NATIVE_SELECT` | Repositório Completo | **PASS (0 violações)** | 0 `<select>` nativos |

---

## 3. Matriz de Auditoria de Controles Nativos Migrados

| Componente Encontrado | Localização | Componente Destino | Status |
|---|---|---|:---:|
| `<select>` (x3) | `src/app/(dashboard)/catalogo/interno/page.tsx` | `AppSelect` | **Concluído** |
| `<select>` | `src/app/(dashboard)/equipe/team-invite-form.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x2) | `src/app/(dashboard)/leads/_components/manual-lead-form.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x2) | `src/app/(dashboard)/leads/distribuicao/_components/distribution-dashboard.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x3) | `src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x4) | `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx` | `AppSelect` | **Concluído** |
| `<select>` | `src/features/leads/components/lead-tasks.tsx` | `AppSelect` | **Concluído** |
| `<select>` | `src/features/performance/components/director-performance-manager.tsx` | `AppSelect` | **Concluído** |
| `<select>` | `src/features/communication-channels/components/meta-manual-integration-workspace.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x2) | `src/features/documents/components/documents-workspace.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x3) | `src/features/documents/components/lead-documents-section.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x3) | `src/app/(dashboard)/settings/_components/ai-settings-tab.tsx` & `agent-training-tab.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x2) | `src/app/(dashboard)/roadmap/page.tsx` | `AppSelect` | **Concluído** |
| `<select>` | `src/app/(dashboard)/vendas/sales-workspace.tsx` | `AppSelect` | **Concluído** |
| `<select>` (x5) | `src/app/(platform-admin)/super-admin/` | `AppSelect` | **Concluído** |
