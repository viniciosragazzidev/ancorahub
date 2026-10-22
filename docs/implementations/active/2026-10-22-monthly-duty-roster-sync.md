# Sincronização entre escala semanal e escala mensal publicada

## Objetivo

Evitar que a ação de remover uma linha datada deixe o JSON do plano publicado desatualizado, bloqueie uma nova inclusão ou continue mostrando uma linha inativa como escalada.

## Regra e implementação

`duty_roster_assignments` continua sendo a fonte operacional da atribuição. Ao remover uma linha datada, a mesma transação e o lock por tenant também removem a referência por `rosterAssignmentId` ou por ocorrência e corretor do plano publicado e do rascunho mais novo. A inclusão só trata o corretor como presente se houver linha datada ativa; linha inativa é reativada e a entrada JSON é substituída por upsert.

Um único filtro de entradas vivas atende a leitura, a regeneração e a publicação: entradas legadas sem ID continuam válidas pela chave de ocorrência e corretor; entradas ligadas a uma linha só continuam válidas quando essa linha está ativa. A regeneração preserva o `rosterAssignmentId` das entradas mantidas e a publicação remove entradas obsoletas antes de criar linhas, evitando ressuscitar um corretor removido. O lock ocorre antes da leitura da linha semanal. Remover uma ocorrência já encerrada inativa a linha, mas preserva o JSON histórico.

Arquivos: `src/features/lead-distribution/roster-actions.ts`, `monthly-duty-actions.ts`, `monthly-duty-plan-assignments.ts` e testes de ações publicadas/notificações.

## Validação

Testes de regressão reproduziram os sintomas antes da correção. Validação final: Vitest da feature, 58 arquivos passaram, 8 foram ignorados; 454 testes passaram e 10 foram ignorados. Os testes específicos de publicação e notificação passaram (14/14). `npx tsc --noEmit -p .` e ESLint focado passaram.

O harness completo executado antes da segunda correção passou documentação, segurança e type-check; registrou dois diagnósticos de arquitetura e dois de desempenho, lint global bloqueado por texto corrompido preexistente em três arquivos fora deste escopo, e suíte completa com 23 arquivos falhos, 442 arquivos aprovados, 16 ignorados (29 testes falhos, 2689 aprovados e 19 ignorados). Relatório: `reports/agent/verification/2026-10-22T13-51-49.019Z.md`. `npm run build` foi tentado separadamente e falhou no Turbopack porque o symlink de `node_modules` aponta para fora da raiz do projeto.