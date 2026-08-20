# Implementação — Item 3.2: Webhook genérico de recebimento de leads com token por tenant

Data: July 12, 2026
Prioridade: 🔴 P0

---

## 1. Endpoint

```
POST /api/webhooks/leads/[tenantId]
```

## 2. Schema Drizzle Adicionado

### Novas tabelas

| Tabela | Descrição |
|---|---|
| `lead_webhook_credentials` | Credenciais de autenticação para webhooks por tenant |
| `webhook_deliveries` | Registro de entregas para idempotência e auditoria |

### Novos enums

- `webhook_credential_status`: `active`, `revoked`
- `webhook_delivery_status`: `received`, `processed`, `rejected`, `failed`

### Colunas adicionadas

- `branches.external_id` (text, nullable) — identificador externo para filiais
- `leads.external_id` (text, nullable) — identificador externo do lead
- `leads.webhook_credential_id` (FK → lead_webhook_credentials) — origem do webhook
- `leads.branch_id` alterado de `NOT NULL` para nullable

### Índices

- Partial unique: `branches(tenant_id, external_id) WHERE external_id IS NOT NULL`
- Partial unique: `leads(webhook_credential_id, external_id) WHERE external_id IS NOT NULL`
- Partial unique: `webhook_deliveries(credential_id, idempotency_key) WHERE idempotency_key IS NOT NULL`

## 3. Migrations

- `drizzle/0006_demonic_ultragirl.sql`: `ALTER TABLE leads ALTER COLUMN branch_id DROP NOT NULL`

## 4. Arquivos Criados

```
src/features/leads/webhooks/
  types/lead-webhook.types.ts
  schemas/lead-webhook-payload.schema.ts
  utils/lead-webhook.utils.ts
  services/
    authenticate-lead-webhook.ts
    resolve-lead-webhook-idempotency.ts
    resolve-webhook-branch.ts
    create-lead-from-webhook.ts
    receive-lead-webhook.ts
  tests/lead-webhook.test.ts

src/app/api/webhooks/leads/[tenantId]/route.ts

scripts/generate-webhook-credential.ts

docs/integrations/lead-webhook.md
```

## 5. Arquivos Alterados

- `src/shared/db/schema.ts` — +2 tabelas, +2 enums, +colunas, +índices, +relations
- `src/shared/auth/permissions.ts` — sem alterações (webhooks usam auth própria)

## 6. Segurança

- Token Bearer → SHA-256 → armazenado apenas hash
- `createdBy` (FK → user.id) usado para FK compliance em interactions/audit
- Erro 401 genérico para qualquer falha de autenticação (não revela tenant)
- `.strict()` no Zod rejeita campos de autoridade (`tenantId`, `assignedUserId`, etc.)

## 7. Validação Final

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm test` | ✅ 58/58 testes |
| `npx next build` | ✅ |
| `npx drizzle-kit check` | ✅ |
