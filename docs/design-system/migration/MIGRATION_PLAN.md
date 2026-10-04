# Plano de Migração Progressiva

**Branch:** `redesign`
**Fonte de verdade:** `DESIGN_CONTRACT.md`, `.agent/design-migration.json` e `.agent/pattern-registry.json`
**Regra:** preservar comportamento, dados, tenant, RBAC, auditoria e contratos de feature.

## Wave 0 — Componentes gerais e patterns transversais

| Item | Decisão |
|---|---|
| Rotas | Nenhuma; camada compartilhada. |
| Pattern alvo | foundations + primitives + patterns reutilizáveis. |
| Componentes canônicos | Button, Card, Input, Textarea, Field, EmptyState, PageHeader, FilterToolbar, FormSection. |
| Legado | estilos locais equivalentes, headers e toolbars co-localizados. |
| Risco | Médio visual; baixo funcional. |
| Dependências | DG-009/010/011 documentados; review visual pendente. |
| Aceite | API acessível, estados testados, nenhum acesso a dados, tokens runtime sem valores de cor crus e docs sincronizados. |
| Rollback | reverter apenas os arquivos compartilhados desta wave. |

### UX decision layer

Objetivo: tornar contexto, ação primária, filtros, seções de formulário e estados reutilizáveis sem duplicar decisões de UX em cada feature. As superfícies não recebem uma nova regra de negócio, não adicionam dados e não incluem ação sem consequência.

## Waves de rotas

| Wave | Rotas | Blueprint | Risco / dependência | Rollback |
|---|---|---|---|---|
| 1 | `/conversas` | CHAT_PAGE + CRM_PAGE | Alto; depende da Wave 0 e QA de chat/atendimento. | Reverter componentes da rota sem tocar serviços. |
| 2 | `/leads` | LIST_PAGE + KANBAN_PAGE | Alto; tabela, filtros, seleção e distribuição. | Reverter composição visual; preservar queries/URL. |
| 3 | `/leads/[id]`, `/clientes/[clientId]` | DETAIL_PAGE + CRM_PAGE | Alto; permissões, timeline e ações contextuais. | Reverter componentes de detalhe. |
| 4 | `/dashboard`, `/diretor/resume`, `/gestor` | DASHBOARD_PAGE + ANALYTICS_PAGE | Médio; métricas devem manter origem e escopo. | Reverter composição. |
| 5 | `/tarefas` e próximas ações | LIST_PAGE | Médio; ações em massa e SLA. | Reverter UI somente. |
| 6 | equipe, ranking e plantões | LIST_PAGE + ANALYTICS_PAGE | Médio; filtros por papel/unidade. | Reverter UI somente. |
| 7 | configurações e `/qualificacao` | SETTINGS_PAGE + FORM_PAGE | Médio; feedback de salvamento e feature flags. | Reverter UI somente. |
| 8 | Super Admin e rotas secundárias | SETTINGS_PAGE + DETAIL_PAGE | Alto; governança de plataforma. | Reverter UI somente. |
| 9 | exceções e limpeza | blueprint aplicável | Baixo/médio; remover legado sem consumidores. | Reintroduzir compatibilidade se necessário. |

## Seleção inicial

`/conversas` é a primeira rota operacional prioritária, mas permanece **BLOCKED** até a Wave 0 produzir componentes revisados e sua verificação visual/funcional. Não há Big Bang: cada wave avança de `PLANNED` para `MIGRATING`, `VERIFYING` e somente então `COMPLETED`.
