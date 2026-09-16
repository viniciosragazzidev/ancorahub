# Plantões com múltiplos dias da semana

## Objetivo

Permitir que a criação de um plantão selecione vários dias da semana sem alterar o
contrato operacional existente do motor de distribuição.

## Decisão de implementação

`unit_duty_schedules` continua representando uma regra para um único dia. O
formulário envia uma lista de dias e a Server Action expande cada combinação de
unidade, fila e dia em uma regra independente dentro da mesma transação. Isso
preserva a consulta diária do motor, a cobertura, a escala e a auditoria por regra,
sem migração de banco ou array em coluna.

A edição permanece unitária: cada regra exibida na grade semanal pode ser editada
sem alterar as demais regras criadas para outros dias.

## Escopo

- seleção visual de um ou mais dias na criação;
- validação server-side de lista não vazia, valores entre 0 e 6 e sem duplicatas;
- expansão atômica por unidade/fila/dia e validação de conflito por dia;
- preservação do campo unitário no fluxo de edição;
- testes de parsing para lote multi-dia e regressões de seleção inválida;
- atualização de glossário, decisão e roadmap.

## Validação

Executar o teste focado de plantões, type-check, build de produção e o harness
completo antes de concluir. Falhas preexistentes devem permanecer separadas.

