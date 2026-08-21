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
| DG-009 | RESOLVIDO — DataTable canônico. | `src/components/ui/data-table/` já compõe TanStack, Table, paginação, seleção, loading/vazio e visibilidade. | `Table` permanece primitive; `DataTable` é pattern composicional, sem API de booleanos novos. | Design System + Engenharia |
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

### DG-003 — Escala de raio
- Proposta: controls 10 px, cards 16 px, imagens elevadas 20 px, panels 32 px e pills 999 px.
- Evidência/referência: `DESIGN.md`, Tokens — Spacing & Shapes e Components.
- Alternativas consideradas: manter raios Tailwind heterogêneos ou promover apenas um raio universal. Ambas reduzem a hierarquia visual da referência.
- Decisão aprovada por: solicitação de redesign global baseada nas regras e design, 2026-08-20.
- Data e versão: 2026-08-20, Design Contract 1.2.0.
- Tokens/componentes/páginas impactados: aliases `--radius-control`, `--radius-card`, `--radius-panel`, Button, Card, controls e overlays.
- Migração e rollback: aliases evitam troca de API; a reversão é centralizada em `globals.css`.
