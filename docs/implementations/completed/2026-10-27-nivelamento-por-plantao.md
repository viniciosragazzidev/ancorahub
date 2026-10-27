# Nivelamento de distribuição por plantão

## Objetivo

Evitar que indicações recebidas em um plantão reduzam a prioridade do corretor em outro. A regra continua usando o dia da operação definido pela DEC-154.

## Causa

As contagens somavam atribuições, tentativas e ofertas de todos os plantões do corretor. Assim, o volume recebido em uma fila PME podia penalizar a participação do mesmo corretor em um plantão presencial.

## Escopo entregue

- `received-in-day.ts` agora seleciona o `duty_schedule_id` em cada fonte e conta somente o plantão informado para cada corretor. Sem plantão informado, considera somente registros com `duty_schedule_id` nulo.
- A pré-leitura de `service.ts`, a releitura serializada em `offers.ts` e a simulação de `control-service.ts` recebem o mesmo mapa de plantões.
- Cada lead continua contado uma vez por corretor; janela operacional e exclusão de ofertas `CANCELLED` permanecem iguais.
- DEC-154 e os comentários de domínio descrevem o escopo isolado por plantão.

## Arquivos e fluxos

- `src/features/lead-distribution/received-in-day.ts`
- `src/features/lead-distribution/received-in-day.test.ts`
- `src/features/lead-distribution/offers.ts`
- `src/features/lead-distribution/service.ts`
- `src/features/lead-distribution/control-service.ts`
- `docs/decision-log.md`
- `docs/features-log.md`

## Validação

- `npx vitest run src/features/lead-distribution/received-in-day.test.ts --maxWorkers=1`: passou, 11 testes.
- `npx tsc --noEmit -p .`: passou.
- `npx eslint` nos seis arquivos TypeScript alterados e `git diff --check`: passaram.
- `npm run agent:docs`: passou, 18 referências verificadas.
- `npm run build`: o Turbopack parou por rejeitar a junction externa de `node_modules`. `npx next build --webpack` passou; houve o aviso preexistente de `unpdf` e avisos de rotas dinâmicas durante a coleta estática.
- `agent:verify` não foi executado porque chama `npm run test` sem filtro e incluiria `*.db.test.ts`, proibidos nesta tarefa.

## Risco e reversão

O filtro de escopo usa os IDs de escala já resolvidos pelo serviço de distribuição; ausência de ID representa escolha sem plantão e só inclui linhas com `duty_schedule_id` nulo. Reversão: reverter o commit desta correção e restaurar o critério anterior da DEC-154.
