# Reatribuição e notificação oficial duráveis

## Objetivo

Corrigir a reatribuição em massa de leads já atribuídos e garantir que o template
`new_lead_broker` seja enfileirado antes da Server Action retornar.

## Escopo e arquivos

- `src/features/lead-distribution/service.ts`: permite a troca atômica de owner
  manual, com proteção contra concorrência e reinício do SLA.
- `src/features/leads/management-actions.ts`: aguarda o enfileiramento da
  notificação em vez de abandoná-la após a resposta.
- `src/features/notifications/broker-lead-whatsapp.ts`: remove entrega Meta síncrona
  da ação de atribuição.
- `src/app/api/internal/jobs/whatsapp/route.ts`: processa lote reduzido e previsível.

## Decisões

- O outbox persistente é a fronteira de durabilidade: ações de tela podem enfileirar,
  mas não entregam diretamente à Meta.
- `new_lead_broker` continua idempotente por atribuição e o erro de entrega não desfaz
  o owner já confirmado.

## Validações

- Teste do cliente Meta e type-check executados localmente.
- A compilação e o envio real ao destino autorizado serão confirmados no deploy de produção.

## Riscos e rollback

O primeiro envio passa a ocorrer pelo job de outbox, não dentro da resposta da tela.
Reverter o commit restaura o comportamento anterior, sem migração ou perda de mensagens
já persistidas.
