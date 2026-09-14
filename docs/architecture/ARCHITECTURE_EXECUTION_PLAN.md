# Plano de Execução Arquitetural 1.0

**Objetivo:** transformar o inventário do sistema em uma forma segura de decidir,
alterar e publicar mudanças.
**Baseline:** grafo `graphify-out/graph.json` atualizado em 2026-09-14 com exclusão de `.agents/`, `.github/` e `node_modules/`.
**Princípio:** uma regra, um dono, uma fonte canônica, consumidores rastreáveis.

## 1. Leitura do estado atual

O grafo encontrou 12.910 nós, 37.555 relações e 473 comunidades. Os hubs mais
importantes são `db/schema.ts`, `tenant-context.ts`, `getRequiredTenantContext`,
`leads/[id]/page.tsx`, `leads-workspace.tsx`, `create-lead-from-webhook-sync.ts`,
`outbound-service.ts`, `lead-distribution/service.ts`, `lead-distribution/jobs.ts`,
`change-lead-status.ts` e `metrics-service.ts`.

O grafo de produto foi reprocessado excluindo `.agents/`, `.github/` e `node_modules/`.
Os nomes das comunidades ainda são derivados dos hubs (não há backend LLM configurado),
mas a topologia e as relações são determinísticas e utilizáveis para a auditoria.

## 2. Estrutura de autoridade aprovada para investigação

| Domínio | Root de investigação | Consumidores que devem convergir |
|---|---|---|
| Autorização | `src/shared/auth/tenant-context.ts` + `authorization-service.ts` | layouts, actions, APIs e jobs |
| Leads/pipeline | `src/features/leads/change-lead-status.ts` | tabela, Kanban, conversas e relatórios |
| Distribuição | `src/features/lead-distribution/service.ts` + `jobs.ts` | intake, reatribuição, SLA e ofertas |
| Conversas | `src/features/communication-channels/` | inbox, outbox e Meta |
| WAHA | `services/whatsapp-api` + broker workspace | somente canal alternativo |
| Métricas | `src/features/reports/metrics/` | dashboard, relatórios e exportações |
| Auditoria | `schema.auditLogs` + eventos de domínio | todas as mutações sensíveis |

Esses roots são pontos de partida de auditoria, não autorização para mover ou apagar
arquivos. Qualquer divergência deve ser registrada na matriz antes da migração.

## 3. Ondas de trabalho

### O0 — Cartografia reprodutível (somente leitura)

**Entregas:** atualizar grafo com exclusões de ferramentas; consolidar `SYSTEM_MAP`,
`DOMAIN_MAP`, `ROUTE_MAP`, `BACKGROUND_JOBS`, `INTEGRATIONS_MAP`, `DATA_OWNERSHIP`,
`LEGACY_MAP` e `RISK_MAP`.

**Gate:** cada rota, job, webhook e integração possui entrada, escopo, fonte de dados,
efeitos e link para código. Nenhuma decisão de refatoração ainda.

### O1 — Contratos e autoridade

Para cada conflito, registrar: comportamento esperado, root escolhido, consumidores,
invariantes, estados de erro e teste de contrato. Ativar logs de modo sombra quando
duas implementações ainda precisarem coexistir.

**Gate:** `AUTHORITY_MATRIX` sem conflito P0 sem proprietário e cada P1 com decisão,
teste e rollback.

### O2 — Distribuição de leads

Convergir criação manual, CSV, Meta/webhooks, qualificação, reatribuição e SLA no
motor de distribuição. Preservar a entrada antiga atrás de feature flag durante a
comparação. Medir: duplicidade, lead sem corretor, fairness por corretor, latência de
oferta, expiração e divergência entre paths.

**Rollback:** desligar o executor novo, reprocessar apenas jobs idempotentes e manter
eventos/auditoria para reconstrução.

### O3 — Autorização e múltiplas unidades

Migrar actions por família para capability + escopo derivado no servidor. Validar
diretor, gestor, supervisor e corretor em testes de allow/deny/cross-tenant. Resolver
explicitamente a relação `tenant_manager_branches` antes de ampliar o escopo de gestor.

**Gate:** modo sombra sem decisões divergentes críticas por uma janela operacional.

### O4 — Dados, pipeline e integrações

Consolidar status/transições, ownership de conversas, outbox Meta/WAHA e métricas.
Eliminar estado local apenas depois de garantir persistência e migração reversível.

### O5 — Limpeza controlada

Depreciar caminhos legados somente com evidência de ausência de tráfego, substituto
canônico, changelog e plano de retorno. Remoções são commits isolados.

## 4. Protocolo para cada mudança futura

1. Abrir uma ficha de mudança com objetivo, domínio, root e risco.
2. Rodar `git status` e preservar alterações existentes.
3. Atualizar regra/decisão documental antes do código.
4. Implementar em branch `codex/<dominio>-<mudanca>` com um objetivo único.
5. Adicionar testes de contrato, autorização, tenant, conflito, retry e estado vazio.
6. Validar type-check, testes direcionados, build e `git diff --check`.
7. Executar `npm run agent:verify -- --level full` e guardar a evidência.
8. Fazer revisão do diff e publicar somente após aprovação explícita.
9. Atualizar grafo após merge e registrar o commit de produção.

## 5. Registro mínimo de decisão

```text
DEC-ID:
Domínio / Root:
Problema observado:
Decisão:
Alternativas rejeitadas:
Invariantes preservados:
Dados e tenant afetados:
Auditoria/observabilidade:
Testes:
Feature flag:
Rollback:
Owner:
```

## 6. Métricas de confiança

- **Integridade:** zero eventos cross-tenant; zero mutações sem auditoria.
- **Distribuição:** zero lead elegível sem unidade/corretor; nenhuma duplicidade de oferta.
- **Entrega:** p95 do primeiro efeito WhatsApp e taxa de falha por canal.
- **Autorização:** decisões shadow divergentes e tentativas negadas por escopo.
- **Operação:** p95 das rotas críticas e tempo de atualização de dashboard.
- **Mudança:** cobertura de contrato, tempo de rollback e incidentes pós-release.

Toda métrica precisa de nome, query/resolvedor server-side, escopo autorizado e destino
de investigação. Métrica sem esses quatro itens é dívida, não indicador de sucesso.

## 7. Priorização inicial

| Prioridade | Trabalho | Motivo |
|---|---|---|
| P0 | Isolamento tenant, autorização e auditoria | evita exposição e corrupção de dados |
| P1 | Motor único de distribuição + idempotência | evita leads órfãos, duplicados e conflitos |
| P1 | Mapa de jobs/outbox/webhooks | torna efeitos assíncronos rastreáveis |
| P1 | Escopo de gestores em múltiplas unidades | evita dados invisíveis ou acessos indevidos |
| P2 | Pipeline e estado local | reduz divergência visual |
| P2 | Performance de dashboard/relatórios | melhora operação após a autoridade estar definida |
| P3 | Limpeza de arquivos e telas legadas | só depois da prova de substituição |

## 8. Critério final de confiança

Só iniciar uma refatoração quando for possível responder, com links e testes:

- qual root decidiu;
- qual autorização permitiu;
- qual transação persistiu;
- qual evento foi emitido;
- qual worker/consumer executou efeitos;
- como medir a mudança;
- como desfazer sem perder dados.

**SAFE_TO_START_REFACTOR:** `NO` para big-bang; `YES` apenas para ondas isoladas que
passarem os gates acima.
