# Canonical Components

Esta matriz elimina ambiguidade de escolha. `READY` significa API e destino definidos; não significa que todas as páginas já migraram.

| Family | Current canonical | Decision | Target | Status |
|---|---|---|---|---|
| Button | `src/components/ui/button.tsx` | KEEP_AND_REFINE | Button | CANONICAL_CANDIDATE |
| Input / Textarea | `input.tsx`, `textarea.tsx` | KEEP_AND_REFINE | Input, Textarea | CANONICAL_CANDIDATE |
| Field | `field.tsx` | KEEP_AND_REFINE | FormField composition | CANONICAL_CANDIDATE |
| Select / Combobox | `select.tsx`, `combobox.tsx` | KEEP_AND_REFINE | Select, Combobox | CANONICAL_CANDIDATE |
| Checkbox / Switch | `checkbox.tsx`, `switch.tsx` | KEEP | Checkbox, Switch | CANONICAL_CANDIDATE |
| Badge / Avatar | `badge.tsx`, `avatar.tsx` | KEEP_AND_REFINE | Badge, Avatar | CANONICAL_CANDIDATE |
| Tooltip / Popover / Dropdown | `tooltip.tsx`, `popover.tsx`, `dropdown-menu.tsx` | KEEP | overlay primitives | CANONICAL_CANDIDATE |
| Dialog / Drawer / Sheet | `dialog.tsx`, `drawer.tsx`, `sheet.tsx` | KEEP_AND_REFINE/DEPRECATE | Dialog, Drawer | CANONICAL_CANDIDATE |
| Toast / Skeleton / EmptyState | `sonner.tsx`, `skeleton.tsx`, `empty-state.tsx` | KEEP_AND_REFINE | feedback family | CANONICAL_CANDIDATE |
| Card | `card.tsx` | KEEP_AND_REFINE | Card | CANONICAL_CANDIDATE |
| Table / Pagination | `table.tsx`, `data-table/*` | KEEP_AND_REFINE | Table, DataTable pattern | CANONICAL_CANDIDATE |
| Tabs / Breadcrumb | `tabs.tsx`, `breadcrumb.tsx` | KEEP_AND_REFINE | Tabs, Breadcrumb | CANONICAL_CANDIDATE |
| PageHeader / FilterToolbar / FormSection | co-located patterns | MERGE | generic patterns | PLANNED |

## Regras de escolha

- A feature deve importar o canonical indicado, nunca criar um primitive equivalente local.
- `Dialog` é para confirmação/ação curta; `Drawer` para exploração contextual/edição extensa. `Sheet` é compatibilidade até DG-011.
- `Select` é lista fechada; `Combobox` é busca em lista grande; não criar Autocomplete sem gap aprovado.
- Checkbox é múltipla escolha, Radio é escolha única e Switch é alteração booleana imediata.
- `Table` é estrutura; DataTable é pattern e permanece bloqueado até DG-009.
- O `Field` atual é a composição de label, descrição e erro; não absorve regra de domínio.
