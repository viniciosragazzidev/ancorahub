# 2026-09-15 — Reconciliação de mensagens móveis do WAHA

## Diagnóstico

O payload nativo de `message.any` do WAHA pode carregar `fromMe` dentro de
`payload.id` como objeto. O normalizador lia apenas `payload.fromMe`; por isso
mensagens enviadas pelo aplicativo móvel eram classificadas como recebidas e
podiam ser descartadas pelo guard de contato do corretor. Também não havia uma
rota para recuperar o histórico quando uma sessão antiga não entregava o
webhook.

## Implementação

- O contrato canônico lê `fromMe` e `_serialized` tanto do campo direto quanto do
  objeto `payload.id`.
- O Fastify ganhou `POST /internal/waha/messages/history`, com autenticação
  interna, sessão conectada, limite de chats/mensagens e normalização de
  `@c.us`.
- O CRM ganhou `GET|POST /api/internal/jobs/waha-sync`. Ele consulta somente
  conexões `ready`, leads não excluídos atribuídos ao usuário da conexão e usa o
  mesmo `ingestWahaWebhook` do caminho ao vivo. A deduplicação e a autorização
  existentes continuam sendo a única fonte de persistência.
- `/conversas/broker` e `/conversas` continuam consumindo `whatsappMessages`,
  portanto mensagens móveis de entrada e saída ficam visíveis nos dois escopos;
  a central Lite só lista contatos que já têm ao menos uma mensagem.
- A análise de inteligência conversacional aguarda 60 segundos após a última
  mensagem; o motor mantém provedor/modelo configurados pelo administrador e
  seus fallbacks existentes.
- No modo Lite do corretor, o telefone não é exibido nem copiável no computador,
  há uma única ação “Abrir WhatsApp” e orientação para conectar via QR Code em
  `/integrations/whatsapp`.

## Operação

O procedimento de criação da Scheduled Task está em
`docs/runbooks/coolify-waha-message-sync-scheduler.md`. A ativação é externa ao
repositório e deve ser feita no Coolify com `CRON_SECRET` compartilhado.

## Validação

- Testes do contrato WAHA e relay: aprovados.
- Testes do cliente Fastify, incluindo histórico: aprovados.
- Type-check e build dos serviços devem ser registrados no relatório de
  verificação desta entrega.

## Rollback

Reverter este commit remove somente a reconciliação de histórico, mantendo o
webhook e o armazenamento já existentes. Nenhuma migration ou credencial foi
alterada.
