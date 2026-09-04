# Matriz de Migração de Autorização (Authorization Migration Matrix)

Este documento registra o status de migração dos consumers da aplicação para o modelo canônico de autorização (`AuthorizationService`, `buildLeadResourceScope`, `buildClientResourceScope`, `buildLeadScopeWhere`, `buildClientScopeWhere`, `setManagerBranchesAuthorized`, `requireCanUpdateMemberAuthority`).

## Status dos Consumers

| ID | Consumer / Localização | Domínio | Operação | Risco | Modo Atual | Status Equivalência | Observações |
|---|---|---|---|---|---|---|---|
| C-01 | `src/features/leads/queries.ts:getLeadTimeline` | Leads | READ (Single) | MEDIUM | CANONICAL (Enforced) | EQUIVALENTE | Avalia Shadow Mode e aplica `AuthorizationService.can(context, "acessar_leads", resourceScope)`. |
| C-02 | `src/features/leads/actions.ts:addLeadNoteAction` | Leads | WRITE (Interaction) | MEDIUM | CANONICAL (Enforced) | EQUIVALENTE | Validação canônica de posse/filial antes de criar interação e notificar. |
| C-03 | `src/features/leads/actions.ts:updateLeadLivesCountAction` | Leads | WRITE (Cadastral) | LOW | CANONICAL (Enforced) | EQUIVALENTE | Atualização de vidas com verificação canônica via `buildLeadResourceScope`. |
| C-04 | `src/app/(dashboard)/leads/[id]/page.tsx:LeadDetailPage` | Leads | READ (Single Page) | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Query scoped com `buildLeadScopeWhere(context)` protegendo contra IDOR. |
| C-05 | `src/app/(dashboard)/leads/page.tsx:LeadsPageContent` | Leads | LIST / SEARCH / COUNT | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Filtros dinâmicos tablecn e filtros rápidos usam `buildLeadScopeWhere(context, { requestedBranchId })`. |
| C-06 | `src/app/(dashboard)/clientes/page.tsx:CustomersPage` | Clientes | LIST / METRICS | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Todas as queries de clientes, renovações e corretores utilizam `buildClientScopeWhere(context, { requestedBranchId })`. |
| C-07 | `src/app/(dashboard)/clientes/[clientId]/page.tsx:ClientDetailPage` | Clientes | READ (Single Page) | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Query de detalhe de cliente usa `buildClientScopeWhere(context)`. |
| C-08 | `src/features/custom-roles/queries.ts` | Custom Roles | ADMIN / READ | MEDIUM | CANONICAL (Fase 1A) | EQUIVALENTE | Piloto da Fase 1A mantido íntegro. |
| C-09 | `src/features/lead-distribution/service.ts` | Distribuição | MOTOR / ALGORITMO | CRITICAL | LEGACY (Pendente Fase 2) | NÃO TOCADO | Motor preservado intencionalmente; autorização de borda protegida na Fase 1C. |
| C-10 | `src/features/browser-extension/lead-context.ts` | Extensão | READ (Broker-only) | LOW | DEDICATED BROKER | CONFORME | Regra estrita de corretor para extensão de navegador. |
| C-11 | `src/features/team/manager-branches-service.ts:setManagerBranchesAuthorized` | Team / Scope | WRITE (Scope Admin) | CRITICAL | CANONICAL (Enforced) | EQUIVALENTE | Validação rigorosa contra auto-escalonamento, cross-tenant e scope escalation multi-unit. |
| C-12 | `src/shared/auth/team-permissions.ts:requireCanUpdateMemberAuthority` | Team / Roles | WRITE (Role Admin) | CRITICAL | CANONICAL (Enforced) | EQUIVALENTE | Proteção contra Privilege Escalation (Manager -> Director) e Scope Escalation. |
| C-13 | `src/app/(dashboard)/equipe/actions.ts:updateTeamMemberAction` | Team / Roles | WRITE (Member Update) | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Enforce via `requireCanUpdateMemberAuthority`. |
| C-14 | `src/app/(dashboard)/equipe/actions.ts:bulkToggleTeamMemberStatusAction` | Team / Bulk | WRITE (Bulk Status) | HIGH | CANONICAL (Enforced) | ATOMIC_DENY | Validação atômica de pré-condições em lote; nega lote inteiro se houver membro fora de escopo. |
| C-15 | `src/app/(dashboard)/equipe/actions.ts:transferLeadsAction` | Team / Bulk | WRITE (Bulk Reassign) | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Actor + Resource + Target com mutation SQL restrita ao escopo de filiais autorizadas. |
| C-16 | `src/features/leads/management-actions.ts:reassignLeadAction` | Leads / Ownership | WRITE (Manual Reassign) | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Avalia Shadow Mode, Actor/Resource/Target e suporte a Gestores multi-unidade. |
| C-17 | `src/app/(dashboard)/leads/actions.ts:deleteLeadAction` | Leads / Delete | WRITE (Soft Delete) | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Delete seguro com escopo atômico de tenant e avaliação de shadow mode. |
| C-18 | `src/features/lead-distribution/actions.ts:saveDistributionPolicyAction` | Distribuição / Config | WRITE (Policy Admin) | HIGH | CANONICAL (Enforced) | EQUIVALENTE | Autorização central de quem pode alterar regras de distribuição sem tocar no motor. |

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

## Semântica de Operações em Lote (Bulk Mutations)

1. **`bulkToggleTeamMemberStatusAction`**: Implementa a semântica `ATOMIC_DENY`. Todo o array de `memberIds` é validado previamente quanto ao pertencimento ao tenant e autoridade do ator. Se qualquer membro falhar, a operação é rejeitada integralmente sem efeitos parciais.
2. **`transferLeadsAction`**: Valida previamente Ator, Usuário Origem e Usuário Destino. Executa a mutação no banco de dados com filtro atômico (`tenantId`, `fromUserId`, e `source.branchId`), impedindo mutações acidentais cross-filial.
