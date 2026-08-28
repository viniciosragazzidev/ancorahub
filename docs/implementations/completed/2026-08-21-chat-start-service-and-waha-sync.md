# 2026-08-21 — Envio pós-atribuição e sincronização de mensagens do corretor

## Objetivo

Eliminar dois bloqueios de atendimento relatados em produção:

1. Corretor dono de lead recém-atribuído (`status = distributed`) recebia
   "Inicie o atendimento antes de enviar mensagens" ao responder pelo chat.
2. Mensagens enviadas do celular do corretor (sessão WAHA sincronizada) não
   apareciam em `/conversas/brokers`, mesmo com F5.

## Escopo

- `src/features/leads/start-service-on-message.ts` (novo): transição
  transacional e idempotente `distributed → in_contact` quando o corretor
  dono envia a primeira mensagem; grava interação e auditoria
  (`iniciou_atendimento_primeira_mensagem`) e encerra o
  `leadAssignmentAttempts` aberto (mesma semântica do botão Iniciar
  Atendimento, DEC-027).
- `src/features/leads/actions/send-lead-message.ts`: o gate de
  `distributed` passou a disparar o auto-aceite acima em vez de bloquear;
  notificação `lead_service_started` ao próprio corretor (best-effort).
  Corretores que não são donos e gestão continuam com o comportamento
  anterior.
- `src/features/waha-cadence/inbound.ts`:
  - `resolveContact` agora casa telefone com semântica `samePhone`
    (sufixo tolerante): pré-filtro SQL por `LIKE` nos últimos 8 dígitos +
    confirmação em memória. Leads/clients armazenados com `+55`, traços ou
    parênteses voltam a resolver.
  - Mensagens `fromMe` sem lead/client passam a persistir quando o
    destinatário é o número oficial do tenant (thread Lite "número
    oficial"); verificação extraída para `isTenantOfficialNumberPhone`
    (reutilizada pela supressão de lead sintético). Demais outgoing sem
    vínculo continuam ignorados (`outgoing_no_lead`).

## Decisões

- A primeira mensagem é forma válida de iniciar atendimento (paralelo ao
  botão explícito); a transição é condicional (`status/corretorId`) e
  segura contra corrida.
- Nenhuma mensagem do corretor para o número oficial cria lead sintético;
  ela alimenta exclusivamente a thread oficial no Lite.
- O refresh automático da tela já existia (`publishDomainInvalidation`
  "conversations", DEC-081); a correção era a persistência, não o
  refresh.

## Validação

- `npx tsc --noEmit` limpo nos arquivos tocados (erros restantes são a
  dívida pré-existente de `react-aria-components` em `src/components/base`).
- `npx eslint` sem achados nos três arquivos.
- `npx vitest run src/features/waha-cadence` — 6 testes OK.
- `npx vitest run src/features/leads` — 81 testes OK.

## Diagnóstico pendente (operação)

Confirmar entrega do relay consultando `waha_webhook_events`
(`status`, `error_code`, `payload->>'type'`) para o período do teste. Se os
eventos `message.inbound` com `fromMe: true` não chegarem, a lacuna está no
serviço Fastify/WAHA (webhook registration), não no CRM.

## Rollback

Reverter os três arquivos; nenhum schema/migration envolvido.
