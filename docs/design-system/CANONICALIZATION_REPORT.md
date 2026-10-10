# Canonicalization Report — Etapa 3

## Resumo executivo

O projeto já possui uma base central em `src/components/ui`; esta etapa a declarou como fonte oficial e registrou destinos para implementações equivalentes, sem migração de páginas.

## Mantidos/refinados

Button, Input, Textarea, Select, Combobox, Checkbox, Switch, Badge, Avatar, Tooltip, Popover, DropdownMenu, Dialog, Drawer, Sheet, Sonner/Toast, Skeleton, EmptyState, Card, Table, Pagination, Tabs e Breadcrumb permanecem na pasta de primitives.

## Revalidação das famílias prioritárias

| Família | Candidata/caminho | Usos aprox. | Concorrentes | Contrato/foundations | Estados/a11y | Testes | Decisão/status |
|---|---|---:|---|---|---|---|---|
| Button | `ui/button.tsx` | 9 implementações candidatas | wrappers locais | usa tokens runtime; radius/sombra ainda legados | foco, disabled, active, reduced motion | não localizado | KEEP_AND_REFINE / CANONICAL_CANDIDATE |
| Input | `ui/input.tsx` | 2 candidatas | inputs nativos | tokens runtime; radius legado | placeholder, invalid, disabled, formatação | não localizado | KEEP_AND_REFINE / CANONICAL_CANDIDATE |
| Select | `ui/select.tsx` | 7 candidatas | 17 selects nativos confirmados | primitive portalizada; tokens runtime | disabled, label; overlay depende de taxonomia | não localizado | KEEP_AND_REFINE / CANONICAL_CANDIDATE |
| Card | `ui/card.tsx` | 16 candidatas | cards de feature | surface/border runtime; contrato visual pendente | composição estrutural | não localizado | KEEP_AND_REFINE / CANONICAL_CANDIDATE |
| Dialog/Drawer | `ui/dialog.tsx`, `ui/drawer.tsx` | 20+ candidatos | Sheet/wrappers | primitives existentes; DG-011 resolvido | portal/foco/Escape pela primitive | não localizado | KEEP_AND_REFINE / CANONICAL_CANDIDATE |
| Table/DataTable | `ui/table.tsx`, `ui/data-table/*` | 13 candidatas | HTML/custom | fronteira DG-009 definida | empty/loading/paginação no pattern | não localizado | KEEP_AND_REFINE / CANONICAL_CANDIDATE |
| Tabs | `ui/tabs.tsx` | 6 candidatas | variações visuais | motion/radius runtime | role tab, selected, disabled, reduced motion | não localizado | KEEP_AND_REFINE / CANONICAL_CANDIDATE |

Nenhuma destas famílias atingiu `CANONICAL_READY`: faltam revisão visual, inventário de variantes contra foundations oficiais e testes de comportamento proporcionais.

## Bloqueios legítimos

- DG-009: DataTable canônico.
- DG-010: FormField/controles de formulário.
- DG-011: responsabilidade/escala de overlays.
- DG-002 e DG-004 a DG-007 ainda impedem declarar uma convergência visual integral como aprovada.

## APIs e destino

Consulte [CANONICAL_COMPONENTS.md](./CANONICAL_COMPONENTS.md), `components/` e [.agent/component-migration-map.json](../../.agent/component-migration-map.json). Aliases/implementações legadas não devem receber novos usos.

## Baseline e enforcement

[.agent/visual-baselines.json](../../.agent/visual-baselines.json) registra componentes para revisão visual; nenhum foi marcado APPROVED sem runtime review. A baseline de dívida permanece em [.agent/ui-inventory.json](../../.agent/ui-inventory.json); o auditor existente continua reportando selects nativos sem quebrar a migração de legado.

## Próxima etapa recomendada

Resolver DG-009/DG-010/DG-011 e, então, migrar um único padrão controlado (por exemplo, formulário de configuração ou List Page) com testes de interação e revisão visual.
