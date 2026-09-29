# Implementação — Correção do fluxo de conexão QR WhatsApp (Corretor)

**Data:** 2026-09-14
**Estado:** Concluída (aguardando homologação com WAHA real + redeploy do Fastify no VPS)

## Problema reportado

Ao escanear o QR em `/conversas/broker`: a página não ficava conectada, o QR dava
como expirado e um erro era exibido — mesmo com o celular confirmando o pareamento.

## Causas (4 defeitos encadeados, já corrigidos)

1. **QR obsoleto renderizado** — `whatsapp-connect-dialog.tsx` preservava a imagem
   anterior (`qr.qrCode ?? current.qrCode`) quando o Fastify devolvia `qr: null`
   (QR rotacionado pelo WAHA WebJS a cada ~20–40s). O usuário escaneava um código
   morto → "código expirado" no celular → loop infinito.
   **Correção:** `success` com `qrCode: null` agora limpa a imagem e mantém o
   estado "Gerando QR Code…" em `pollStatus`, `refresh` e `start`.
2. **Janela pós-scan não mapeada** — `AUTHENTICATING` / `AUTHENTICATED` / `OPENING`
   viravam `DISCONNECTED` nos dois normalizadores (Fastify e CRM), derrubando a UI
   no momento exato do pareamento. **Correção:** mapeados para
   `WAITING_QR` / `initializing` (estado "conectando").
3. **Default otimista no contrato de webhook** — status de sessão desconhecido
   (`SCAN_QR_CODE`, `AUTHENTICATING`, …) virava `sessionStatus: "active"` →
   `ready` no banco, oscilando com eventos seguintes. **Correção:** default
   fail-safe `offline` em `contract.ts` (`normalizeWahaWebhookPayload`).
4. **Badge sem atualização viva** — `ConnectionBadge` era server-rendered estático;
   `revalidatePath` não altera árvore `force-dynamic`. **Correção:** polling
   client-side bidirecional (5s), sincronização com props do servidor e
   `router.refresh()` na transição para `ready`.

## Arquivos

- `services/whatsapp-api/src/integrations/waha/types.ts` (normalizador Fastify)
- `src/app/(dashboard)/settings/whatsapp-actions.ts` (normalizador CRM)
- `src/features/waha-cadence/contract.ts` (default fail-safe)
- `src/features/waha-cadence/inbound.ts` (sem mudança efetiva; statusMap já cobria `paused`)
- `src/components/whatsapp/whatsapp-connect-dialog.tsx` (QR nunca obsoleto)
- `src/features/broker-workspace/components/connection-badge.tsx` (badge vivo)

## Evidência de verificação

`reports/agent/verification/2026-09-14T19-30-00-qr-connection-fixes.md`
— `tsc` limpo; 16/16 testes `waha-cadence`; 73/73 testes do serviço Fastify;
ESLint sem erros nos arquivos tocados.

## Pendências

- **Redeploy do `services/whatsapp-api` no VPS** — a correção do normalizador do
  Fastify só vale em produção após o deploy do serviço.
- Homologação end-to-end: escanear QR real em WAHA e confirmar transição
  conectando → conectado sem reload.
