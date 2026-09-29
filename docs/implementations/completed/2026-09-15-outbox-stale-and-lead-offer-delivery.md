# Proteção da outbox e entrega imediata de oferta de lead

## Escopo entregue

- Mensagens oficiais `queued`/`pending` antigas são canceladas antes da seleção
  do worker, com janela padrão de 24 horas configurável pelo Super-admin.
- Cancelamentos por atraso e por oferta expirada/inativa preservam o histórico,
  registram código de erro seguro e criam auditoria operacional.
- Ofertas de `newLeadAssignment` são revalidadas no momento do envio para impedir
  que um lead já aceito, recusado ou expirado seja enviado depois.
- A oferta recém-criada é processada pelo próprio `outboundMessageId`, evitando
  espera atrás de uma fila antiga; o cron permanece como recuperação.
- Atribuições manuais usam a mesma entrega pelo identificador exato, em vez de
  `scheduleAfterResponse` com lote genérico.
- A limpeza de mensagens antigas fica restrita ao processamento em lote; uma
  entrega exata não percorre o backlog antes de enviar a oferta nova.
- Avisos de reatribuição usam chave de idempotência estável para impedir múltiplos
  envios gerados por retries do mesmo evento.

## Arquivos principais

- `src/features/communication-channels/outbound-service.ts`
- `src/features/lead-distribution/offers.ts`
- `src/features/notifications/send-push-helper.ts`
- `src/app/(platform-admin)/super-admin/actions.ts`
- `src/app/(platform-admin)/super-admin/settings/page.tsx`

## Configuração e rollback

O Super-admin pode ajustar `whatsapp_outbox_stale_after_hours` entre 1 e 168
horas. A alteração é auditada. Para rollback operacional, aumente o valor; as
mensagens já canceladas permanecem canceladas para evitar envio tardio.

## Validação

Testes focados, type-check, lint dirigido e build de produção devem ser executados
antes do deploy. A homologação Meta real continua dependente do canal ativo,
template aprovado e credenciais válidas.
