# Upgrade do chat e da qualificação por IA

## Objetivo

Centralizar a governança, simulação e observabilidade da IA em `/qualificacao`,
preservando `/conversas` para atendimento humano. O plano completo está em
`ia_upgrade.md`.

## Escopo em execução

- qualificação determinística e guardrails de extração;
- contrato de encerramento confirmado pelo provedor antes de `WAITING_HUMAN`;
- regras de follow-up apenas preparadas, sem execução externa;
- remoção da configuração duplicada em `/settings`;
- preparação posterior de RAG vetorial escopado por tenant.

## Decisões aplicadas

- `/conversas` não recebe configuração de IA;
- resposta automática somente após inbound oficial;
- follow-up não dispara sem decisão LGPD/Meta;
- RAG é contexto permitido, nunca fonte de decisão operacional ou promessa comercial.

## Riscos e rollback

- `0127_ai_qualification_followup_prepared_only` desativa regras existentes por
  segurança; reativação futura exigirá decisão de produto, worker, templates e
  auditoria, não mera alteração de banco.
- O fechamento mantém estado recuperável quando o provider não retorna confirmação;
  não há transição para atendimento humano simulada.
- As flags existentes preservam a reversão de novas automações sem apagar histórico.

## Evidência parcial

- `npx vitest run 'src/features/tenant-intelligence/tenant-intelligence.test.ts' 'src/app/(dashboard)/qualificacao/page.test.tsx' src/features/ai-agent/qualification-flow.test.ts src/features/ai-qualification/followup-service.test.ts --reporter=dot`
  passou com 32 testes.
- `npx tsc --noEmit` passou.
- `npm run agent:verify -- --level fast --task "upgrade chat qualification IA"` passou; a evidência está em `reports/agent/verification/2026-08-15T13-19-17.345Z.md`.
