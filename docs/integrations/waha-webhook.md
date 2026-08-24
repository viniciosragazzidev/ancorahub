# Webhook WAHA — CorreTop

Endpoint para recebimento de eventos do WAHA (WhatsApp HTTP API) no CorreTop.
Suporta mensagens inbound, confirmações de entrega e atualizações de status de sessão.

---

## Visão geral

```
WAHA ──► WAHA Relay ──► HMAC ──► POST /api/webhooks/waha ──► CRM
```

**Fluxo de segurança em camadas:**
1. WAHA envia evento para o relay
2. Relay assina com HMAC (SHA-256, timestamp, nonce)
3. CRM valida assinatura e schema (Zod)
4. Evento é deduplicado por `externalEventId`
5. Sessão é resolvida (número da plataforma OU conexão de corretor)
6. Mensagem é persistida com dedup por `(tenantId, messageId)`

---

## Endpoint

### Via Relay (produção)

```
POST https://crm.ancorasaude.cloud/api/webhooks/waha
```

### Via Fastify (sessões de corretor)

```
POST https://api.crm.ancorasaude.cloud/internal/webhooks/waha
```

---

## Autenticação

### Assinatura HMAC (obrigatório)

Todas as requisições devem incluir os headers de assinatura:

| Header | Descrição |
|--------|-----------|
| `x-ancora-timestamp` | Timestamp Unix em milissegundos |
| `x-ancora-nonce` | Nonce único para esta requisição |
| `x-ancora-signature` | HMAC-SHA-256 de `timestamp.nonce.body` |

**Validação:**
- Timestamp com tolerância de 5 minutos (anti-replay)
- Assinatura comparada com `timingSafeEqual` (anti-timing)

### Exemplo de assinatura

```js
import { createHmac } from "crypto";

const timestamp = Date.now().toString();
const nonce = crypto.randomUUID();
const body = JSON.stringify(payload);
const signature = createHmac("sha256", SHARED_SECRET)
  .update(`${timestamp}.${nonce}.${body}`)
  .digest("hex");
```

---

## Payload — Eventos

### Estrutura base

```json
{
  "eventId": "string (1-200 chars, obrigatório)",
  "type": "message.inbound | message.status | session.status",
  "sessionId": "string (1-120 chars, obrigatório)",
  "occurredAt": "ISO 8601 datetime (obrigatório)"
}
```

### Campos por tipo de evento

---

### `message.inbound` — Mensagem recebida

Evento disparado quando alguém envia uma mensagem para o WhatsApp conectado.

```json
{
  "eventId": "evt_abc123",
  "type": "message.inbound",
  "sessionId": "waha_7bf92c",
  "occurredAt": "2026-08-20T14:30:00.000Z",
  "message": {
    "id": "true_abc123_def456",
    "from": "5521999999999",
    "to": "5521888887777",
    "body": "Olá, gostaria de saber sobre planos",
    "type": "text",
    "fromMe": false,
    "caption": null,
    "replyToId": null,
    "media": null
  }
}
```

#### Campos da mensagem

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | ✅ | ID da mensagem no provedor (único por tenant) |
| `from` | string | ✅ | Telefone do remetente (10-15 dígitos) |
| `to` | string | ❌ | Telefone do destinatário |
| `body` | string | ✅ | Conteúdo da mensagem (máx. 4000 chars) |
| `type` | enum | ❌ | Tipo: `text` (padrão), `image`, `audio`, `video`, `document`, `sticker`, `location`, `contact` |
| `fromMe` | boolean | ❌ | `true` se enviada pelo próprio corretor (padrão: `false`) |
| `caption` | string | ❌ | Legenda para mensagens de mídia |
| `replyToId` | string | ❌ | ID da mensagem sendo respondida |
| `media` | object | ❌ | Metadados de mídia (ver abaixo) |

#### Metadados de mídia

```json
{
  "media": {
    "mimeType": "image/jpeg",
    "fileName": "foto.jpg",
    "sizeBytes": 1024000
  }
}
```

---

### `message.status` — Confirmação de entrega

Evento disparado quando o status de entrega de uma mensagem enviada muda.

```json
{
  "eventId": "evt_xyz789",
  "type": "message.status",
  "sessionId": "waha_7bf92c",
  "occurredAt": "2026-08-20T14:31:00.000Z",
  "delivery": {
    "idempotencyKey": "outbox:run_123:step_0",
    "providerMessageId": "true_abc123_def456",
    "status": "delivered"
  }
}
```

#### Campos de delivery

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `idempotencyKey` | string | ✅ | Chave de idempotência do outbox |
| `providerMessageId` | string | ❌ | ID da mensagem no provedor |
| `status` | enum | ✅ | `sent`, `delivered`, `read`, `failed` |

---

### `session.status` — Mudança de estado da sessão

Evento disparado quando o estado da sessão WAHA muda.

```json
{
  "eventId": "evt_session_001",
  "type": "session.status",
  "sessionId": "waha_7bf92c",
  "occurredAt": "2026-08-20T14:32:00.000Z",
  "sessionStatus": "active"
}
```

#### Valores de `sessionStatus`

| Valor WAHA | Valor CRM | Descrição |
|------------|-----------|-----------|
| `active` | `ready` | Sessão conectada e operacional |
| `paused` | `paused` | Sessão pausada pelo usuário |
| `offline` | `disconnected` | Sessão desconectada |
| `error` | `error` | Erro na sessão |

---

## Resolução de sessão

O CRM resolve a sessão em duas camadas:

1. **Números da plataforma** (`wahaNumbers.relaySessionId`) — usados por cadências
2. **Conexões de corretor** (`whatsappConnections.sessionName`) — usadas por sessões individuais

Se a sessão não é encontrada em nenhuma tabela:
- Evento é marcado como `unknown_session`
- Nenhum lead, conversa ou mensagem é criado

---

## Direção das mensagens

A direção é determinada pelo campo `fromMe`:

| `fromMe` | Direção | Resultado |
|----------|---------|-----------|
| `true` | `outgoing` | Mensagem enviada pelo corretor |
| `false` | `incoming` | Mensagem recebida de terceiro |

**Regras importantes:**

- Mensagens `outgoing` **sem lead ou client** associado são descartadas (`outgoing_no_lead`)
- Mensagens `incoming` sem match criam um novo lead automaticamente
- A IA somente processa mensagens `incoming`

---

## Resolução de contato

Para mensagens `incoming`, o CRM resolve o contato nesta ordem:

1. **Cadence runs** — se a sessão é um número da plataforma, busca na cadência
2. **Lead por telefone** — busca `leads` com `(tenantId, telefone)` exato
3. **Client por telefone** — busca `clients` com `(tenantId, telefone)` exato
4. **Auto-criação** — se nenhum match, cria novo lead com origem `webhook`

Todas as buscas são **escopadas por tenant** — nunca resolvem globalmente.

---

## Deduplicação

### Camada 1: Evento

Cada evento é deduplicado por `externalEventId` (constraint unique na tabela `waha_webhook_events`).

```sql
UNIQUE INDEX waha_webhook_events_external_unique ON waha_webhook_events (external_event_id)
```

Evento duplicado → `onConflictDoNothing` → resposta `{ processed: 0, ignored: "duplicate" }`

### Camada 2: Mensagem

Cada mensagem é deduplicada por `(tenantId, messageId)`:

```sql
UNIQUE INDEX whatsapp_messages_message_unique ON whatsapp_messages (tenant_id, message_id)
```

Mensagem duplicada → `onConflictDoNothing` → 1 registro no banco

### Camada 3: Relay

O relay mantém idempotência em arquivo para envios:

```
idempotencyKey → resultado do envio
```

Chave repetida → retorna resultado anterior sem reenviar ao WAHA

---

## Respostas

### 200 — Processado

```json
{
  "accepted": true,
  "processed": 1
}
```

### 200 — Duplicado (ACK)

```json
{
  "accepted": true,
  "processed": 0,
  "ignored": "duplicate"
}
```

### 200 — Sessão desconhecida (ACK seguro)

```json
{
  "accepted": true,
  "processed": 0,
  "ignored": "unknown_session"
}
```

### 400 — Payload inválido

```json
{
  "accepted": false,
  "error": "Schema validation failed"
}
```

### 401 — Assinatura inválida

```json
{
  "accepted": false,
  "error": "Assinatura inválida."
}
```

### 503 — Webhook não configurado

```json
{
  "accepted": false,
  "error": "WAHA webhook não configurado."
}
```

---

## Métricas de observabilidade

Cada processamento registra:

```json
{
  "eventType": "message.inbound",
  "direction": "incoming",
  "hasLead": true,
  "hasClient": false,
  "eventDedupMs": 12,
  "sessionResolveMs": 8,
  "leadResolveMs": 15,
  "persistMs": 22,
  "totalMs": 57
}
```

**Campos de latência:**

| Campo | Descrição |
|-------|-----------|
| `eventDedupMs` | Tempo para verificar deduplicação do evento |
| `sessionResolveMs` | Tempo para resolver a sessão (número ou conexão) |
| `leadResolveMs` | Tempo para encontrar lead/cliente |
| `persistMs` | Tempo para persistir mensagem no banco |
| `totalMs` | Tempo total do processamento |

---

## Segurança

- ✅ Assinatura HMAC com timestamp (anti-replay de 5 min)
- ✅ Timing-safe comparison (anti-timing)
- ✅ Deduplicação em 3 camadas
- ✅ Resolução de sessão por 2 tabelas (não aceita sessionName arbitrário)
- ✅ Busca de contato **sempre** escopada por tenant
- ✅ JID do WAHA (`numero@c.us`) é normalizado para dígitos antes da validação
  estrita do telefone; identificadores que não representam telefone continuam recusados
- ✅ Sem PII nos logs (apenas IDs e métricas)
- ✅ Webhook rápido (sem chamadas a IA, RAG ou download de mídia)
- ✅ Mensagens do corretor (`fromMe`) não criam leads

---

## Exemplo com curl

### Mensagem inbound

```bash
TIMESTAMP=$(($(date +%s%N) / 1000000))
NONCE=$(uuidgen)
BODY='{"eventId":"evt_test_001","type":"message.inbound","sessionId":"waha_7bf92c","occurredAt":"2026-08-20T14:30:00.000Z","message":{"id":"true_test_001","from":"5521999999999","body":"Olá, preciso de ajuda","type":"text","fromMe":false}}'
SIGNATURE=$(echo -n "${TIMESTAMP}.${NONCE}.${BODY}" | openssl dgst -sha256 -hmac "$WAHA_RELAY_SHARED_SECRET" | awk '{print $2}')

curl -X POST \
  "https://crm.ancorasaude.cloud/api/webhooks/waha" \
  -H "Content-Type: application/json" \
  -H "x-ancora-timestamp: $TIMESTAMP" \
  -H "x-ancora-nonce: $NONCE" \
  -H "x-ancora-signature: $SIGNATURE" \
  -d "$BODY"
```

### Confirmação de entrega

```bash
BODY='{"eventId":"evt_del_001","type":"message.status","sessionId":"waha_7bf92c","occurredAt":"2026-08-20T14:31:00.000Z","delivery":{"idempotencyKey":"outbox:run_123:step_0","providerMessageId":"true_msg_001","status":"delivered"}}'

curl -X POST \
  "https://crm.ancorasaude.cloud/api/webhooks/waha" \
  -H "Content-Type: application/json" \
  -H "x-ancora-timestamp: $TIMESTAMP" \
  -H "x-ancora-nonce: $NONCE" \
  -H "x-ancora-signature: $SIGNATURE" \
  -d "$BODY"
```

### Status de sessão

```bash
BODY='{"eventId":"evt_session_001","type":"session.status","sessionId":"waha_7bf92c","occurredAt":"2026-08-20T14:32:00.000Z","sessionStatus":"active"}'

curl -X POST \
  "https://crm.ancorasaude.cloud/api/webhooks/waha" \
  -H "Content-Type: application/json" \
  -H "x-ancora-timestamp: $TIMESTAMP" \
  -H "x-ancora-nonce: $NONCE" \
  -H "x-ancora-signature: $SIGNATURE" \
  -d "$BODY"
```

---

## Tipos de mensagem suportados

| Tipo | Descrição | Processamento atual |
|------|-----------|---------------------|
| `text` | Mensagem de texto | ✅ Completo |
| `image` | Imagem com ou sem legenda | Metadata persistida |
| `audio` | Áudio (inclui voice notes) | Metadata persistida |
| `video` | Vídeo | Metadata persistida |
| `document` | Documento (PDF, etc.) | Metadata persistida |
| `sticker` | Sticker | Metadata persistida |
| `location` | Localização | Metadata persistida |
| `contact` | Contato vCard | Metadata persistida |

> **Nota:** Nesta fase, apenas metadados de mídia são persistidos. Download e
> processamento de mídia serão implementados em fase futura.

---

## Cenários de teste

### 1. Mensagem real

```
Telefone externo envia "Olá"
→ WAHA recebe
→ Relay assina HMAC
→ CRM valida assinatura
→ Evento deduplicado
→ Sessão resolvida
→ Lead encontrado/criado
→ Mensagem persistida
→ UI /conversas exibe
```

### 2. Mensagem duplicada

```
Mesmo evento entregue 2x
→ Evento dedup: SKIP
→ whatsapp_messages: 1 registro
```

### 3. Cross-tenant

```
Tenant A e Tenant B com mesmo telefone
→ Mensagem entra pela sessão do Tenant A
→ Somente Tenant A recebe
```

### 4. Sessão desconhecida

```
Evento com sessionId inexistente
→ UNKNOWN_SESSION
→ Nenhum lead/conversa/mensagem criado
→ Evento marcado como ignored
```

### 5. Mensagem do corretor

```
Corretor envia mensagem (fromMe: true)
→ direction: outgoing
→ Se não há lead: descartado (outgoing_no_lead)
→ Se há lead: persistida como outgoing
```

### 6. Restart WAHA

```
Container WAHA reinicia
→ Sessão reconecta
→ session.status: active
→ Mensagens continuam chegando
```

---

## Chaves de configuração

| Variável | Local | Descrição |
|----------|-------|-----------|
| `WAHA_RELAY_SHARED_SECRET` | Relay + CRM | Segredo HMAC para assinatura |
| `WAHA_CADENCE_FEATURE` | CRM (system_settings) | Kill switch: `feature_waha_cadence_enabled` |
| `WAHA_AI_FEATURE` | CRM (system_settings) | Kill switch: `feature_waha_ai_enabled` |
| `CRM_WEBHOOK_URL` | Fastify (VPS) | URL do webhook CRM para forward |
| `WAHA_RELAY_SHARED_SECRET` | Fastify (VPS) + CRM | Mesmo segredo HMAC usado pelo encaminhador para assinar cada evento recebido do WAHA. |

---

## Tabelas relacionadas

| Tabela | Propósito |
|--------|-----------|
| `waha_webhook_events` | Ledger de eventos recebidos (dedup) |
| `whatsapp_messages` | Mensagens persistidas (dedup por tenant+messageId) |
| `waha_numbers` | Números da frota WAHA (relay sessions) |
| `whatsapp_connections` | Conexões de corretor (broker sessions) |
| `waha_cadence_runs` | Execuções de cadência |
| `waha_delivery_outbox` | Fila de envios (outbound) |
| `waha_suppressions` | Supressões/opt-out |

---

## Notas para implementadores

1. **Não criar pipeline paralelo** — reutilize `ingestWahaWebhook`
2. **Não duplicar dedup** — a constraint unique já protege
3. **Não processar mídia no webhook** — apenas metadata
4. **Não chamar IA no webhook** — use `waitUntil` para background
5. **Não expor PII em logs** — use IDs e métricas
6. **Escopo por tenant** — toda busca é filtrada por `tenantId`
