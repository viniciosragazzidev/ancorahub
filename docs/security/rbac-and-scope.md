# Modelo de Segurança: RBAC e Escopo Organizacional

Este documento detalha o funcionamento arquitetural da autorização no sistema.

---

## Arquitetura de Autorização

```text
AUTHENTICATED USER (Session)
        ↓
resolveAccessContext()
        ↓
┌───────────────────────────────────────────┐
│ userId: string                            │
│ tenantId: string                          │
│ role: "director" | "manager" | ...        │
│ permissions: Set<PermissionKey>           │
│ scopeType: "GLOBAL" | "UNITS" | "SELF"    │
│ allowedUnitIds: string[]                  │
└───────────────────────────────────────────┘
        ↓
AuthorizationService
  ├─ .can(context, permission)
  ├─ .canAccessUnit(context, unitId)
  └─ .scopeQuery(context, table)
        ↓
Query SQL com Filtro Seguro (Drizzle ORM)
```

---

## Resolução de Escopo e Regras de Segurança

1. **Deny by Default:** Caso uma permissão não esteja expressamente concedida no `permissions Set`, o acesso é negado (`AuthorizationError`).
2. **Fail Closed:** Em caso de erro na resolução de escopo ou falha de sessão, o sistema rejeita a operação com código de erro seguro (`403 Forbidden` / `AuthorizationError`).
3. **Hierarchy of Assignment:** Nenhum usuário pode conceder um escopo maior do que o seu próprio (`scope ⊆ próprio scope`).
4. **Prevenção de Escalada:** Modificações de cargo e escopo validam os privilégios do autor e registram log de auditoria em `schema.auditLogs`.
