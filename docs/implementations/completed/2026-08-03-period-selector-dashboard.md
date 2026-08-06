# Seletor de período 7/14/30/90 nas rotas de dados

**Data:** 2026-08-03
**Status:** Concluído

## Objetivo

Adicionar um seletor de período granular (7/14/30/90 dias) persistido em `?period=N`
às rotas do núcleo que exibem dados temporais, uniformizando as janelas fixas atuais
(all-time, 7d, 30d, 6 meses, mês atual) em um único controle por rota. Janelas
operacionais (hoje/ontem, SLA 15min/3d, horário-do-dia, health) permanecem fixas.

## Decisões confirmadas

- Escopo núcleo: `/dashboard` (+`/gestor`), `/noc`, `/vendas`, `/leads`, `/clientes`,
  `/relatorios`, `/financeiro`, `/metas`, `/unidades/[branchId]`.
- Uniformizar janelas agregadas → seletor. Financeiro mantém opção `all` (total geral).
- Persistência: URL `?period=30`. Visual: `ToggleGroup` pills (fallback pills `Button`).
- `/leads`: seletor filtra lista e contador (`createdAt >= periodStart`).
- `/financeiro`: seletor com opção `all` (total geral). `getFinancialDashboardData(period)`
  com janela rolling; `monthlyTrend` vira série diária N dias (mantém 6 meses mensais
  apenas com `all`); KPIs e totais de comissão/vendas seguem o período selecionado.
- NOC KPIs (`conversionRateMonth`,`avgTicketMonth`) viram rolling `period` (comparação
  período atual vs período anterior) — decisão confirmada; rótulos de UI ajustados
  de "Mês anterior" para "Período anterior".

## Arquivos

- **Novos:** `src/shared/period.ts`, `src/components/period-select.tsx`.
- **Rotas núcleo:** `dashboard/data.ts` + `dashboard/page.tsx`, `noc/queries.ts` +
  `noc/page.tsx` + `noc-client.tsx`, `vendas/page.tsx` + `sales-workspace.tsx`,
  `leads/page.tsx`, `clientes/page.tsx` + `clientes-list.tsx`,
  `relatorios/page.tsx`, `financeiro/queries.ts` + `financeiro/page.tsx`,
  `goals/components/goals-manager.tsx`, `branches/queries.ts` +
  `unidades/[branchId]/page.tsx`.
- **Docs:** `docs/decision-log.md` (DEC nova), `docs/features-log.md`.

## Riscos

- Base UI ToggleGroup single-select usa `value: Value[]` — validar contra
  `node_modules/@base-ui/react/toggle-group`.
- Queries all-time em `/leads`/`/clientes`/`/vendas` passam a ser limitadas por
  período — reduz contagens históricas na listagem (comportamento desejado).
- NOC KPIs de mês convertidos para rolling `period`. Implementado.

## Validação

`agent:verify --level fast` por ciclo; `--level full` antes de encerrar (evidência em
`reports/agent/verification/`); `tsc --noEmit` + lint; atualizar decision/features-log.

## Registro de verificação final

- `agent:verify --level full` (14:35): PASSOU `agent:docs`, `agent:changed`,
  `agent:architecture`, `agent:security`, `agent:performance`, `type-check`,
  `test` (231), `build` (Next.js 16, 74 rotas). `lint` FALHOU por dívida
  preexistente (325 erros / 644 warnings em arquivos fora do escopo, ex.
  `update_cards.js`). **Justificativa:** os arquivos alterados nesta tarefa não
  têm erro de lint (`npx eslint` específico limpo); os erros são anteriores e
  não relacionados ao seletor de período.
- A rota `/perfil` (tarefa anterior) foi consolidada em `/settings?tab=conta`
  com commit separado `2a8072ad` para destravar a verificação.