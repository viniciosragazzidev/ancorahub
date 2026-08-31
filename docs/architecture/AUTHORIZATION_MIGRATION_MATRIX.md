# Matriz de Migração de Autorização (Authorization Migration Matrix)

Este documento registra o status de migração dos consumers da aplicação para o modelo canônico de autorização (`AuthorizationService`, `buildLeadResourceScope`, `buildClientResourceScope`, `buildLeadScopeWhere`, `buildClientScopeWhere`).

## Status dos Consumers

| ID | Consumer / Localização | Domínio | Operação | Modo Atual | Status Equivalência | Observações |
|---|---|---|---|---|---|---|
| C-01 | `src/features/leads/queries.ts:getLeadTimeline` | Leads | READ (Single) | CANONICAL (Enforced) | EQUIVALENTE | Avalia Shadow Mode e aplica `AuthorizationService.can(context, "acessar_leads", resourceScope)`. |
| C-02 | `src/features/leads/actions.ts:addLeadNoteAction` | Leads | WRITE (Interaction) | CANONICAL (Enforced) | EQUIVALENTE | Validação canônica de posse/filial antes de criar interação e notificar. |
| C-03 | `src/features/leads/actions.ts:updateLeadLivesCountAction` | Leads | WRITE (Cadastral) | CANONICAL (Enforced) | EQUIVALENTE | Atualização de vidas com verificação canônica via `buildLeadResourceScope`. |
| C-04 | `src/app/(dashboard)/leads/[id]/page.tsx:LeadDetailPage` | Leads | READ (Single Page) | CANONICAL (Enforced) | EQUIVALENTE | Query scoped com `buildLeadScopeWhere(context)` protegendo contra IDOR. |
| C-05 | `src/app/(dashboard)/leads/page.tsx:LeadsPageContent` | Leads | LIST / SEARCH / COUNT | CANONICAL (Enforced) | EQUIVALENTE | Filtros dinâmicos tablecn e filtros rápidos usam `buildLeadScopeWhere(context, { requestedBranchId })`. |
| C-06 | `src/app/(dashboard)/clientes/page.tsx:CustomersPage` | Clientes | LIST / METRICS | CANONICAL (Enforced) | EQUIVALENTE | Todas as queries de clientes, renovações e corretores utilizam `buildClientScopeWhere(context, { requestedBranchId })`. |
| C-07 | `src/app/(dashboard)/clientes/[clientId]/page.tsx:ClientDetailPage` | Clientes | READ (Single Page) | CANONICAL (Enforced) | EQUIVALENTE | Query de detalhe de cliente usa `buildClientScopeWhere(context)`. |
| C-08 | `src/features/custom-roles/queries.ts` | Custom Roles | ADMIN / READ | CANONICAL (Fase 1A) | EQUIVALENTE | Piloto da Fase 1A mantido íntegro. |
| C-09 | `src/features/leads/distribution/` | Distribuição | QUEUE / SLA | LEGACY (Pendente Fase 2) | NÃO TOCADO | Preservado intencionalmente conforme restrições de arquitetura. |
| C-10 | `src/features/browser-extension/lead-context.ts` | Extensão | READ (Broker-only) | DEDICATED BROKER | CONFORME | Regra estrita de corretor para extensão de navegador. |

---

## Classificação de Mismatches (Shadow Mode)

Quando o shadow mode está ativo (`feature_auth_shadow_mode` ou `AUTH_SHADOW_MODE=true`), as divergências entre a decisão legada e a decisão canônica são classificadas nas seguintes categorias:

1. **`LEGACY_TOO_PERMISSIVE`**: O código legado permitia a ação onde a regra de governança canônica restringe (ex: tentativa de acesso entre filiais sem permissão explícita).
2. **`LEGACY_TOO_RESTRICTIVE`**: O código legado negava a ação onde o modelo canônico flexibiliza legitimamente (ex: gestor multiunidade com acesso concedido via `tenant_manager_branches`).
3. **`SCOPE_MODEL_GAP`**: Diferença na interpretação de titularidade de unidade ou time.
4. **`CUSTOM_ROLE_GAP`**: Papel customizado com capabilities granulares que o código legado com checks baseados em `role === "broker"` não suportava.
5. **`QUERY_SCOPE_GAP`**: Divergência na cláusula `WHERE` SQL gerada.
6. **`UNKNOWN_BUSINESS_RULE`**: Caso não categorizado a ser auditado.

---

## Diretrizes de Expansão para as Próximas Fases

1. **Fase 2 (Distribuição e Filas)**:
   - Migrar `src/features/leads/distribution/` apenas após definição formal dos contratos de auto-atribuição e regras de SLA.
2. **Auditoria e Logs**:
   - Manter logs estruturados sem PII em qualquer shadow mismatch.
