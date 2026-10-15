# Requalificar leads frios

## Objetivo

Dar ao Diretor uma fila de revisao dos leads frios do dia operacional e permitir
requalificacao manual ou automatica pelo fluxo oficial de WhatsApp existente.

## Mapa do fluxo atual

- `src/features/ai-agent/qualification-timeout-sweep.ts:180-181,220-245`: inbound
  durante qualificacao leva a `warm`; ausencia de resposta apos o timeout marca `cold`.
- `scripts/fix-whatsapp-no-reply-temperature.mjs:56-70,90-101`: corrige leads
  Meta/WhatsApp sem mensagem inbound apos a criacao.
- `src/features/lead-distribution/domain.ts:86-109` e
  `src/features/lead-distribution/service.ts:708-735`: `holdColdLeads` da fila
  retém leads frios sem corretor (T121).
- `src/features/ai-qualification/cold-lead-reactivation-sweep.ts` e
  `src/features/ai-qualification/service.ts:274-343,409-443`: reenvio oficial,
  opt-out e numero invalido; inbound ainda sem owner reabre a qualificacao.
- `src/features/qualification-engine/cold-lead-reopen.ts:11-49`: reabertura
  encaminha a resposta a maquina oficial.
- `src/features/reports/metrics/lead-quality-period.ts:138-142`:
  `operationDayStart` define o inicio do dia operacional as 19h.

## Decisoes

DEC-144 foi registrada em `docs/decision-log.md`; BR-082 em
`docs/business-rules.md`. A UI sera uma secao da aba Filas da Central de
Distribuicao, disponivel ao Diretor. A configuracao usa o JSONB de politica ja
existente; tentativas usam o ledger de WhatsApp. A cadencia nasce desligada,
com intervalo padrao de 2h e limite de 3 tentativas; janela 08h-20h todos os
dias em `America/Sao_Paulo`. Manual inclui frios que responderam, mas a
automacao so envia quando nao ha inbound apos o ultimo convite. Reenvio
idempotente respeita o intervalo. O lead continua frio ate responder, mantendo
T121 ativo.

## Escopo tecnico

- Politica da fila validada, lida e salva no JSONB existente; nenhuma migration.
- Servico com lista por dia operacional, segmentacao por inbound, autorizacao do
  Diretor, envio Meta FIRST_CONTACT, idempotencia, lock de cron e auditoria.
- Reaproveitamento do job interno existente de timeout/reativacao.
- Testes unitarios para selecao, idempotencia, tentativas, horario, opt-out e lock.

## Validacao

Pendente ate implementacao: Vitest focado, `npx tsc --noEmit -p .`, ESLint focado
e `npm run agent:verify -- --level full`. Nao usar banco real, aplicar migration
ou iniciar servidor conectado a banco.

## Rollback

Desligar `coldLeadRequalification.enabled` nas filas e a chave global do
Super-admin. O fluxo de qualificacao inbound existente permanece ativo.
