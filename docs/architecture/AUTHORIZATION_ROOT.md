# Canonical Authorization & Multi-Scope Foundation (Fase 1A & Fase 1B)

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

## 5. Adapters de Domínio (Domain Authorization Adapters)

Para desacoplar os domínios do núcleo de autorização:

### Leads (`src/features/leads/lead-authorization.ts`)
- **`buildLeadResourceScope(lead)`**: Converte entidades de lead em descritor canônico `{ tenantId, unitId, ownerUserId }`.
- **`buildLeadScopeWhere(context, options?)`**: Constrói cláusula SQL Drizzle para isolamento de tenant, multiunidade e posse (`corretorId`).

### Clientes (`src/features/customers/customer-authorization.ts`)
- **`buildClientResourceScope(client)`**: Converte entidades de cliente em descritor canônico `{ tenantId, unitId, ownerUserId }`.
- **`buildClientScopeWhere(context, options?)`**: Constrói cláusula SQL Drizzle para isolamento de tenant, multiunidade e posse (`corretorId`).

---

## 6. Modo Sombra (Shadow Authorization Mode)

Para garantir uma migração gradual e sem risco de regressão:
- O módulo [`src/shared/auth/shadow-mode.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/shared/auth/shadow-mode.ts) permite avaliar as regras legadas lado a lado com a decisão canônica.
- Ativado via variável de ambiente `AUTH_SHADOW_MODE=true` ou System Setting `feature_auth_shadow_mode=true`.
- Classifica divergências em: `LEGACY_TOO_PERMISSIVE`, `LEGACY_TOO_RESTRICTIVE`, `SCOPE_MODEL_GAP`, `CUSTOM_ROLE_GAP`, `TEAM_SCOPE_GAP`, `QUERY_SCOPE_GAP`.
- Discrepâncias emitem logs estruturados seguros sob o evento `auth_shadow_mismatch` (sem PII ou segredos).

---

## 7. Consumidores Migrados

### Fase 1A (Fundação e Unidades)
1. **`assertBranchProfileAccess`** ([`src/features/branches/queries.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/branches/queries.ts))
2. **`toggleAutoDistributeAction`** ([`src/features/branches/actions.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/branches/actions.ts))
3. **`toggleBrokerAvailabilityAction`** ([`src/features/branches/actions.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/branches/actions.ts))
4. **`canManageMember`** ([`src/shared/auth/team-permissions.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/shared/auth/team-permissions.ts))

### Fase 1B (Expansão Leads e Clientes)
5. **`getLeadTimeline`** ([`src/features/leads/queries.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/leads/queries.ts))
6. **`addLeadNoteAction`** ([`src/features/leads/actions.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/leads/actions.ts))
7. **`updateLeadLivesCountAction`** ([`src/features/leads/actions.ts`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/features/leads/actions.ts))
8. **`LeadDetailPage`** ([`src/app/(dashboard)/leads/[id]/page.tsx`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/app/%28dashboard%29/leads/%5Bid%5D/page.tsx))
9. **`LeadsPageContent`** ([`src/app/(dashboard)/leads/page.tsx`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/app/%28dashboard%29/leads/page.tsx))
10. **`CustomersPage`** ([`src/app/(dashboard)/clientes/page.tsx`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/app/%28dashboard%29/clientes/page.tsx))
11. **`ClientDetailPage`** ([`src/app/(dashboard)/clientes/[clientId]/page.tsx`](file:///c:/Users/kyper/Desktop/Kyper/Projects/ancorahub/src/app/%28dashboard%29/clientes/%5BclientId%5D/page.tsx))

---

## 8. Matriz de Segurança Validada

Coberta por 37 testes automatizados de autorização canônica:
- ✅ Isolamento multi-tenant estrito (Diretor, Gestor e Corretor).
- ✅ Prevenção de IDOR para gestor multiunidade (Unidade A e B permitidas, Unidade C bloqueada).
- ✅ Titularidade própria do corretor (Broker Self vs Broker Alheio).
- ✅ Bloqueio por falta de capacidade vs bloqueio por escopo fora da unidade.
- ✅ Fail-closed em escopo vazio ou desativado.
- ✅ Custom Roles com escopo `tenant` e `branch`.
- ✅ Scoping server-side para listagem, busca, contagem e paginação.
- ✅ Classificação e telemetria segura no Shadow Mode.
