# Correção de entrega do primeiro acesso e contrato Meta

## Objetivo

Garantir que convites de acesso de novos membros não fiquem presos atrás de
pendências antigas da outbox e que a situação `BROKER_WELCOME` em
`/qualificacao?tab=meta_templates` use `broker_first_access` como contrato padrão.

## Decisão aplicada

- O pós-resposta do convite processa exatamente o `whatsapp_outbound_messages.id`
  recém-enfileirado, com limite 1. O job agendado continua responsável por
  recuperação e drenagem das demais mensagens.
- `BROKER_WELCOME` aceita e resolve somente `broker_first_access` aprovado em
  `pt_BR`, sem mensagem livre ou contingência. A interface mostra o contrato
  protegido e preenche o padrão quando ainda não há política persistida.
- A regra é tenant-safe, mantém a outbox como fonte durável e continua auditada
  pelo fluxo existente de publicação/enfileiramento.

## Arquivos

- `src/features/team/broker-invitation-delivery.ts`
- `src/features/communication-channels/broker-lead-template-contract.ts`
- `src/features/communication-channels/templates.ts`
- `src/features/communication-channels/message-policy-service.ts`
- `src/features/communication-channels/template-sync-service.ts`
- `src/app/(dashboard)/qualificacao/_components/message-policies-panel.tsx`

## Validação

- Testes focados de comunicação, templates, resolver e convite: 25 testes aprovados.
- ESLint dos arquivos alterados: sem erros; avisos preexistentes de hooks/`any` permanecem.
- `npm run type-check`: bloqueado por `scripts/_tmp-diag2.ts:64` (arquivo de
  diagnóstico não relacionado, `p.userId` possivelmente nulo).
- `npm run agent:verify -- --level fast`: documentação válida; mesma falha de
  type-check registrada no relatório do harness.

## Rollback

Reverter este conjunto de arquivos restaura o lote pós-resposta anterior e a
configuração livre da situação. A outbox permanece compatível porque o terceiro
argumento de `processMetaOutboundBatch` já é suportado pelo worker.
