# Regras de Componentes

## Taxonomia

- **Primitive:** Button, Input, Select, Checkbox, Card, Badge, Dialog, Tooltip.
- **Composite:** FormField, FilterBar, DataTableToolbar, EmptyState.
- **Pattern:** List, Detail, Dashboard, Settings, Form, Empty, Wizard.
- **Feature:** componente ligado a lead, campanha, conversa ou papel. Feature compõe o design system; não o redefine.

## Regras globais

| ID | Regra |
|---|---|
| CR-001 | Reutilize primitive existente antes de criar markup de controle local. |
| CR-002 | Uma variante nova exige propósito, estados e documentação no primitive compartilhado. |
| CR-003 | Não use cor, raio, sombra, tipografia ou spacing arbitrário quando existir token. |
| CR-004 | Componentes interativos precisam de default, hover, focus-visible, disabled, loading e erro quando aplicável. |
| CR-005 | Todo controle deve ter nome acessível, teclado e consequência real. |
| CR-006 | A cor não é o único sinal de seleção, erro, sucesso ou indisponibilidade. |
| CR-007 | Feature não cria sua própria versão de Button, Input, Card, tabela ou feedback. |
| CR-008 | Conteúdo e estado pertencem à feature; anatomia e comportamento visual pertencem ao primitive. |
| CR-009 | Motion é opcional, curto, reversível e desativável por reduced motion. |
| CR-010 | Se o componente não estiver especificado, registrar gap antes de institucionalizá-lo. |

## Componentes da referência

O botão preenchido escuro, secundário escuro, outline link e cards documentados em `design.md` são **CONFIRMED como referência visual**. Variantes destrutiva, sucesso, formulário, tabela, overlay e feedback são **MISSING**; não devem ser inventadas a partir das cores decorativas.
