# Design Gaps

| ID | Decisão pendente | Por que importa | Impacto até resolver | Dono sugerido |
|---|---|---|---|---|
| DG-001 | Canonicalizar Snow (`#f7fafc` ou `#fafafa`) e papel de Ink/Carbon. | Evita superfícies/texto inconsistentes. | não introduzir token final novo. | Design + Produto |
| DG-002 | Definir cores semânticas e contrastes de status. | Estado operacional e acessibilidade. | usar tokens atuais do projeto; não mapear cores decorativas a status. | Design + Acessibilidade |
| DG-003 | Resolver escala de radius 10/16/20/32/100. | Consistência de primitives. | não criar variantes de raio. | Design |
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
