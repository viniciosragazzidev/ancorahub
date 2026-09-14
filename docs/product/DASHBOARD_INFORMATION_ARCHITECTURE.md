# Arquitetura de informação dos dashboards

## Hierarquia permanente

- `/dashboard`: sinaliza o que exige atenção agora na operação transversal.
- Mini dashboard do módulo: explica a saúde daquela área.
- Lista/detalhe: resolve o trabalho operacional.
- `/relatorios`: aprofunda histórico, comparação e exportação.

## Prioridade por perfil

| Perfil | Prioridade principal | Deep links preferenciais |
| --- | --- | --- |
| Diretor | Saúde da operação e exceções | `/leads`, `/distribuicao`, `/equipe`, `/relatorios` |
| Gestor | Saúde da unidade e equipe | `/leads`, `/equipe`, `/distribuicao` |
| Supervisor | Pessoas e pendências que precisam de ajuda | `/equipe`, `/tarefas`, `/conversas` |
| Corretor | Próxima ação e novos leads | `/minha-fila`, `/leads`, `/conversas` |

## Regra anti-duplicação

O global mostra o alerta; o módulo mostra a explicação; a tela operacional permite agir. Uma métrica canônica deve ter uma única definição e respeitar o mesmo escopo em todos os níveis.
