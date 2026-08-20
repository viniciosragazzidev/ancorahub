# Plano — WAHA Fase 2: Sessão de Teste + QR Code

**Branch:** `feat/waha-vps-integration-phase2`
**Pré-requisito:** Fase 1 (WahaClient + health check) implementada
**Data:** 2026-08-20
**Status:** Planejamento

---

## Objetivo

Implementar o fluxo técnico de uma sessão WAHA de teste através do Fastify:
criar sessão → iniciar → obter status → obter QR Code → retornar dados normalizados.

Sem integrar com corretor real, sem UI definitiva, sem webhook.

---

## Auditoria: Endpoints WAHA reais

Extraídos do `services/waha-relay/server.mjs` (código existente):

| WAHA Endpoint | Método | Uso no Relay | Usar na Fase 2? |
|---------------|--------|--------------|-----------------|
| `/api/sessions/` | POST | Criar sessão | ✅ `createSession` |
| `/api/sessions/{name}` | GET | Status da sessão | ✅ `getSession` |
| `/api/sessions/{name}/start` | POST | Iniciar sessão | ✅ `startSession` |
| `/api/sessions/{name}/stop` | POST | Pausar sessão | ✅ Para reset |
| `/api/sessions/{name}/logout` | POST | Desconectar | ✅ Para reset |
| `DELETE /api/sessions/{name}` | DELETE | Deletar sessão | ✅ Para reset |
| `/api/{name}/auth/qr?format=image` | GET | QR Code | ✅ `getQr` |
| `/api/sessions/{name}/me` | GET | Dados do número conectado | ✅ Para status connected |

**Auth WAHA:** Header `x-api-key` com `WAHA_API_KEY`

**Status mapeados** (já mapeados no relay):
- `WORKING` → `CONNECTED`
- `STOPPED` → `DISCONNECTED`
- `FAILED` → `ERROR`
- `SCAN_QR_CODE` → `WAITING_QR`
- `STARTING` → `STARTING`
- Outros → `DISCONNECTED`

---

## Arquitetura

```
Next/Vercel
    ↓ (Authorization: Bearer)
Fastify/VPS
    ↓ (WahaClient — x-api-key)
WAHA interno (http://waha:3000)
```

---

## Etapas de implementação

### Etapa 1 — Estender WahaClient com métodos de sessão

**Arquivo:** `services/whatsapp-api/src/integrations/waha/client.ts`

Adicionar ao WahaClient existente (da Fase 1):

```ts
// Métodos novos
async getSession(name: string): Promise<WahaSession | null>
async createSession(name: string): Promise<WahaSession>
async startSession(name: string): Promise<void>
async getQr(name: string): Promise<string | null>
async stopSession(name: string): Promise<void>
async deleteSession(name: string): Promise<void>
```

**Endpoints WAHA usados:**
- `GET /api/sessions/{name}` → `getSession`
- `POST /api/sessions/` → `createSession` (body: `{ name }`)
- `POST /api/sessions/{name}/start` → `startSession`
- `GET /api/{name}/auth/qr?format=image` → `getQr` (retorna `qr.data` como base64)
- `POST /api/sessions/{name}/stop` → `stopSession`
- `DELETE /api/sessions/{name}` → `deleteSession`

**Timeouts por operação:**
- `getSession`: 5s
- `createSession`: 8s
- `startSession`: 8s
- `getQr`: 5s
- `stopSession`: 5s
- `deleteSession`: 5s

**Tratamento de 409 Conflict:** Se `createSession` retorna 409 (sessão já existe),
tratar como sucesso — a sessão já existe.

### Etapa 2 — Normalização de status

**Arquivo:** `services/whatsapp-api/src/integrations/waha/types.ts`

```ts
type WahaSessionStatus =
  | "DISCONNECTED"
  | "STARTING"
  | "WAITING_QR"
  | "CONNECTED"
  | "ERROR";

type WahaSession = {
  name: string;
  status: WahaSessionStatus;
  displayPhoneNumber: string | null;
  qrCode: string | null;  // null se não estiver em WAITING_QR
};
```

**Mapeamento** (consistente com o relay existente):
```ts
function normalizeWahaStatus(raw: string): WahaSessionStatus {
  const s = raw.toUpperCase();
  if (s === "WORKING") return "CONNECTED";
  if (s === "STOPPED") return "DISCONNECTED";
  if (s === "FAILED") return "ERROR";
  if (s === "SCAN_QR_CODE" || s === "STARTING") return "WAITING_QR";
  return "DISCONNECTED";
}
```

**Atenção:** `STARTING` do WAHA deve mapear para `WAITING_QR` (pois o WAHA
transiciona de STARTING → SCAN_QR_CODE). Mas se o relay já tratava `STARTING`
como `connecting`, manter consistência.

### Etapa 3 — Método `ensureTestSession`

**Arquivo:** `services/whatsapp-api/src/integrations/waha/client.ts`

```ts
const TEST_SESSION_NAME = "corretop_test";

async ensureTestSession(): Promise<WahaSession> {
  const existing = await this.getSession(TEST_SESSION_NAME);
  if (existing) return existing;
  return this.createSession(TEST_SESSION_NAME);
}
```

- Se a sessão já existe: reutilizar
- Se não existe: criar
- 409 Conflict na criação: buscar status atual (race condition protegida)
- Não usar `default` para evitar conflito com sessões existentes

### Etapa 4 — Extrair auth guard genérico

**Arquivo:** `services/whatsapp-api/src/app.ts`

Refatorar a verificação de token existente em uma função reutilizável:

```ts
function requireInternalAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  config: { internalToken: string }
): boolean {
  if (!secureEquals(request.headers["x-corretop-internal-token"], config.internalToken)) {
    reply.code(401).send({ ok: false, service: "waha", status: "unauthorized" });
    return false;
  }
  return true;
}
```

Usar em todas as rotas `/internal/waha/*` e na rota existente de review.
Não criar segundo sistema de auth.

### Etapa 5 — Rota `POST /internal/waha/test-session/start`

**Fluxo:**
1. Autenticar com `requireInternalAuth`
2. Chamar `wahaClient.ensureTestSession()`
3. Se status não for `CONNECTED`: chamar `wahaClient.startSession(name)`
4. Consultar status final via `wahaClient.getSession(name)`
5. Retornar status normalizado

**Resposta sucesso:**
```json
{
  "ok": true,
  "session": "corretop_test",
  "status": "WAITING_QR",
  "timestamp": "2026-08-20T12:00:00.000Z"
}
```

**Resposta erro:**
```json
{
  "ok": false,
  "service": "waha",
  "status": "unavailable",
  "error": "WAHA_UNAVAILABLE"
}
```

### Etapa 6 — Rota `GET /internal/waha/test-session/status`

**Fluxo:**
1. Autenticar
2. Chamar `wahaClient.getSession("corretop_test")`
3. Retornar status normalizado

**Resposta:**
```json
{
  "ok": true,
  "session": "corretop_test",
  "status": "WAITING_QR",
  "timestamp": "..."
}
```

Se sessão não existe:
```json
{
  "ok": true,
  "session": "corretop_test",
  "status": "DISCONNECTED",
  "timestamp": "..."
}
```

### Etapa 7 — Rota `GET /internal/waha/test-session/qr`

**Fluxo:**
1. Autenticar
2. Consultar status da sessão
3. Se `status !== "WAITING_QR"`: retornar status atual sem QR
4. Se `status === "WAITING_QR"`: chamar `wahaClient.getQr(name)`
5. Retornar QR

**Resposta com QR:**
```json
{
  "ok": true,
  "session": "corretop_test",
  "status": "WAITING_QR",
  "qr": "data:image/png;base64,...",
  "timestamp": "..."
}
```

**Resposta conectado (sem QR):**
```json
{
  "ok": true,
  "session": "corretop_test",
  "status": "CONNECTED",
  "timestamp": "..."
}
```

**Resposta QR expirado/indisponível:**
```json
{
  "ok": true,
  "session": "corretop_test",
  "status": "WAITING_QR",
  "qr": null,
  "timestamp": "..."
}
```

Não salvar QR permanentemente. Não logar QR.

### Etapa 8 — Rota `POST /internal/waha/test-session/reset`

**Fluxo:**
1. Autenticar
2. Chamar `wahaClient.stopSession(name)` (ignorar erro se já parada)
3. Chamar `wahaClient.deleteSession(name)` (ignorar erro se não existe)
4. Retornar `{ ok: true, session: "corretop_test", status: "DISCONNECTED" }`

Útil para desenvolvimento e repetição de testes.

### Etapa 9 — Logs estruturados

Em toda operação WAHA:
```ts
request.log.info({
  operation: "waha.test_session.start",
  session: "corretop_test",
  status: "WAITING_QR",
  durationMs: 1200,
});
```

Em erro:
```ts
request.log.warn({
  operation: "waha.test_session.start",
  session: "corretop_test",
  errorCode: "WAHA_TIMEOUT",
  durationMs: 5001,
});
```

**Nunca logar:**
- QR code
- WAHA_API_KEY
- Headers internos
- Stack traces completos

### Etapa 10 — Testes unitários

**Arquivo novo:** `services/whatsapp-api/test/waha-session.test.ts`

Usar padrão existente: Node.js test runner + `app.inject()`.

**Casos de teste:**

1. `POST /start` sem Bearer → 401
2. `GET /status` sem Bearer → 401
3. `GET /qr` sem Bearer → 401
4. `POST /start` com sessão inexistente → cria e retorna `WAITING_QR`
5. `POST /start` com sessão existente → não duplica, retorna status atual
6. `GET /status` com sessão `WAITING_QR` → normalização correta
7. `GET /qr` com sessão `WAITING_QR` → retorna QR
8. `GET /qr` com sessão `CONNECTED` → retorna status sem QR
9. WAHA timeout → erro controlado
10. WAHA offline → erro controlado
11. `POST /reset` → sessão removida
12. `GET /health` continua independente → 200

**Mock do WahaClient:** Criar mock que simula respostas do WAHA para cada cenário.

**Arquivo novo:** `services/whatsapp-api/test/waha-client-session.test.ts`

Testes unitários do WahaClient (sem Fastify):
- Mock de fetch com respostas 200, 401, 409, 500
- Mock de timeout
- Mock de network error
- Mock de JSON inválido
- Verificar normalização de status

---

## Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `services/whatsapp-api/src/integrations/waha/client.ts` | Modificar | Adicionar métodos de sessão |
| `services/whatsapp-api/src/integrations/waha/types.ts` | Criar/Modificar | Tipos de sessão e normalização |
| `services/whatsapp-api/src/app.ts` | Modificar | Extrair auth guard, adicionar 4 rotas |
| `services/whatsapp-api/src/config.ts` | Modificar | Adicionar `getWahaConfig()` (Fase 1) |
| `services/whatsapp-api/test/waha-session.test.ts` | Criar | Testes das rotas |
| `services/whatsapp-api/test/waha-client-session.test.ts` | Criar | Testes do client |

---

## O que NÃO fazer nesta etapa

- ❌ Tabela `WhatsAppConnection`
- ❌ Sessão por corretor real
- ❌ Tenant mapping
- ❌ UI final Config > WhatsApp
- ❌ Webhook
- ❌ Inbound message
- ❌ sendText
- ❌ Distribuição de sessões
- ❌ Reconect automático
- ❌ Rollout para múltiplos usuários
- ❌ Exp porta pública
- ❌ Alterar `.env` real

---

## Comandos de teste pós-deploy

```bash
# A) Health (deve retornar 200)
curl -s https://api.crm.ancorasaude.cloud/health

# B) Start test session (deve criar/iniciar sessão)
curl -s -X POST https://api.crm.ancorasaude.cloud/internal/waha/test-session/start \
  -H "Authorization: Bearer $VPS_INTERNAL_API_TOKEN" \
  -H "X-CorreTop-Internal-Token: $WHATSAPP_API_INTERNAL_TOKEN"

# C) Status (deve retornar WAITING_QR ou CONNECTED)
curl -s https://api.crm.ancorasaude.cloud/internal/waha/test-session/status \
  -H "Authorization: Bearer $VPS_INTERNAL_API_TOKEN" \
  -H "X-CorreTop-Internal-Token: $WHATSAPP_API_INTERNAL_TOKEN"

# D) QR (deve retornar QR quando WAITING_QR)
curl -s https://api.crm.ancorasaude.cloud/internal/waha/test-session/qr \
  -H "Authorization: Bearer $VPS_INTERNAL_API_TOKEN" \
  -H "X-CorreTop-Internal-Token: $WHATSAPP_API_INTERNAL_TOKEN"
```

Nenhum secret real deve aparecer nestes comandos.

---

## Fluxo esperado pós-deploy

```
1. POST /start
   → sessão criada + iniciada
   → status: WAITING_QR

2. GET /status
   → status: WAITING_QR

3. GET /qr
   → retorna QR (data URL ou base64)

4. Usuário escaneia QR no WhatsApp

5. GET /status
   → status: CONNECTED
   → displayPhoneNumber preenchido

6. GET /qr (quando CONNECTED)
   → retorna { ok: true, status: "CONNECTED" } sem QR
```

---

## Checklist de segurança

- [ ] Todas as rotas `/internal/waha/*` protegidas
- [ ] WAHA não exposto publicamente
- [ ] QR não aparece em logs
- [ ] API key nunca retorna em response
- [ ] Erros não expõem stack trace
- [ ] Sessão de teste não afeta dados reais
- [ ] Reset só acessível via auth interna

---

## Definition of Done

- [ ] Sessão técnica pode ser criada
- [ ] Sessão não duplica (409 tratado)
- [ ] Start funciona
- [ ] Status funciona com normalização
- [ ] QR pode ser obtido
- [ ] QR não aparece em logs
- [ ] CONNECTED é detectado
- [ ] QR expirado tratado (retorna `qr: null`)
- [ ] Timeout tratado
- [ ] WAHA offline tratado
- [ ] Rotas internas protegidas
- [ ] `/health` independente do WAHA
- [ ] Testes passando
- [ ] Comandos de deploy/teste entregues
