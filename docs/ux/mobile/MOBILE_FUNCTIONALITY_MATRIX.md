# UX-M1 — Matriz de preservação funcional mobile

**Estado:** baseline da implementação. Nenhum item `PRESERVED` significa QA final.

| Route | Feature | Desktop location | Mobile location/pattern | Status |
|---|---|---|---|---|
| `/dashboard` | período e escopo | toolbar | header compacto / Sheet quando avançado | `RECOMPOSED` |
| `/dashboard` | KPIs e alertas | grids | prioridade + lista acionável | `RECOMPOSED` |
| `/dashboard` | gráficos/tabelas | painéis | conteúdo empilhado + drill-down | `CONTEXTUAL` |
| `/leads` | busca | toolbar | input visível | `PRESERVED` |
| `/leads` | filtros | toolbar/popover | Filter Sheet + contador | `MOVED_TO_SHEET` |
| `/leads` | lista/kanban | tabela/board | lista semântica / perspectiva preservada | `RECOMPOSED` |
| `/leads` | ações em massa | selection toolbar | barra contextual | `CONTEXTUAL` |
| `/leads/[id]` | resumo e status | header/painel | header compacto + L1 | `RECOMPOSED` |
| `/leads/[id]` | edição | dialog/drawer | full-height Sheet | `MOVED_TO_SHEET` |
| `/leads/[id]` | documentos/cotação | seções/tabs | tabs + detalhes | `CONTEXTUAL` |
| `/conversas` | lista | painel esquerdo | tela de lista | `RECOMPOSED` |
| `/conversas` | chat/composer | painel central | tela de chat | `RECOMPOSED` |
| `/conversas` | perfil/contexto | painel direito | full-height Sheet | `MOVED_TO_SHEET` |
| `/tarefas` | Home de tarefas | inexistente | não criar na UX-M1 | `NOT_APPLICABLE` |
| `/clientes` | busca/lista | cards/lista | lista semântica | `RECOMPOSED` |
| `/clientes/[clientId]` | perfil/tabs | detalhe | header + tabs roláveis | `RECOMPOSED` |
| `/equipe` | membros | tabela | lista administrativa | `RECOMPOSED` |
| `/equipe` | filtros/convite | toolbar/form | Sheet | `MOVED_TO_SHEET` |
| `/vendas` | KPIs/lista | grid/tabela | resumo + lista | `RECOMPOSED` |
| `/vendas/[id]` | cronograma | tabela | timeline/lista | `RECOMPOSED` |
| `/metas` | Home de metas | inexistente | dashboard/resumo pessoal | `NOT_APPLICABLE` |
| `/qualificacao` | navegação de seções | rail/tabs | seletor/tabs roláveis | `RECOMPOSED` |
| `/qualificacao` | editores | cards/dialogs | uma coluna + Sheet | `MOVED_TO_SHEET` |
| `/settings` | seções e formulários | tabs/forms | seletor + uma coluna | `RECOMPOSED` |
| `/integrations` | catálogo/status | cards | blocos empilhados | `PRESERVED` |
| `/integrations/meta` | conexão/ativos | wizard/cards | fluxo full-height | `RECOMPOSED` |
| `/integrations/whatsapp` | canal/templates | cards/tabela | estado + ação; detalhes sob demanda | `RECOMPOSED` |
| Corretor Lite | dashboard/fila/clientes/insights | composição Lite | composição clássica touch-first | `PRESERVED` |

## Regras de atualização

Cada fase M1.2–M1.9 deve atualizar o status com evidência. Uma funcionalidade só pode
ser marcada `PRESERVED` após teste de interação; “não coube” nunca justifica remoção.
