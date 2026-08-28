# Correção do contrato de templates para corretor

## Objetivo

Garantir que uma atribuição direta ao corretor enfileire apenas
`new_lead_broker` e que o aceite de uma oferta enfileire apenas
`lead_assignment_confirmed`, com os contratos aprovados na Meta.

## Escopo e arquivos

- `src/features/communication-channels/templates.ts`: separa finalidades,
  nomes de variáveis e botão URL.
- `src/features/communication-channels/template-sync-service.ts`: impede que
  vínculos configuráveis substituam os dois contratos operacionais do corretor.
- `src/features/lead-distribution/offers.ts`: preenche as seis variáveis do
  aviso de aceite e reserva o sétimo valor para o link do CRM.
- `src/features/communication-channels/outbound-service.ts`: lê o identificador
  do lead da posição correta ao enviar o botão.

## Decisões

- BR-029J e DEC-079: a atribuição gera aviso oficial idempotente sem desfazer
  a distribuição quando a entrega falha.
- Não há decisão nova: a mudança corrige a implementação para o contrato
  aprovado e já documentado.

## Validações

- Testes focados dos contratos e do resolvedor: 11 testes aprovados.
- Verificação do template sincronizado `lead_assignment_confirmed` no tenant,
  sem registrar dados pessoais: seis variáveis nomeadas e botão URL confirmado.
- Verificação completa e build de produção: publicação pendente.

## Riscos e rollback

Reverter o commit restaura somente a seleção e serialização dos templates. A
outbox, os leads, atribuições e auditorias permanecem preservados; mensagens
já enviadas não são reenviadas.
