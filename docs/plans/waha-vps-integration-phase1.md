# Plano — Integração WAHA na VPS (Fase 1)

**Branch:** `feat/waha-vps-integration-phase1`
**Data:** 2026-08-20
**Status:** Planejamento

---

## Objetivo

Validar que o WAHA está acessível internamente pela VPS, criar um cliente central no
Fastify para comunicação com o WAHA, e expor um endpoint interno de health — sem
implementar sessão por corretor, QR Code, webhook ou UI do CRM.

## Arquitetura alvo

```
Browser → Next/Vercel → Fastify/VPS → WAHA interno
```

Nesta etapa, somente:
```
Fastify/VPS → WAHA interno
```

---

## Auditoria concluída

| Item | Status | Detalhe |
|------|--------|---------|
| WAHA no compose | ✅ | `services/waha-relay/docker-compose.yml`, serviço `waha` (`devlikeapro/waha:latest`) |
| Porta interna WAHA | ✅ | `3000` (expose, não exposta publicamente) |
| Volume persistente | ✅ | `waha_sessions:/app/.sessions` |
| Auth WAHA → Relay | ✅ | Header `x-api-key` com `WAHA_API_KEY` |
| Fastify existente | ✅ | `services/whatsapp-api/`, Fastify 5.6, porta `3333` |
| Auth interna Fastify | ✅ | Header `x-corretop-internal-token` (timing-safe) |
| Cliente Next → VPS | ✅ | `src/lib/server/vps-api.ts`, Bearer token |
| Dockerfile Fastify | ✅ | `services/whatsapp-api/Dockerfile` |

---

## Etapas de implementação

### Etapa 1 — Estender o `whatsapp-api` com suporte ao WAHA

**Arquivo:** `services/whatsapp-api/src/config.ts`

Adicionar configuração WAHA ao lado da config existente de revisão Meta:

```ts
// Nova função (não substituir a existente)
export function getWahaConfig() {
  return {
    baseUrl: requiredEnv("WAHA_BASE_URL"),     // ex: http://waha:3000
    apiKey: requiredEnv("WAHA_API_KEY"),
    healthTimeoutMs: 5_000,
  };
}
```

- Reutilizar a função `required()` já existente
- Não hardcodear valores
- Não expor a key em logs

**Variáveis de ambiente necessárias:**
- `WAHA_BASE_URL` — URL interna do WAHA (já existe no docker-compose do relay)
- `WAHA_API_KEY` — chave API do WAHA (já existe no docker-compose do relay)

### Etapa 2 — Criar WahaClient central

**Arquivo novo:** `services/whatsapp-api/src/integrations/waha/client.ts`

Responsabilidades:
- Executar chamadas HTTP ao WAHA com autenticação `x-api-key`
- Aplicar timeout explícito (5s para health)
- Normalizar erros em códigos conhecidos
- Nunca expor secrets

```ts
// Erros normalizados
type WahaErrorCode =
  | "WAHA_UNAVAILABLE"
  | "WAHA_TIMEOUT"
  | "WAHA_UNAUTHORIZED"
  | "WAHA_BAD_RESPONSE"
  | "WAHA_INTERNAL_ERROR";

type WahaHealthResult = {
  ok: boolean;
  status: "healthy" | "unavailable" | "timeout" | "unauthorized";
  error?: WahaErrorCode;
  durationMs: number;
};
```

Métodos:
- `health(): Promise<WahaHealthResult>` — valida disponibilidade do WAHA

Endpoints do WAHA a usar:
- `GET /api/server/health` ou `GET /api/sessions` (descobrir qual existe na versão
  instalada — o relay existente usa `/api/sessions/{name}`, então `/api/sessions`
  deve funcionar)

**Timeout:** 5 segundos para health. Se não responder, retornar `WAHA_TIMEOUT`.

### Etapa 3 — Criar rota de health interna

**Arquivo:** `services/whatsapp-api/src/app.ts`

Adicionar rota protegida:

```
GET /internal/waha/health
```

**Auth:** Reutilizar o mesmo mecanismo `x-corretop-internal-token` já existente.
Extrair para uma função `requireInternalAuth(request, reply)` para reaproveitar.

**Resposta sucesso (200):**
```json
{
  "ok": true,
  "service": "waha",
  "status": "healthy",
  "timestamp": "2026-08-20T12:00:00.000Z"
}
```

**Resposta WAHA indisponível (503):**
```json
{
  "ok": false,
  "service": "waha",
  "status": "unavailable",
  "error": "WAHA_UNAVAILABLE"
}
```

**Resposta timeout (504):**
```json
{
  "ok": false,
  "service": "waha",
  "status": "timeout",
  "error": "WAHA_TIMEOUT"
}
```

**Resposta auth inválida (401):**
```json
{
  "ok": false,
  "service": "waha",
  "status": "unauthorized"
}
```

Não revelar: API key, URL interna, stack trace, detalhes administrativos.

### Etapa 4 — Garantir que `/health` continua independente

**Verificação:** O endpoint `GET /health` existente já retorna `{ status: "ok" }`
sem verificar WAHA. Não alterar este comportamento. WAHA é dependência degradável.

### Etapa 5 — Atualizar docker-compose do relay

**Arquivo:** `services/waha-relay/docker-compose.yml`

Adicionar variáveis `WAHA_BASE_URL` e `WAHA_API_KEY` ao serviço `relay` (já existentes).
Confirmar que o `whatsapp-api` pode compartilhar a mesma rede Docker com o `waha`.

Se o `whatsapp-api` e o `waha-relay` rodarem em compose separados, criar um
`docker-compose.yml` unificado na raiz ou usar rede externa compartilhada.

### Etapa 6 — Extrair auth guard genérico

**Arquivo:** `services/whatsapp-api/src/app.ts`

Refatorar a verificação de `x-corretop-internal-token` extraída em uma função:

```ts
function requireInternalAuth(request, reply): boolean
```

Usar tanto na rota existente (`/api/integrations/whatsapp/send-test-message`) quanto
na nova rota (`/internal/waha/health`). Não criar segundo sistema de auth.

### Etapa 7 — Logs estruturados

Registrar em toda chamada WAHA:
- `requestId`
- `operation` = `"waha.health"`
- `durationMs`
- `status`
- Em erro: `errorCode`

Nunca registrar:
- `WAHA_API_KEY`
- `Authorization`
- Resposta sensível do WAHA

### Etapa 8 — Testes unitários

**Arquivo novo:** `services/whatsapp-api/test/waha-health.test.ts`

Casos de teste:
1. `GET /health` com WAHA offline → continua 200
2. `GET /internal/waha/health` sem Bearer → 401
3. Bearer inválido → 401
4. Bearer correto + WAHA saudável → 200
5. WAHA indisponível → 503 com `WAHA_UNAVAILABLE`
6. WAHA timeout → 504 com `WAHA_TIMEOUT`
7. WAHA auth inválida → não expõe segredo/detalhes internos

**Arquivo novo:** `services/whatsapp-api/test/waha-client.test.ts`

Mockar: 200, 401, 500, timeout, network error, JSON inválido.
Confirmar normalização correta.

### Etapa 9 — Instruções de validação no Docker

Comando para validar da rede Docker que o API alcança o WAHA:

```bash
docker exec <container-api> wget -qO- http://waha:3000/api/server/health
```

Não depender de porta pública.

---

## Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `services/whatsapp-api/src/config.ts` | Modificar | Adicionar `getWahaConfig()` |
| `services/whatsapp-api/src/integrations/waha/client.ts` | Criar | WahaClient central |
| `services/whatsapp-api/src/integrations/waha/types.ts` | Criar | Tipos e erros normalizados |
| `services/whatsapp-api/src/app.ts` | Modificar | Extrair auth guard, adicionar rota `/internal/waha/health` |
| `services/whatsapp-api/test/waha-health.test.ts` | Criar | Testes da rota |
| `services/whatsapp-api/test/waha-client.test.ts` | Criar | Testes do client |
| `services/waha-relay/docker-compose.yml` | Verificar | Confirmar rede compartilhada |
| `services/whatsapp-api/package.json` | Verificar | Dependências (não deve precisar de novas) |

---

## O que NÃO fazer nesta etapa

- ❌ Sessão por corretor
- ❌ QR Code
- ❌ Conexão do WhatsApp
- ❌ Página Config > WhatsApp
- ❌ Webhook WAHA
- ❌ Mensagens inbound
- ❌ sendText
- ❌ Disconnect
- ❌ Sessão multi-tenant
- ❌ Polling de QR
- ❌ Migrations do CRM
- ❌ Exp porta pública do WAHA
- ❌ Alterar Caddy
- ❌ Alterar `.env` real com segredo
- ❌ Deploy automático

---

## Checklist de segurança

- [ ] WAHA não exposto publicamente
- [ ] API key somente server-side
- [ ] `.env` ignorado pelo Git
- [ ] `.env` não entra na imagem Docker
- [ ] Rota Fastify protegida por `x-corretop-internal-token`
- [ ] Health não revela informação sensível
- [ ] Logs sem segredo

---

## Definition of Done

- [ ] WAHA auditado
- [ ] Comunicação Docker API → WAHA validada
- [ ] WahaClient central criado
- [ ] Timeout obrigatório aplicado
- [ ] Erros normalizados
- [ ] `GET /internal/waha/health` funcional
- [ ] Auth guard reutilizado
- [ ] `/health` independente do WAHA
- [ ] WAHA offline não derruba Fastify
- [ ] Nenhuma porta pública nova
- [ ] Nenhum secret no código
- [ ] Testes passando
- [ ] Instruções de deploy entregues
