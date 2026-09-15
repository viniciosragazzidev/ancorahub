# Meta oficial como único canal do tenant e WAHA pessoal do corretor

## Objetivo

Eliminar o envio corporativo pelo WAHA e impedir que ofertas recusadas continuem
na carteira do corretor ou sejam redistribuídas com o vínculo antigo.

## Escopo

- Toda mensagem oficial (template, texto, convite, oferta, atribuição,
  reatribuição e automação) é gravada e processada como `meta_only`.
- Linhas antigas da outbox são migradas de forma lazy durante o processamento,
  com `wahaNumberId` removido e seleção de canal Meta ativa.
- Cadências WAHA corporativas e conexões administrativas são recusadas no
  servidor; a conexão pessoal do corretor continua fora desse fluxo.
- O scheduler legado recebe o alias `/api/internal/cron/whatsapp`, apontando para
  o worker `/api/internal/jobs/whatsapp`.
- Recusa por webhook/button libera o lead atomicamente, zera `corretorId`,
  enfileira a distribuição e audita a decisão.

## Arquivos principais

- `src/features/communication-channels/outbound-service.ts`
- `src/features/automations/engine.ts`
- `src/features/notifications/send-push-helper.ts`
- `src/features/lead-distribution/offers.ts`
- `src/features/leads/decline-action.ts`
- `src/features/waha-cadence/service.ts`
- `src/app/api/internal/cron/whatsapp/route.ts`

## Validação

- Teste unitário de rota oficial confirma que configurações WAHA nunca alteram
  o destino de uma mensagem do tenant.
- Teste de política de recusa confirma remoção do corretor e reentrada em fila.
- Build/type-check e `npm run agent:verify -- --level full` devem ser executados
  antes do deploy no Coolify.

## Risco e rollback

O rollback de código pode reativar caminhos legados, portanto não é recomendado
sem uma nova decisão documentada. A mudança de outbox é reversível apenas por
operação administrativa auditada; dados de mensagens e histórico não são
apagados.
