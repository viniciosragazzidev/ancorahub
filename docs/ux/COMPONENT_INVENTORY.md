# Inventário de Componentes de Interface — Âncora CRM

**Data:** 2026-09-04  
**Etapa:** UX-1A (Auditoria)  
**Diretórios Auditados:** `src/components/ui/`, `src/components/unlumen-ui/`, `src/components/`

---

## 1. Regra de Reutilização Obrigatória

```
REUSE (Reutilizar primitivas existentes)
  ↓
REFINE (Ajustar variantes, tipagem e acessibilidade)
  ↓
MERGE (Consolidar variações duplicadas)
  ↓
CREATE (Criar SOMENTE se houver um gap arquitetural justificado)
```

---

## 2. Inventário de Componentes Existentes e Destino Canônico

| Componente Atual | Localização | Status / Avaliação | Ação na UX-1B |
|---|---|---|---|
| `Button` | `src/components/ui/button.tsx` | Base Shadcn/Radix sólida com variantes (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`) | **REUSE** (Manter como primitive primária) |
| `Badge` | `src/components/ui/badge.tsx` | Variantes semânticas (`default`, `secondary`, `destructive`, `outline`, `warning`, `success`) | **REUSE & REFINE** (Padronizar semântica visual para status) |
| `Card` | `src/components/ui/card.tsx` | Estrutura padrão de Card, CardHeader, CardTitle, CardDescription, CardContent | **REUSE** (Evitar transformar qualquer bloco em Card) |
| `PageHeader` | `src/components/ui/page-header.tsx` & `src/components/dashboard-header.tsx` | Componentes funcionais com breadcrumb, title e actions | **REFINE & MERGE** (Consolidar em uma primitive canônica `PageHeader` com slot para `PageActions`) |
| `Tabs` | `src/components/ui/tabs.tsx` | Primitiva Radix Tabs | **REUSE & REFINE** (Base para a gramática `PageTabs` com suporte a URL) |
| `Dialog` & `Drawer` & `Sheet` | `src/components/ui/dialog.tsx`, `drawer.tsx`, `sheet.tsx` | Primitivas Radix / Vaul acessíveis com foco e escape | **REUSE** (Base para `DetailDrawer` e `ConfirmDialog`) |
| `DropdownMenu` | `src/components/ui/dropdown-menu.tsx` | Primitiva Radix Dropdown com submenus e itens | **REUSE** (Base para `RowActions` com agrupamento semântico) |
| `Table` | `src/components/ui/table.tsx` & `src/components/ui/data-table/` | Estrutura de tabela com paginação e sorting | **REUSE & REFINE** (Padronizar densidade essencial e seleção de linhas) |
| `EmptyState` | `src/components/empty-state.tsx` & `src/components/ui/empty-state.tsx` | Dois componentes existentes com estruturas parecidas | **MERGE** (Consolidar em um único `EmptyState` canônico com tipos semânticos) |
| `Sonner` (Toast) | `src/components/ui/sonner.tsx` & `src/components/motion/animated-toast.tsx` | Toast customizado com animação suave e fundo sólido | **REUSE** (Sistema de toast oficial da aplicação) |
| `Skeleton` | `src/components/ui/skeleton.tsx` & `src/components/unlumen-ui/shimmer-skeleton.tsx` | Primitiva de shimmer para layout shifts | **REUSE** (Base para `TableSkeleton` e `PageSkeleton`) |
| `Tooltip` | `src/components/ui/tooltip.tsx` | Radix Tooltip | **REUSE** (Obrigatório em todas as ações icon-only) |
| `Switch` | `src/components/ui/switch.tsx` | Radix Switch acessível | **REUSE** (Base para `SettingsToggleRow`) |
| `FilterToolbar` & `Faceted` | `src/components/ui/filter-toolbar.tsx`, `faceted.tsx` | Componentes de filtro existentes | **REFINE & MERGE** (Consolidar em `FilterBar` e `ActiveFilterChips`) |

---

## 3. Gaps Arquiteturais Identificados para a UX-1B

Para estabelecer a gramática de página única do CRM, as seguintes composições canônicas serão refinadas/padronizadas a partir dos componentes existentes:
1. `PageHeader` (com suporte integrado a `Breadcrumb`, `Title`, `Description`, `Context/Badge` e `PageActions`).
2. `PageActions` (Primary Action + menu `•••` para ações secundárias e perigosas).
3. `PageTabs` (Navegação de abas com scroll horizontal mobile e sincronização de URL).
4. `FilterBar` & `ActiveFilterChips` (Busca com debounce, dropdowns rápidos e chips de filtros ativos).
5. `RowActions` (Menu `•••` acessível com grupos Principal, Gestão e Perigo).
6. `Section` & `CollapsibleSection` (Hierarquias de conteúdo sem sobrecarga de cards).
7. `SettingsSection` & `SettingsToggleRow` (Apresentação progressiva de configurações).
8. `DetailDrawer` (Visualização e edição rápida de entidades sem troca de contexto).
9. `ConfirmDialog` (Confirmação padronizada para ações destrutivas sem uso de `window.confirm`).
