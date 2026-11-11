# Verificação da carteira Lite do corretor, C1

Data: 2026-11-11

Worktree: `ancorahub-carteira`
Escopo: lista `/clientes`, busca, recortes, filtros, URL e paginação. C2 foi atribuída à worktree `ancorahub-carteira-ficha`; nenhum arquivo de ficha foi alterado.

## Resultado focado

- `npx vitest run src/features/customers/broker-client-wallet.test.ts src/features/broker-workspace/components/broker-client-wallet.test.tsx`: passou, 2 arquivos e 9 testes.
- `npx tsc --noEmit`: passou.
- ESLint nos arquivos de rota, serviço, componente, testes e prévia C1: passou.
- `npx next build --webpack`: passou, Next 16.2.10. O build reportou aviso preexistente em `unpdf` ao acessar `import.meta` e aviso de serialização de strings grandes no cache webpack.
- `git diff --check`: passou.

## Harness e baseline

`npm run agent:verify -- --level fast` validou 18 referências documentais e concluiu o type-check. A suíte Vitest global abriu, mostrou falhas em testes preexistentes de vendas, distribuição, rotas Lite, snapshots do WhatsApp, calendário de plantões, comissões, Meta Ads e custom roles, e ficou sem novo progresso por mais de 1m40. Foi interrompida para não repetir uma execução global sem saída. O build webpack foi executado separadamente e concluiu com sucesso. Não foi executado `agent:verify --level full`.

`npm run lint:encoding` encontrou ocorrências preexistentes em `docs/business-rules.md`, `src/features/lead-distribution/monthly-duty-actions.ts`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`; nenhum arquivo C1 aparece nessa lista. Os arquivos de snapshot que ficaram modificados pela suíte global foram restaurados antes do commit.

## Capturas

As capturas estão em `reports/agent/carteira-corretor-lite/`: carteira 360, 390 e 1440 px; fim da lista 360 e 390 px; sheet de filtros 390 px; `c1-layout.json` registra larguras, scroll vertical, ausência de overflow horizontal e erros de console vazios. Todas usam dados sintéticos da prévia de desenvolvimento. Não foi aberta uma sessão autenticada contra produção para capturar dados reais.

## Banco

O build carregou `.env.local` e durante a enumeração de rotas registrou hostname e configuração do pool Supabase de produção. Nenhuma migration, SQL manual ou operação de escrita foi executada; a prévia C1 usa fixtures sintéticas. Nenhuma query operacional foi executada pela captura do navegador.
