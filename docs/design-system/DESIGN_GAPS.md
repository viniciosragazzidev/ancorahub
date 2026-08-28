# Design Gaps

| ID | Decisão pendente | Por que importa | Impacto até resolver | Dono sugerido |
|---|---|---|---|---|
| DG-001 | RESOLVIDO — Snow é `#f7fafc`; Ink (`#1e1e1e`) é texto primário e Midnight (`#0d111b`) é ação preenchida. Carbon não é token semântico global. | Evita superfícies/texto inconsistentes. | Runtime usa aliases semânticos e preserva adaptação dark. | Design + Produto |
| DG-002 | Definir cores semânticas e contrastes de status. | Estado operacional e acessibilidade. | usar tokens atuais do projeto; não mapear cores decorativas a status. | Design + Acessibilidade |
| DG-003 | RESOLVIDO — control 10 px, card 16 px, image 20 px, panel 32 px e pill 999 px. | Consistência de primitives. | Primitives novos usam apenas esses aliases. | Design |
| DG-004 | Especificar dark theme e estratégia de convergência. | CRM opera em light/dark. | não migrar paleta atual. | Design + Engenharia |
| DG-005 | Definir breakpoints e padrões de reflow. | Uso mobile e tabelas. | preservar comportamento existente. | Design + Engenharia |
| DG-006 | Definir critérios a11y mensuráveis. | Inclusão e qualidade. | aplicar mínimo de projeto; não alegar conformidade WCAG. | Acessibilidade |
| DG-007 | Definir tokens de motion e z-index. | Overlays e consistência. | usar escala existente; não criar valores novos. | Design + Engenharia |
| DG-008 | Especificar primitives operacionais ausentes. | Evita forks locais. | evolução depende de proposta documentada. | Design System |
| DG-009 | EVOLUÍDO — DataTable migrado para base diceui/tablecn com server-side filtering. | `src/components/ui/data-table/` (pattern DG-009 original) substituído por `src/components/data-table/` (diceui). `useDataTable` hook gerencia URL state via nuqs; `DataTableFilterList` + `DataTableSortList` substituem `LeadsFilters` legado. Server-side: `buildDrizzleFilter` converte `ExtendedColumnFilter[]` → Drizzle SQL. | `src/components/ui/data-table/` mantido como referência legada; novo pattern usa `enableAdvancedFilter: true` com `shallow: false` para refetch server. | Design System + Engenharia |
| DG-010 | RESOLVIDO — composição de formulário. | `Field`, `FieldLabel`, `FieldDescription` e `FieldError` já existem; controls continuam independentes. | FormField é a composição desses elementos; schema e regra de negócio ficam fora. | Design System + Engenharia |
| DG-011 | RESOLVIDO — taxonomia de overlays. | Dialog, Drawer, Sheet, Popover, DropdownMenu e Tooltip já têm primitives distintos. | Consumidores usam Dialog, Drawer, Popover, DropdownMenu e Tooltip; Sheet é compatibilidade interna/legada e não é novo conceito de consumo. | Design System + Engenharia |

## Template de resolução

```md
### DG-XXX — Título
- Proposta:
- Evidência/referência:
- Alternativas consideradas:
- Decisão aprovada por:
- Data e versão:
- Tokens/componentes/páginas impactados:
- Migração e rollback:
```

### DG-001 — Paleta neutra e ações
- Proposta: usar Paper `#ffffff` como canvas, Snow `#f7fafc` como superfície sutil, Ink `#1e1e1e` como texto primário e Midnight `#0d111b` como CTA preenchido.
- Evidência/referência: `DESIGN.md`, Tokens de Cor e Filled Action Button.
- Alternativas consideradas: `#fafafa` para Snow e Carbon como segunda ação. Ambas aumentavam ambiguidade em superfícies e ações.
- Decisão aprovada por: solicitação de redesign global baseada nas regras e design, 2026-08-20.
- Data e versão: 2026-08-20, Design Contract 1.2.0.
- Tokens/componentes/páginas impactados: `globals.css`, Button, Card, Input, Table, overlays e feedback compartilhado.
- Migração e rollback: aliases mantêm os nomes runtime; reverter o conjunto de foundations restaura a paleta anterior sem alterar dados.

### DG-009 — DataTable: evolução para diceui/tablecn com server-side filtering
- Proposta: substituir o DataTable canônico (DG-009 original, `src/components/ui/data-table/`) pela base diceui/tablecn (`src/components/data-table/`) com suporte nativo a filtros avançados, ordenação e paginação server-side via nuqs URL state.
- Evidência/referência: https://tablecn.com (diceui data-table), nuqs `createSearchParamsCache`, Drizzle ORM para tradução de filtros.
- Alternativas consideradas: (a) Manter o pattern legado e adicionar filtros manualmente — aumenta código e diverge do ecossistema tablecn. (b) Usar DataTable+FilterList sem server-side filtering — perde paginação real em datasets grandes (>10k leads). (c) Adaptar o hook `useDataTable` com `shallow: false` para forçar refetch server — escolhida por preservar a API do diceui e garantir dados frescos.
- Decisão aprovada por: sessão de implementação 2026-08-28, refatoração do /leads como rota piloto.
- Data e versão: 2026-08-28, Design Contract 1.3.0.
- Tokens/componentes/páginas impactados:
  - `src/components/data-table/*` (diceui) — novos componentes: DataTable, DataTableAdvancedToolbar, DataTableFilterList, DataTableSortList, DataTablePagination, DataTableViewOptions
  - `src/hooks/use-data-table.ts` — hook gerencia URL state via nuqs (`shallow: false` para server-side)
  - `src/shared/data-table/drizzle-filters.ts` — adaptador genérico `buildDrizzleFilter` / `buildDrizzleOrderBy` (reutilizável em todas as rotas)
  - `src/app/(dashboard)/leads/` — LeadsDataTable, leads-table-columns, leads-table-config, page.tsx
  - `src/components/app-providers.tsx` — NuqsAdapter adicionado
  - `src/components/ui/data-table/` — legado, preservado mas não utilizado nas novas implementações
- Migração e rollback:
  - **Migração**: rota piloto `/leads`; demais rotas migrarão gradualmente usando o mesmo `buildDrizzleFilter` com column maps específicos.
  - **Rollback**: reverter `page.tsx` para filtros individuais (parâmetros `status`, `tipo`, etc.) e restaurar `LeadsFilters` removido. O `src/components/ui/data-table/` permanece intacto.
  - **Governança**: novas rotas de lista devem seguir o pattern `useDataTable` + `DataTableFilterList` + `buildDrizzleFilter`; registros de implementação em `reports/agent/implementation/`.

### DG-003 — Escala de raio
- Proposta: controls 10 px, cards 16 px, imagens elevadas 20 px, panels 32 px e pills 999 px.
- Evidência/referência: `DESIGN.md`, Tokens — Spacing & Shapes e Components.
- Alternativas consideradas: manter raios Tailwind heterogêneos ou promover apenas um raio universal. Ambas reduzem a hierarquia visual da referência.
- Decisão aprovada por: solicitação de redesign global baseada nas regras e design, 2026-08-20.
- Data e versão: 2026-08-20, Design Contract 1.2.0.
- Tokens/componentes/páginas impactados: aliases `--radius-control`, `--radius-card`, `--radius-panel`, Button, Card, controls e overlays.
- Migração e rollback: aliases evitam troca de API; a reversão é centralizada em `globals.css`.
