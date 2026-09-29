# UX-M1 — Matriz de preservação funcional mobile

**Estado:** implementação concluída no código; QA visual/interacional autenticado pendente.

`CODE_READY` significa que a composição responsiva existe e passou validação estática.
Somente M1.10 pode promover uma linha para `PRESERVED`.

| Route | Feature | Desktop location | Mobile location/pattern | Status |
|---|---|---|---|---|
| `/dashboard` | período e escopo | toolbar | header compacto / disclosure contextual | `CODE_READY` |
| `/dashboard` | KPIs e alertas | grids | prioridade + lista acionável | `CODE_READY` |
| `/dashboard` | gráficos/tabelas | painéis | conteúdo empilhado + listas semânticas | `CODE_READY` |
| Shell CRM | navegação principal | rail lateral persistente | Sheet lateral sobreposto; sem barra inferior duplicada | `CODE_READY` |
| `/leads` | busca | toolbar | input visível | `CODE_READY` |
| `/leads` | filtros | toolbar/popover | controle compacto + disclosure existente | `CODE_READY` |
| `/leads` | lista/kanban | tabela/board | lista semântica / perspectiva preservada | `CODE_READY` |
| `/leads` | ações em massa | selection toolbar | barra contextual | `CODE_READY` |
| `/leads/[id]` | resumo e status | header/painel | resumo L1 empilhado | `CODE_READY` |
| `/leads/[id]` | edição | dialog/drawer | primitive Sheet full-height abaixo de 560px | `CODE_READY` |
| `/leads/[id]` | documentos/cotação | seções/tabs | tabs touch roláveis + detalhes | `CODE_READY` |
| `/conversas` | lista | painel esquerdo | estado de tela `list` | `CODE_READY` |
| `/conversas` | chat/composer | painel central | estado de tela `chat`, sem bottom nav concorrente | `CODE_READY` |
| `/conversas` | perfil/contexto | painel direito | Sheet full-height | `CODE_READY` |
| `/tarefas` | Home de tarefas | inexistente | não criar na UX-M1 | `NOT_APPLICABLE` |
| `/clientes` | busca/lista | cards/lista | busca + lista semântica | `CODE_READY` |
| `/clientes/[clientId]` | perfil/tabs | detalhe | header + tabs touch roláveis | `CODE_READY` |
| `/equipe` | membros | tabela | lista administrativa existente | `CODE_READY` |
| `/equipe` | filtros/convite | toolbar/form | controles responsivos existentes | `CODE_READY` |
| `/vendas` | KPIs/lista | grid/tabela | resumo 2×2 + lista semântica | `CODE_READY` |
| `/vendas/[id]` | cronograma | tabela | timeline/lista semântica | `CODE_READY` |
| `/metas` | Home de metas | inexistente | dashboard/resumo pessoal | `NOT_APPLICABLE` |
| `/qualificacao` | navegação de seções | rail/tabs | tabs touch roláveis | `CODE_READY` |
| `/qualificacao` | editores | cards/dialogs | uma coluna + primitive Sheet responsivo | `CODE_READY` |
| `/settings` | seções e formulários | tabs/forms | tabs touch roláveis + uma coluna | `CODE_READY` |
| `/integrations` | catálogo/status | cards | blocos empilhados | `CODE_READY` |
| `/integrations/meta` | conexão/ativos | wizard/cards | composição empilhada | `CODE_READY` |
| `/integrations/whatsapp` | canal/templates | cards/tabela | tabs touch roláveis + blocos empilhados | `CODE_READY` |
| Corretor Lite | dashboard/fila/clientes/insights | composição Lite | dashboard clássico + menu compacto com todos os destinos | `EXCEPTION_PRESERVED_QA_PENDING` |

## Regras de atualização

Cada fase M1.2–M1.9 deve atualizar o status com evidência. Uma funcionalidade só pode
ser marcada `PRESERVED` após teste de interação; “não coube” nunca justifica remoção.
