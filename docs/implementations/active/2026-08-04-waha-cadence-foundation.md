# Fundação da Cadência WAHA

## Objetivo

Preparar uma Cadência WhatsApp segura e reversível, operada por uma frota WAHA na VPS,
sem alterar o canal oficial Meta e sem permitir acesso do relay ao banco do CRM.

## Escopo e arquivos

- `drizzle/0101_waha_cadence_foundation.sql` e `src/shared/db/schema.ts`: frota global,
  cadências versionadas, execuções, outbox, supressões e ledger de webhook.
- `src/features/waha-cadence/`: contrato HMAC, política de conteúdo, relay client,
  processamento de outbox e inbound idempotente.
- `src/app/api/webhooks/waha` e `src/app/api/internal/jobs/waha-cadence`: fronteiras
  autenticadas para o relay e o worker.
- `services/waha-relay/`: imagem e compose isolados para a VPS.
- Configurações do Super-admin: kill switches, retry e lease, todos desligados por padrão.

## Decisões

- ADR-0037 formaliza VPS exclusiva, frota global e separação entre WAHA e Meta.
- A IA somente é chamada após inbound WAHA e apenas para lead associado; as respostas são
  enfileiradas na outbox. A autonomia segue DEC-054.
- Mensagens são limitadas por definição de cadência e contatos suprimidos são bloqueados
  globalmente pelo hash do telefone.

## Validações

- `npm test -- --run src/features/waha-cadence/contract.test.ts`: 4 testes aprovados.
- `node --check services/waha-relay/server.mjs`: aprovado.
- `npx tsc --noEmit --pretty false --incremental false`: aprovado.
- `npm run build`: aprovado em 2026-08-04; incluiu as rotas WAHA.
- `npm run agent:verify -- --level full` e lint global excederam o limite local de dois
  minutos sem diagnóstico final; não foram tratados como aprovação.

## Riscos e rollback

`feature_waha_cadence_enabled=false` interrompe processamentos novos sem apagar fila ou
auditoria. `feature_waha_ai_enabled=false` bloqueia somente respostas automáticas.
Antes de produção, aplicar migration, testar o adaptador de webhook nativo do WAHA e
homologar com dados sintéticos, persistência de sessão, reinício, replay e indisponibilidade.
