# WAHA Safety & Outbound Audit

> Auditoria de segurança existente antes da implementação da Fase 20.5.
> Nenhuma lógica interna garante que uma conta nunca será restringida.
> Estes mecanismos são tratados como **outbound safety**, **rate control** e **abuse prevention**.

---

## 1. Mecanismos de Segurança Existentes

### 1.1 WAHA Relay HMAC (`services/waha-relay/server.mjs`)

| Campo | Status |
|-------|--------|
| HMAC signature (sha256) | ✅ `x-ancora-signature` via `WAHA_RELAY_SHARED_SECRET` |
| Timestamp anti-replay | ✅ 5-minute window (`x-ancora-timestamp`) |
| Nonce | ✅ `x-ancora-nonce` |
| Timing-safe comparison | ✅ `timingSafeEqual` |
| Body integrity | ✅ HMAC sobre `timestamp.nonce.body` |

**Resultado:** Relay é protegido contra replay e falsificação.

### 1.2 CRM Webhook (`src/app/api/webhooks/waha/route.ts`)

| Campo | Status |
|-------|--------|
| Signature verification | ✅ `verifyRelaySignature()` reutiliza o HMAC |
| Schema validation | ✅ Zod via `wahaWebhookSchema` |
| Raw body preservado | ✅ `request.text()` preserva bytes para HMAC |

**Resultado:** Webhook CRM valida autenticidade e schema.

### 1.3 Deduplicação de Eventos

| Mecanismo | Tabela | Constraint | Estado |
|-----------|--------|------------|--------|
| Event ID único | `waha_webhook_events` | `external_unique` + `onConflictDoNothing` | ✅ Ativo |
| Message ID único | `whatsapp_messages` | `message_unique (tenant, messageId)` + `onConflictDoNothing` | ✅ Ativo |
| Relay idempotency | Relay file | `idempotencyKey` → JSON file | ✅ Ativo |
| Delivery idempotency | `waha_delivery_outbox` | `tenant_idempotency_unique` | ✅ Ativo |
| Notification idempotency | `notifications` | `tenant_idempotency_unique` | ✅ Ativo |
| Lead intake idempotency | `lead_effect_outbox` | `tenant_idempotency_unique` | ✅ Ativo |

**Resultado:** Triple dedup (relay → CRM event → DB constraint).

### 1.4 Opt-Out & Suppression

| Mecanismo | Local | Estado |
|-----------|-------|--------|
| `waha_suppressions` table | `phone_hash` unique | ✅ Ativo |
| AI opt-out detection | `quick-reply.ts` → `parseOptOut()` | ✅ Ativo |
| Automation suppression check | `engine.ts` → `wahaSuppressions` | ✅ Ativo |
| Conversation opt-out state | `ai_conversations.opt_out_at` | ✅ Ativo |
| OptOutGuard (capability pipeline) | `capability-guards.ts` | ✅ Ativo |

**Resultado:** Opt-out propagado de conversa → automação → envio.

### 1.5 Guard Pipeline (`src/features/ai-agent/capability-guards.ts`)

| Guard | Função | Estado |
|-------|--------|--------|
| TenantGuard | Impede acesso cross-tenant | ✅ |
| PermissionGuard | Verifica permissões | ✅ |
| HumanTakeoverGuard | Bloqueia ação quando humano assumiu | ✅ |
| OptOutGuard | Bloqueia ação para opted-out | ✅ |
| ConversationStateGuard | Valida estado da conversa | ✅ |
| RequiredFactsGuard | Exige fatos obrigatórios | ✅ |

**Resultado:** Pipeline completo de guards para AI capabilities.

### 1.6 Outbox com Retry & Lease

| Componente | Config | Estado |
|------------|--------|--------|
| `waha_delivery_outbox` | lease, retry, backoff, dead-letter | ✅ |
| `lead_effect_outbox` | lease, retry, dead-letter | ✅ |
| System settings | `waha_cadence_max_attempts`, `retry_base_seconds`, `lease_seconds` | ✅ Super-admin controlável |
| Kill switch | `feature_waha_cadence_enabled` | ✅ Pausa tudo sem deletar |

**Resultado:** Outbox resiliente com lease recuperável e backoff.

### 1.7 Business Hours

| Campo | Local | Estado |
|-------|-------|--------|
| `businessHoursStart/End` | `ai_qualification_configs` | ✅ |
| Cadence schedule | `waha_cadence_versions.schedule` (startHour, endHour, weekdays) | ✅ |

**Resultado:** Horário comercial configurável por tenant e cadência.

### 1.8 Session Status Tracking

| Campo | Local | Estado |
|-------|-------|--------|
| `wahaNumbers.status` | Atualizado via webhook `session.status` | ✅ |
| `wahaNumbers.lastHealthAt` | Timestamp de último evento | ✅ |
| Session health check | `GET /internal/waha/health` | ✅ (Fase 1) |

**Resultado:** Status de sessão rastreado e health check disponível.

---

## 2. O que NÃO existe (Gaps)

| Gap | Risco | Prioridade |
|-----|-------|------------|
| **Daily/hourly limit por sessão** | Rajada excessiva pode causar ban | Alta |
| **Per-session concurrency control** | Múltiplos workers simultâneos | Alta |
| **Message pacing/jitter** | Padrão não-humano | Média |
| **Warmup/Warming** | Sessão nova com alto volume | Média |
| **Session degradation detection** | WAHA pode reportar quality issues | Média |
| **Opt-out guard no outbound relay** | Relay não verifica opt-out antes de enviar | Alta |
| **Outbound session health check** | Não verifica se sessão está CONNECTED antes de enviar | Alta |
| **Duplicate outbound guard no relay** | Relay dedup é file-based (reinício perde) | Média |
| **Quiet hours enforcement** | Business hours existem mas não são enforced no outbound | Média |

---

## 3. Fluxo Atual de Outbound

```
CRM (server action / automation)
  ↓
sendWahaRelayMessage()
  ↓
WAHA Relay (services/waha-relay/server.mjs)
  ↓ HMAC + idempotency
WAHA API (/api/sendText)
  ↓
WhatsApp
```

**Gateway único:** WAHA Relay é o único ponto de envio para sessões WAHA.
**Não há** envio bypass — todo outbound passa pelo relay.

---

## 4. Fluxo Atual de Inbound

```
WAHA
  ↓
WAHA Relay (services/waha-relay/server.mjs)
  ↓ HMAC signature
CRM POST /api/webhooks/waha
  ↓ verifyRelaySignature
ingestWahaWebhook()
  ↓ dedup (externalEventId)
  ↓ session resolution (relaySessionId → wahaNumbers)
  ↓ tenant isolation
  ↓ message dedup (messageId)
  ↓ conversation resolution
  ↓ AI processing (optional)
```

**Resultado:** Pipeline completo com dedup em 3 camadas.

---

## 5. Arquivos Relevantes

| Arquivo | Função |
|---------|--------|
| `services/waha-relay/server.mjs` | Relay HMAC + idempotency + envio |
| `src/app/api/webhooks/waha/route.ts` | Webhook CRM (valida HMAC) |
| `src/features/waha-cadence/inbound.ts` | Processamento inbound |
| `src/features/waha-cadence/contract.ts` | Schema Zod + HMAC verification |
| `src/features/ai-agent/capability-guards.ts` | Guard pipeline |
| `src/features/automations/engine.ts` | Automação com opt-out check |
| `src/features/waha-cadence/connection-service.ts` | Conexões WAHA |
| `src/shared/db/schema.ts` | Schema completo (tabelas) |

---

## 6. Recomendações para Fase 20.5

1. **Reutilizar** `ingestWahaWebhook` — não criar pipeline paralelo
2. **Reutilizar** `wahaWebhookEvents` — não criar tabela nova
3. **Reutilizar** `whatsapp_messages` — não criar tabela paralela
4. **Extender** session resolution para suportar broker connections
5. **Adicionar** session health check antes de outbound
6. **Adicionar** opt-out check no relay (já existe no engine)
7. **Não duplicar** rate limiting — documentar ausência e propor configuração futura
