# Plano — Fase 20.4: Sessão WAHA Real por Corretor

**Branch:** `feat/waha-per-broker-session`
**Pré-requisito:** Fases 1-2 (WahaClient + sessão de teste) implementadas
**Data:** 2026-08-20
**Status:** Planejamento

---

## Contexto da auditoria

### O que já existe

| Componente | Estado | Detalhe |
|------------|--------|---------|
| Tabela `whatsapp_connections` | ✅ Existe | `tenantId`, `userId`, `sessionId`, `sessionName`, `status`, `qrCode`, `webhookSecret`, `chatInternoAtivo`, `connectedAt` |
| Unique index `tenant_user` | ✅ Existe | `tenantId + userId` (com `WHERE user_id IS NOT NULL`) |
| `whatsapp-actions.ts` | ⚠️ Legado | Fala com **OpenWA** (não WAHA), usa `OPENWA_BASE_URL` |
| `whatsapp-connect-dialog.tsx` | ⚠️ Legado | UI funcional mas acoplada ao OpenWA |
| WAHA relay (`services/waha-relay/`) | ✅ Existe | Relay HMAC entre CRM e WAHA |
| `whatsapp-api` (Fastify) | ✅ Fases 1-2 | WahaClient, health, sessão de teste |
| Tabela `waha_numbers` | ✅ Existe | Para números platform-owned, não por corretor |

### O que precisa mudar

O fluxo atual usa **OpenWA** (WhatsApp Web.js). A Fase 20.4 migra para **WAHA** (Evolution API-like). A tabela `whatsapp_connections` já existe e pode ser reutilizada — apenas `sessionName` precisa ser gerado pelo backend.

---

## Arquitetura alvo

```
Browser (Config > WhatsApp)
    ↓
Next Server Action (resolve tenant + user)
    ↓
Fastify/VPS (POST /internal/waha/connections)
    ↓
WahaClient → WAHA interno
    ↓
QR / Status / Connect
```

---

## Etapas de implementação

### Etapa 1 — Migrar `whatsapp-actions.ts` para falar com WAHA

**Arquivo:** `src/app/(dashboard)/settings/whatsapp-actions.ts`

Mudar o provider de OpenWA para WAHA. O WAHA fala com o relay (`services/waha-relay/`), que por sua vez fala com o WAHA interno.

**Novo fluxo:**
- `startWhatsAppConnection()` → chama `POST /internal/waha/connections` no Fastify
- `refreshWhatsAppQr()` → chama `GET /internal/waha/connections/:id/qr` no Fastify
- `getWhatsAppSessionStatus()` → chama `GET /internal/waha/connections/:id/status` no Fastify
- `resetWhatsAppSessionAction()` → chama `POST /internal/waha/connections/:id/disconnect` no Fastify

**Variáveis de ambiente:**
- `VPS_API_URL` (já existe)
- `VPS_INTERNAL_API_TOKEN` (já existe)

### Etapa 2 — Adicionar endpoint `POST /internal/waha/connections` no Fastify

**Arquivo:** `services/whatsapp-api/src/app.ts`

**Recebe:**
```json
{
  "tenantId": "...",
  "userId": "...",
  "sessionName": "waha_<hash>"
}
```

O `sessionName` é gerado pelo **Next Server** (nunca pelo browser):
```ts
const sessionName = `waha_${createHash("sha256").update(`${tenantId}:${userId}`).digest("hex").slice(0, 16)}`;
```

**Fluxo:**
1. Procurar conexão existente no WAHA pelo `sessionName`
2. Se existe → reutilizar
3. Se não existe → criar sessão via WahaClient
4. Iniciar sessão
5. Retornar `{ ok: true, connectionId, status }`

**Auth:** `x-corretop-internal-token` (reutilizar auth guard existente)

### Etapa 3 — Adicionar endpoint `GET /internal/waha/connections/:id/status`

**Arquivo:** `services/whatsapp-api/src/app.ts`

**Fluxo:**
1. Buscar sessão no WAHA pelo `sessionName` derivado do `connectionId`
2. Normalizar status
3. Retornar `{ ok: true, status, phoneNumber, displayName }`

### Etapa 4 — Adicionar endpoint `GET /internal/waha/connections/:id/qr`

**Arquivo:** `services/whatsapp-api/src/app.ts`

**Fluxo:**
1. Buscar sessão no WAHA
2. Se `WAITING_QR` → obter QR via `wahaClient.getQr()`
3. Retornar `{ ok: true, status, qr }`

### Etapa 5 — Adicionar endpoint `POST /internal/waha/connections/:id/disconnect`

**Arquivo:** `services/whatsapp-api/src/app.ts`

**Fluxo:**
1. Parar sessão via `wahaClient.stopSession()`
2. Deletar sessão via `wahaClient.deleteSession()`
3. Retornar `{ ok: true, status: "DISCONNECTED" }`

### Etapa 6 — Gerar `sessionName` no backend

**Arquivo:** `src/app/(dashboard)/settings/whatsapp-actions.ts`

Nunca enviar `sessionName` do browser. Gerar no servidor:
```ts
import { createHash } from "node:crypto";

function generateWahaSessionName(tenantId: string, userId: string): string {
  return `waha_${createHash("sha256").update(`${tenantId}:${userId}`).digest("hex").slice(0, 16)}`;
}
```

### Etapa 7 — Atualizar `whatsapp-connect-dialog.tsx`

**Arquivo:** `src/components/whatsapp/whatsapp-connect-dialog.tsx`

Mudar para chamar as novas server actions que falam com o Fastify/WAHA. A UI pode permanecer similar, mas:

- Status mapping: `WORKING` → `ready`, `SCAN_QR_CODE` → `qr_ready`, `STARTING` → `initializing`
- QR format: WAHA retorna base64 data URL (já tratado no WahaClient)
- Polling: manter existente (700ms interval), mas com os novos endpoints

### Etapa 8 — Garantir isolamento por corretor

A tabela `whatsapp_connections` já tem unique index em `(tenantId, userId)`. Isso garante:
- Um corretor = uma sessão
- Cliques repetidos reutilizam a sessão existente
- Corretor A não vê QR/status de Corretor B

### Etapa 9 — Testes

**Arquivo novo:** `services/whatsapp-api/test/waha-connection.test.ts`

Casos de teste:
1. Criar conexão → retorna status
2. Criar conexão duplicada → reutiliza existente
3. Status de conexão → retorna status normalizado
4. QR quando `WAITING_QR` → retorna QR
5. QR quando `CONNECTED` → retorna status sem QR
6. Disconnect → retorna `DISCONNECTED`
7. Sem auth → 401
8. WAHA offline → erro controlado

### Etapa 10 — Validação de segurança

- [ ] `sessionName` nunca vem do browser
- [ ] `tenantId` e `userId` vêm do contexto de sessão (não do request)
- [ ] Rota Fastify protegida por `x-corretop-internal-token`
- [ ] QR não aparece em logs
- [ ] API key nunca retorna em response
- [ ] Corretor A não acessa conexão de Corretor B

---

## Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `services/whatsapp-api/src/app.ts` | Modificar | Adicionar 4 rotas de conexão |
| `src/app/(dashboard)/settings/whatsapp-actions.ts` | Modificar | Migrar de OpenWA para WAHA |
| `src/components/whatsapp/whatsapp-connect-dialog.tsx` | Modificar | Adaptar para novos endpoints |
| `services/whatsapp-api/test/waha-connection.test.ts` | Criar | Testes das rotas |

---

## O que NÃO fazer nesta etapa

- ❌ Receber mensagens
- ❌ Criar conversas
- ❌ Sincronizar histórico
- ❌ Enviar mensagem pelo chat interno
- ❌ Webhooks de message
- ❌ Mídia
- ❌ Sessão multi-tenant (1 número por tenant)
- ❌ UI definitiva do CRM (apenas adaptar existente)

---

## Definition of Done

- [ ] Corretor pode conectar WhatsApp via Config > WhatsApp
- [ ] QR exclusivo por corretor
- [ ] Scan → CONNECTED
- [ ] Registro persistido no CRM
- [ ] Corretor B tem sessão completamente separada
- [ ] Sobrevive a reload
- [ ] Sobrevive a logout/login
- [ ] Sobrevive a restart do container
- [ ] Duplo clique não cria sessão duplicada
- [ ] QR expirado tratado
- [ ] Testes passando
- [ ] Nenhum secret no código
