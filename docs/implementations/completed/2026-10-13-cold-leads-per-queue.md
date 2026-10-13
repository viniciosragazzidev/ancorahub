# T121: reter leads frios por fila

## Regra confirmada

Quando `holdColdLeads` estiver ligado na política da fila, a distribuição automática daquele plantão mantém sem proprietário os leads cujo `qualification_status` seja exatamente `cold`. As demais temperaturas e estados continuam no fluxo existente. A atribuição manual a corretor escolhido pela gestão permanece permitida. Uma fila de contingência não pode retirar da fila de origem um frio retido.

## Implementação

- Persistir `holdColdLeads` no JSONB de `leadDistributionPolicies.policy`, padrão `false`, sem migration.
- Bloquear no serviço central antes de ofertas, roteamento DDD e contingência; classificar o motivo como retido para o worker.
- Expor e salvar a chave no editor/detalhe da fila; indicar frio retido no plantão, simulação e relatório de qualidade.
- Registrar mudança `de/para` no audit log `queue.updated`, com leituras filtradas por tenant.
- Registrar decisão e regra de negócio; sem flag global ou alteração de distribuição manual.

## Validação

- `npx vitest run src/features/lead-distribution/domain.test.ts src/features/lead-distribution/jobs.test.ts src/features/lead-distribution/cold-lead-hold.db.test.ts src/features/reports/metrics/lead-quality-simple.test.ts`: 71 testes passaram; o teste de banco opt-in foi executado separadamente.
- `RUN_COLD_LEAD_HOLD_DB_E2E=1 npx vitest run src/features/lead-distribution/cold-lead-hold.db.test.ts`: 1 teste de integração passou com transação revertida, cobrindo fila ligada/desligada, cold/warm/pending e contingência.
- `npx tsc --noEmit`: passou.
- ESLint dos arquivos TypeScript alterados: sem erros; um aviso preexistente `no-explicit-any` em `src/app/(dashboard)/leads/distribuicao/page.tsx:554`.
- `git diff --check`: passou. Suíte completa, `agent:verify` e build não executados conforme solicitado.
