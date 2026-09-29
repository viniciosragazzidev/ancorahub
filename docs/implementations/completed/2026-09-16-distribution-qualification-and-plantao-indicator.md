# Distribuição pós-qualificação e indicador de plantão em leads

Data: 16 de setembro de 2026

## Objetivo

Garantir que respostas terminais da qualificação não deixem um lead real órfão
na fila interna e que a tabela de `/leads` sinalize, ao lado do corretor, quando
ele está escalado em um plantão ativo no momento da consulta. Respostas curtas
com números por extenso preenchem `numberOfLives` e avançam a próxima pergunta
sem repetir o campo.

## Escopo implementado

- O parser de memória reconhece números por extenso em português (incluindo
  respostas como “É só uma pessoa” e “Duas vidas”), somente no contexto de uma
  pergunta de quantidade de vidas.
- Respostas terminais (`OPT_OUT`, `NO_LONGER_INTERESTED` e `WRONG_NUMBER`)
  interrompem a automação, mas reenfileiram o lead no motor durável e fazem uma
  tentativa imediata. O bloqueio de mensagens ao contato opt-out permanece
  intacto.
- A tabela de `/leads` recebe um snapshot tenant-scoped das escalas ativas e
  exibe o corretor em âmbar com o badge compartilhado “Plantão ativo”, sem
  consulta por linha.
- A origem `qualification_completed` foi adicionada ao job para auditoria e
  rastreabilidade.

## Decisões e segurança

Nenhuma decisão nova foi criada. O comportamento segue BR-029I, BR-029M,
BR-029S e DEC-078/DEC-104: qualificação concluída ou interrompida usa o mesmo
motor durável, respeitando elegibilidade, plantão, disponibilidade, tenant e o
hold global de desqualificados. Mensagens enviadas por atendente humano não são
convertidas silenciosamente em fatos do cliente; alterações manuais continuam
explícitas na superfície de qualificação.

## Validação final

- Testes focados: 5 arquivos, 81 testes aprovados.
- `git diff --check`: aprovado.
- `npm run agent:verify -- --level fast`: documentação aprovada; o type-check
  parou nos dois erros preexistentes de `scripts/_tmp-diag2.ts` e
  `src/features/roadmap/roadmap-data.ts`.
- `npm run build`: compilação Turbopack concluída; a etapa TypeScript foi
  interrompida pelo mesmo erro preexistente em `scripts/_tmp-diag2.ts`.
- O erro de tipagem desta alteração (`gt`/`lte` ausentes em `leads/page.tsx`)
  foi corrigido; não restam erros introduzidos por este conjunto.
- Evidência do harness:
  `reports/agent/verification/2026-09-16T16-14-25.269Z.md`.

## Rollback

Reverter os arquivos listados no commit. Não há migration nem alteração
destrutiva de dados; jobs persistidos continuam recuperáveis pelo worker e o
indicador de plantão é derivado em leitura.
