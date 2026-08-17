# Notificação de lead atribuído ao corretor

## Escopo

Cada atribuição concluída de lead enfileira o template Meta `new_lead_broker` para
o corretor responsável. O fluxo não reutiliza `lead_offers`: uma oferta de aceite
continua sendo uma operação distinta da notificação de uma atribuição já concluída.

## Contrato

- Corpo nomeado: `cargo`, `corretor_nome`, `lead_nome`, `produto_interesse`.
- Botão URL dinâmico: somente o identificador do lead, fora das variáveis do corpo.
- A chave de idempotência inclui a versão `assigned_at`; outra atribuição do mesmo
  lead ao mesmo corretor gera nova mensagem, e retries da mesma atribuição não.
- A capacidade global `notification_capability_lead_assignment_enabled` é o
  kill switch auditável e reversível pelo Super-admin para push, in-app e WhatsApp.
- O registro em `whatsapp_outbound_messages` e a auditoria são persistidos antes
  da tentativa de envio; indisponibilidade externa não desfaz a atribuição.

## Validação prevista

- Contrato do template e variáveis nomeadas.
- Payload Cloud API com quatro variáveis de corpo e `lead_id` no botão.
- Type-check, harness e build de produção.
