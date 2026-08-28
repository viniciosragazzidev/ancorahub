# Janela comercial para distribuição e WhatsApp

## Objetivo

Limitar a distribuição automática entre corretores e o aviso oficial
`new_lead_broker` à janela de segunda a sexta, das 08:00 até antes de 18:00,
no fuso America/Sao_Paulo. Fora dela, o lead e o efeito de saída devem continuar
duráveis e retomar na próxima abertura, sem perda nem duplicação. Avisos para o
mesmo corretor devem respeitar dez minutos de intervalo e preservar o diagnóstico
seguro da falha de entrega da Meta.

## Escopo e arquivos

- `src/features/lead-distribution/jobs.ts`: agenda jobs e adia trabalho pendente
  fora da janela sem consumir tentativa.
- `src/features/leads/decline-action.ts`, `feedback-sla.ts` e
  `lead-distribution/service.ts`: encaminham redistribuições automáticas pela fila.
- `src/features/notifications/broker-lead-whatsapp.ts` e
  `communication-channels/outbound-service.ts`: agenda o aviso e revalida o
  corretor responsável antes da entrega, mantém cadência e evita envio paralelo ao
  mesmo corretor.
- `src/features/communication-channels/service.ts` e `types.ts`: retém código e
  título seguro da falha de entrega recebida no webhook Meta.
- `src/shared/time/business-hours.ts`: regra pura e testada de horário comercial.

## Decisões

- DEC-083 define a janela, a preservação de fila/outbox e a revalidação antes do
  envio; DEC-084 define cadência e diagnóstico seguro; BR-029M/N registram as
  regras operacionais.

## Validações

- `npx vitest run src/features/communication-channels/service.test.ts src/features/communication-channels/outbound-service.test.ts src/features/communication-channels/templates.test.ts src/shared/time/business-hours.test.ts src/features/lead-distribution/jobs.test.ts` — 17 testes aprovados.
- `npm run agent:docs` — documentação válida.
- `npm run type-check` e `npm run agent:verify -- --level fast` iniciaram a verificação, mas o `tsc --noEmit` não retornou nesta máquina antes do limite da sessão; os processos locais foram encerrados sem reportar erro.

## Riscos e rollback

Reverter as alterações de código restaura a execução imediata. Jobs e outbox já
persistidos permanecem recuperáveis; não há deleção de lead, alteração de canal ou
mudança de schema.
