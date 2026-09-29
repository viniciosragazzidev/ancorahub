# Paginação e navegação instantânea de leads

## Objetivo

Eliminar requisições duplicadas ao paginar a lista de `/leads` e evitar que
projeções já carregadas (Kanban, qualificações, radar e perdidos) re-renderizem
todo o servidor apenas para trocar de categoria.

## Diagnóstico

- `useDataTable` atualizava `page` e `pageSize` com dois setters nuqs
  independentes para uma única mudança de paginação. Isso permitia duas
  navegações RSC concorrentes e mantinha a tabela em estado pendente.
- `LeadsWorkspace` chamava `router.replace` para todas as abas, embora apenas
  `sem-atribuicao` altere o conjunto de dados consultado no servidor.
- O reload completo não reproduzia a corrida dos setters, explicando a
  diferença percebida entre clicar na paginação e pressionar F5.

## Alterações

- Paginação agrupada em `useQueryStates`, garantindo uma única atualização de
  URL/RSC por ação.
- Troca entre abas locais atualiza o histórico do navegador sem novo fetch.
- Entrada e saída de `sem-atribuicao` continuam usando navegação RSC, pois
  exigem filtro e contagem server-side.
- Adicionado teste unitário para a classificação de views server-backed.

## Validação

- `npm run type-check` — aprovado.
- `npx vitest run "src/app/(dashboard)/leads/leads-view-navigation.test.ts" --pool=forks --maxWorkers=1` — 2 testes aprovados.
- `npm run agent:verify -- --level fast` — harness documental e type-check aprovados; suíte geral 160/161 arquivos e 744/745 testes, com a falha preexistente de `broker-lite-experience.test.tsx` (expectativa de `REPORTING_CENTER` ausente no código atual).
- Não foi possível executar um teste de browser autenticado contra a VPS neste ambiente; a medição de produção deve confirmar p95 da navegação após o próximo deploy.

