# Estabilização Arquitetural 1.0

**Estado:** auditoria e governança — sem mudança de comportamento
**Data:** 2026-09-14
**Escopo:** AncoraHub em operação

## Objetivo

Recuperar previsibilidade antes de novas refatorações: para cada comportamento
importante deve ser possível apontar o gatilho, a validação, a política, o executor,
a persistência, os eventos e os consumidores.

## Regras de segurança da fase

1. Nenhum arquivo de produção é movido ou reescrito por estética.
2. Nenhuma regra de negócio é alterada sem decisão registrada e teste de regressão.
3. Toda mudança posterior deve ser pequena, reversível e isolada em um commit.
4. Toda query/mutação continua derivando tenant, papel, unidade e carteira da sessão.
5. Antes de cada onda: `git status`, contexto do agente, testes direcionados e plano de rollback.
6. Antes de publicar: type-check, testes, build, `git diff --check` e revisão do diff.

## Inventário verificado

- 342 arquivos em `src/app` e 526 em `src/features` (inventário por `rg --files`).
- 65 rotas em `src/app/api`.
- Grafo `graphify-out/graph.json`: 12.910 nós, 37.555 relações e 467 comunidades, gerado no commit `b83178f` em 2026-09-14.
- O grafo `.ua/knowledge-graph.json` continua sendo a base documental anterior; decisões estruturais devem usar o grafo `graphify-out` atualizado e excluir o ruído de ferramentas.
- O mapa existente em `docs/architecture/AUTHORITY_MAP.md` já registra conflitos críticos de distribuição, RBAC, pipeline e integrações.

## Fontes canônicas atuais (com confiança)

| Domínio | Fonte principal | Situação |
|---|---|---|
| Autorização e escopo | `src/shared/auth/tenant-context.ts`, `src/shared/auth/authorization-service.ts` | Fundação canônica; muitos consumidores ainda usam verificações literais |
| Distribuição | `src/features/lead-distribution/service.ts` e `jobs.ts` | Motor de filas/ranking; `src/features/leads/assignment.ts` ainda é caminho paralelo |
| Status do lead | `src/features/leads/change-lead-status.ts` e `lead-status-constants.ts` | Executor convergente; UI ainda possui estado local de Kanban |
| Conversas Meta | `src/features/communication-channels/` | Canal oficial e outbox |
| WAHA | `services/whatsapp-api` e `src/features/broker-workspace/` | Canal separado; não misturar com Meta |
| Métricas | `src/features/reports/metrics/` | Resolutores server-side e escopo por papel |
| Auditoria | `schema.auditLogs` e eventos de domínio | Obrigatória para permissões, PII, exportações e distribuição |

## Riscos prioritários antes de refatorar

### P0 — bloquear mudança ampla

- Falha de isolamento de tenant ou escopo em qualquer ação.
- Dois executores atribuindo o mesmo lead sem idempotência/lock.
- Envio de WhatsApp sem outbox, idempotência ou rastreabilidade.

### P1 — corrigir em ondas controladas

- Unificar os caminhos `leads/assignment.ts` e `lead-distribution/service.ts`.
- Substituir checagens literais de papel por capabilities sem remover o fallback até medir cobertura.
- Atualizar o resolvedor de escopo para vínculos de gestor em múltiplas unidades.
- Alinhar `runSlaSweep` e `runFeedbackSlaSweep` com uma única política documentada.

### P2 — depois da estabilização

- Remover estado de pipeline duplicado no `localStorage`.
- Consolidar telas legadas e componentes repetidos.
- Reduzir consultas redundantes do dashboard e relatórios.

## Fluxos que devem ser rastreados

1. Criação de lead: webhook/ação → validação → unidade/fila → distribuição → outbox → mensagem.
2. Redistribuição: SLA → lock/idempotência → próximo elegível → evento → notificação.
3. Mensagem: entrada → autorização de conversa → canal → outbox → provedor → status.
4. Status: ação → `changeLeadStatus` → transação → auditoria → consumidores/realtime.
5. Dashboard: período/escopo da sessão → resolutor de métricas → agregação → drill-down.

## Processo seguro para as próximas ondas

### Onda 0 — cartografia (somente leitura)

Atualizar o grafo `.ua`, inventariar rotas, actions, jobs, webhooks, tabelas e integrações.
Entregáveis: `SYSTEM_MAP`, `DOMAIN_MAP`, `ROUTE_MAP`, `BACKGROUND_JOBS`,
`INTEGRATIONS_MAP`, `DATA_OWNERSHIP`, `LEGACY_MAP` e `RISK_MAP`.

### Onda 1 — autoridade

Para cada conflito, escolher uma fonte canônica, adicionar teste de contrato e registrar
uma decisão. Nenhuma implementação paralela é removida nessa onda.

### Onda 2 — convergência de distribuição

Criar um adaptador único para criação, importação, webhook, reatribuição e SLA.
Manter feature flag, métricas de divergência e rollback para o executor anterior.

### Onda 3 — autorização e escopo

Migrar uma família de actions por vez para capability + escopo resolvido no servidor.
Comparar decisões antiga/nova em modo sombra antes de tornar a nova obrigatória.

### Onda 4 — limpeza

Somente após duas ondas sem divergência crítica: depreciar caminhos legados, remover
duplicações e atualizar a documentação de rotas/componentes.

## Checklist obrigatório por mudança

- [ ] Regra e fonte canônica identificadas.
- [ ] Tenant, papel, unidade e carteira derivados no servidor.
- [ ] Estado de concorrência/idempotência definido.
- [ ] Auditoria e observabilidade definidas sem PII desnecessária.
- [ ] Teste de autorização, caso feliz, conflito e retry.
- [ ] Rollback descrito e reversível.
- [ ] `npm run agent:verify -- --level full` registrado antes do merge.

## Estado das perguntas de autoridade

| Pergunta | Estado |
|---|---|
| Onde mudar a distribuição? | Ainda fragmentado; priorizar `lead-distribution/service.ts` como alvo |
| Onde mudar autorização? | Fundação existe, adoção parcial |
| Onde mudar status? | `changeLeadStatus` |
| Onde rastrear WhatsApp? | Outbox + serviço do canal correspondente |
| Quais jobs executam fora do request? | SLA, reminders, qualification timeout, distribution processor e outbox |

## Critério de saída

`SAFE_TO_START_REFACTOR = NO` até a Onda 0 atualizar o grafo e fechar as decisões
P0/P1. Depois, cada domínio pode receber uma migração independente com teste e rollback.
