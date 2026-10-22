# Presença em plantões simultâneos

## Plano

Papel: corretor. Objetivo: identificar a escala correta ao confirmar presença e
acompanhar todos os plantões ativos ou iniciando nos próximos 30 minutos. A ação
principal continua sendo confirmar presença ou enviar a foto do local. Cada pedido
mostra o nome da escala; a escala pendente vem primeiro e, depois, a ordem é pelo
início. Um único pedido mantém a apresentação atual. O link presencial abre o
plantão correspondente.

Escopo: rótulo do lembrete Meta e do texto corporativo, página pública de
confirmação, resumo de plantões do corretor, início Lite, conversa Plantão e
`/plantoes/agora`. A regra de presença, o template aprovado, a distribuição e a
permissão de liberação manual permanecem iguais.

## Validação documental e de domínio

O pedido aprovado define a escala como unidade de confirmação. A escala pode
coincidir com outra; cada ação continua vinculada ao `assignmentId` da ocorrência.
Não há mudança de regra de negócio nem decisão pendente. A métrica de presença
mantém a janela atual: ocorrência ativa ou início em até 30 minutos.

Referências: DEC-119, BR-086, `docs/ux/UX_REDESIGN_CONTRACT.md`,
`docs/ux/UX_REDESIGN_CONTROL.md` e `docs/ux-clean-ui-audit.md`. O arquivo
`docs/ux-audit-2026-07-13.md` não existe nesta worktree.

## Verificações

Vitest focado: 9 arquivos e 98 testes passaram. `npx tsc --noEmit -p .`
passou. ESLint focado nos arquivos alterados passou. `git diff --check` passou.

O harness completo registrou documentação válida, zero achados de segurança e
TypeScript aprovado. A suíte geral terminou com 459 arquivos aprovados, 6 com
falha, 16 ignorados; foram 7 testes falhos entre consent-card, mention-live,
Meta Ads, planner mensal de plantão e dashboard, sob timeouts e falhas de
expectativa. `npm run lint` foi interrompido pelo detector de mojibake em três
arquivos fora desta alteração (`docs/business-rules.md`,
`src/features/leads/management-actions.test.ts` e
`src/features/reports/metrics/lead-quality-period.test.ts`). `npm run build`
falhou porque o Turbopack rejeitou o junction de `node_modules` fora da raiz.
Relatórios: `reports/agent/verification/2026-10-22T13-07-13.264Z.md` a
`reports/agent/verification/2026-10-22T13-11-54.349Z.md`. Entrega registrada
como parcial até validar a suíte e o build em ambiente compatível.
