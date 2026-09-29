# Owner provisório e entrega do template atual de novo lead

## Resultado observável

- Uma oferta válida vincula imediatamente o lead ao corretor selecionado com
  `assignmentSource=automatic_offer`, tornando-o visível na carteira para aceite.
- O aceite confirma a responsabilidade; recusa, expiração ou falha de enqueue
  liberam/rotacionam o vínculo sem sobrescrever atribuições concorrentes confirmadas.
- `LEAD_OFFER` e `LEAD_ASSIGNMENT` usam somente `new_lead_broker`; associações
  antigas, inclusive `lead_first_contact`, não substituem o contrato operacional.
- Cada aviso criado pelo fluxo de distribuição é processado pelo próprio
  `outboundMessageId`, impedindo que uma mensagem antiga da fila seja enviada no
  lugar da mensagem referente ao lead atual.

## Segurança e governança

Tenant, corretor e unidade continuam derivados e validados no servidor. A troca de
owner provisório é condicional, auditada e reconhecida pelo motor como reversível.
As políticas seguem editáveis na área de Situações, exceto pelo contrato obrigatório
dos dois eventos de novo lead definido na DEC-103.

## Validação

Testes de domínio cobrem o patch de owner provisório, contrato canônico e entrega
exata. Type-check, build e harness do agente são obrigatórios antes da conclusão.
