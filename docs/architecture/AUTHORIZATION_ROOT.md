# Canonical Authorization & Multi-Scope Foundation (Fases 1A, 1B & 1C)

## 1. Visão Geral

Este documento formaliza a arquitetura canônica de **Autorização, RBAC e Escopo Multi-Unidade** do CRM ÂncoraHub (CorreTop), estabelecendo a separação definitiva entre:
- **Papel (ROLE)**: "O que o usuário pode fazer" (Capacidades / Permissões).
- **Escopo (SCOPE)**: "Onde / Em quais recursos o usuário pode atuar" (Tenant-wide, Unidades autorizadas, Próprio recurso).

---

## 2. Invariantes Arquiteturais (Absolute Invariants - ROOT_ONLY)

1. **Isolamento Multi-Tenant Estrito**:
   - `resource.tenantId !== context.tenantId` resulta em **DENY** absoluto e imediato (`TENANT_MISMATCH`). Não existem exceções ou overrides entre tenants.
2. **Fail-Closed**:
   - Se o escopo do usuário for vazio, indefinido ou o contexto estiver inconsistente, a autorização sempre nega (`SCOPE_EMPTY` ou `ACCESS_DENIED`).
3. **Resolução de Multiunidades no Servidor**:
   - Gestores vinculados a múltiplas filiais via `tenant_manager_branches` têm seu escopo consolidado pelo resolver central (`resolveAccessContext`).
   - Injeções forjadas ou vínculos cruzados com filiais de outros tenants são descartados na query com INNER JOIN validando `branches.tenantId = context.tenantId`.
4. **Independência de Capacidade e Escopo**:
   - Possuir a capacidade (ex: `acessar_leads`, `acessar_clientes`) sem o escopo correspondente resulta em `UNIT_OUT_OF_SCOPE` ou `NOT_RESOURCE_OWNER`.
   - Estar no escopo sem a capacidade resulta em `MISSING_CAPABILITY`.
5. **Server-Side Query Scoping**:
   - As queries em lote (List, Search, Count, Paginação) aplicam scoping diretamente no SQL usando `buildLeadScopeWhere` e `buildClientScopeWhere`. Nunca filtram arrays na memória da aplicação pós-SELECT.

---

## 3. Modelo de Dados e Tipos Canônicos

### `AccessScope`
```typescript
export interface AccessScope {
  tenantWide: boolean;
  unitIds: readonly string[];
  teamIds: readonly string[];
  ownership: "ANY" | "SCOPED" | "SELF" | "NONE";
  provenance: {
    units: ScopeProvenance;
    teams?: ScopeProvenance;
  };
}
```

### `ScopeProvenance`
- `TENANT_WIDE`: Diretores ou cargos com alcance global no tenant.
- `TENANT_MANAGER_BRANCHES`: Gestores multiunidade com registros em `tenant_manager_branches`.
- `LEGACY_MEMBERSHIP_BRANCH`: Fallback temporário para gestores com apenas `branchId` na membership.
- `CUSTOM_ROLE_SCOPE`: Cargos personalizados com escopo explícito (`tenant` ou `branch`).
- `SELF_BROKER`: Corretores com titularidade própria.
- `EMPTY_FALLBACK`: Usuário sem unidades ativas (Fail-Closed).

---

## 4. `AuthorizationService` (Autoridade Central)

O `AuthorizationService` disponibiliza 4 métodos canônicos:

1. **`AuthorizationService.evaluate(context, capability, resource?, options?): AuthorizationDecision`**
   - Retorna um objeto estruturado `{ allowed: boolean, reason?: AuthorizationDenyReason, matchedScope?: string }`.
2. **`AuthorizationService.can(context, capability, resource?, options?): boolean`**
   - Retorna um booleano simples para renderização condicional ou branching seguro.
3. **`AuthorizationService.require(context, capability, resource?, options?): void`**
   - Lança `AuthorizationError` com código semântico se negado.
4. **`AuthorizationService.getQueryScopeConstraints(context): QueryScopeConstraints`**
   - Helper puro que retorna descritores estruturais para aplicar filtros em queries SQL/Drizzle sem lógica ad-hoc.

---

## 5. Privilege Escalation Protection

A governança canônica impede que qualquer ator conceda privilégios superiores ou transversais à sua própria autoridade:
- **Papel Alvo**: Um Gestor só pode criar/gerenciar Supervisores ou Corretores (`canCreateRole`, `requireCanUpdateMemberAuthority`). Não pode promover ninguém a Diretor ou Gestor.
- **Auto-Escalonamento**: Usuários não podem alterar o próprio papel, filiais administradas ou custom roles para ampliar seus próprios acessos.
- **Escopo Custom Role**: Cargos personalizados com escopo em todo o tenant (`customRoleScope = "tenant"`) só podem ser atribuídos por Diretores (`requireCanUpdateMemberAuthority`).
- **Scope Escalation**: Gestores não podem mover membros ou atribuir filiais que não estejam no seu `allowedUnitIds`.

---

## 6. Actor / Resource / Target Authorization

Operações que transferem titularidade de recursos exigem validação da tríade **Actor + Resource + Target**:
1. **Ator**: Possui permissão (`leads_reassign` ou Diretor / Gestor autorizado)?
2. **Recurso**: O lead/cliente pertence ao tenant e a uma filial autorizada para o ator?
3. **Destinatário**: O usuário de destino (corretor) pertence ao mesmo tenant, está ativo e vinculado à filial compatível do recurso?

Implementado canonicamente em:
- `reassignLeadAction` ([`src/features/leads/management-actions.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/leads/management-actions.ts))
- `transferLeadsAction` ([`src/app/(dashboard)/equipe/actions.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/app/%28dashboard%29/equipe/actions.ts))

---

## 7. Multi-Unit Scope Administration

A escrita na tabela `tenant_manager_branches` é controlada pelo serviço canônico:
- **`setManagerBranchesAuthorized`** ([`src/features/team/manager-branches-service.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/team/manager-branches-service.ts))
- Garante interseção estrita: `requestedUnits ∩ tenantBranches ∩ actorAllowedUnits`.
- Rejeita qualquer tentativa de vincular unidades inexistentes, inativas, cross-tenant ou fora da autoridade do gestor que executa a ação.

---

## 8. Bulk Mutation Authorization

Operações em lote aplicam regras determinísticas para evitar mutações parciais ou desautorizadas:
- **`ATOMIC_DENY`**: Em `bulkToggleTeamMemberStatusAction`, todos os IDs fornecidos no lote passam por pré-validação atômica server-side. Se qualquer ID for de outro tenant ou estiver fora do escopo do gestor, a operação inteira é abortada com erro amigável sem mutações parciais.
- **Scoped Mutation SQL**: Em `transferLeadsAction`, a mutação no banco de dados inclui cláusula `WHERE` explícita por `tenant_id` e `branch_id`, prevenindo TOCTOU e atualizações indevidas.

---

## 9. Authorization Readiness Gate

| Gate | Requisito | Status | Evidência |
|---|---|---|---|
| **GATE-A** | Isolamento multi-tenant canônico em leitura e escrita | **PASS** | Suíte de testes cross-tenant em Leads, Clientes, Equipe e Distribuição com 0 falhas |
| **GATE-B** | Gestor multi-unidade validado em leitura e escrita | **PASS** | `setManagerBranchesAuthorized`, `canManageMember` e queries de listagem cobrindo gestores A+B |
| **GATE-C** | Custom roles com capability + scope | **PASS** | Testes de RBAC canônico com escopo `tenant` vs `branch` |
| **GATE-D** | IDOR em mutations críticas coberto | **PASS** | `reassignLeadAction`, `deleteLeadAction`, `transferLeadsAction` e `bulkToggle` protegidos |
| **GATE-E** | Administração de scope protegida contra escalonamento | **PASS** | `setManagerBranchesAuthorized` impede auto-atribuição e unidades fora de escopo |
| **GATE-F** | Alteração de role/custom role protegida contra escalation | **PASS** | `requireCanUpdateMemberAuthority` impede promoção indevida |
| **GATE-G** | Query scoping em Lead e Cliente operacional | **PASS** | `buildLeadScopeWhere` e `buildClientScopeWhere` ativos nas páginas principais |
| **GATE-H** | Nenhum caminho CRITICAL com bypass de autorização | **PASS** | Ações críticas de equipe, ownership e delete migradas para canônico |
| **GATE-I** | Configurações de Distribuição com autorização central | **PASS** | `saveDistributionPolicyAction` e `assertManager` protegidos sem alterar o motor |
| **GATE-J** | Shadow mismatches classificados | **PASS** | `shadow-mode.ts` com tipagem formal de divergências |

**Decisão Final do Gate**: `AUTHORIZATION_READY_FOR_DISTRIBUTION = YES`
