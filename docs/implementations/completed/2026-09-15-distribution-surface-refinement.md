# Refinamento visual da central de distribuição

**Data:** 2026-09-15  
**Escopo:** `/distribuicao` e alias `/leads/distribuicao`  
**Estado:** concluído (QA visual autenticado pendente)

## O que mudou

- O conteúdo passou a usar um shell único, com largura máxima, margens e espaçamento vertical consistentes.
- A explicação do fluxo foi condensada em uma única faixa de cinco etapas, com textos curtos e leitura progressiva.
- Cabeçalhos de matriz, simulador, filiais, filas e histórico adotam o mesmo padrão de padding, divisor e hierarquia tipográfica.
- Ações de filiais foram agrupadas no mesmo bloco para evitar quebra visual em larguras intermediárias.
- Cards de métricas e resumo de corretores receberam uma grade responsiva previsível; a legenda foi reduzida a uma linha de apoio de baixo ruído.
- Não houve alteração em consultas, permissões, ações de distribuição, estados de fila ou regras de negócio.

## Estados preservados

Desktop, tablet e mobile mantêm rolagem horizontal apenas onde necessária (abas e tabelas), foco visível nos controles compartilhados, estados vazios, estados de erro e feedback de ações existentes.

## Validação

`git diff --check` passou. O type-check global permanece bloqueado por erro preexistente em `src/features/waha-cadence/sync.ts` (`chatId` possivelmente nulo), fora do escopo desta mudança. O lint global mantém avisos preexistentes e o mesmo erro de regra em código fora da rota; os arquivos alterados não introduziram erros de lint.
