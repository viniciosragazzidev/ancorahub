# Reparo da sincronização bidirecional do WAHA

## Objetivo

Restaurar a persistência de mensagens recebidas e das mensagens enviadas fora do
CRM (celular e WhatsApp Web), sem alterar a configuração já validada do WAHA ou
o fluxo de envio do CRM.

## Diagnóstico e causalidade

O relay Fastify em `corretop-infra/api/waha-routes.js` rejeitava um payload
nativo reduzido quando o envelope não possuía `id`, mesmo quando `payload.id`
identificava a mensagem. A rota respondia `202 accepted / unsupported_event`
antes de encaminhar o evento ao CRM. Isso foi reproduzido contra o código que
está em produção no commit `1f08edc`.

O contrato público atual do WAHA documenta um envelope completo com `id` do
evento. Portanto, a reprodução com payload reduzido confirma uma lacuna de
compatibilidade, mas **não confirma isoladamente** que essa seja a causa dos
eventos reais perdidos. A confirmação de causalidade exige uma captura segura de
um evento real pelo Event Monitor do WAHA ou pelo log estruturado do relay após
a homologação. O relay também não preservava o metadado opcional `source`.

## Entrega

- O relay usa o identificador da mensagem como fallback seguro para `eventId`.
- `message` e `message.any` preservam `message.id`, `fromMe`, `to` e `source`.
- Timestamps WAHA em segundos ou milissegundos são normalizados corretamente.
- O CRM aceita o metadado `source`, mantém deduplicação por
  `(tenant_id, message_id)` e trata confirmações externas de saída como `sent`.
- Uma mensagem de saída não atualiza `inboundAt` de cadência.
- Logs registram somente metadados operacionais e hash curto do contato; não
  registram telefone ou conteúdo.

## Segurança e escopo

Tenant e conexão continuam resolvidos exclusivamente pela sessão WAHA persistida.
`source` é apenas metadado de observabilidade/reconciliação e não concede escopo
ou autorização. Não houve migration nem mudança de WAHA, banco, RLS ou credenciais.

## Validações

- `node --test waha-routes.test.js` no repositório de infraestrutura, incluindo
  envelope oficial completo e payload reduzido reproduzido.
- `npx vitest run src/features/waha-cadence/contract.test.ts src/features/waha-cadence/inbound.test.ts` no CRM.
- Pendente: build completo dos dois repositórios, captura controlada de evento
  real no WAHA e homologação na VPS após aprovação explícita de deploy.

## Rollback

Reverter os commits do CRM e da infraestrutura retorna o relay ao contrato
anterior. Não há dado ou configuração irreversível nesta entrega.
