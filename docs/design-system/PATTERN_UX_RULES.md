# Regras de UX dos Patterns

Estas regras complementam o contrato e são obrigatórias para qualquer blueprint.

## Estados transversais

| Estado | Regra |
|---|---|
| Loading | preservar estrutura, anunciar carregamento e nunca manter skeleton infinito sem erro/timeout. |
| Empty | explicar por que não há conteúdo e oferecer próxima ação quando autorizada. |
| Error | informar impacto, preservar contexto e oferecer retry/alternativa. Não mostrar stack trace. |
| Permission denied | explicar a limitação sem expor recursos fora do escopo; indicar contato/alternativa. |
| Unavailable/sync | distinguir indisponibilidade de ausência de dados e informar a última atualização quando confiável. |
| Success | confirmar consequência de uma mutação e manter caminho de retorno. |

## Interação, navegação e métricas

- Uma superfície tem uma ação primária e até três ações prioritárias por contexto.
- Filtros, abas, paginação, período e seleção que definem contexto devem ser recuperáveis por URL quando aplicável.
- Contadores e métricas são dados autorizados e escopados; sem dado confiável, omita ou use estado de carregamento.
- Medir, quando houver instrumentação aprovada: conclusão da tarefa, erro/retry, abandono, tempo até primeira ação e uso de filtros. Nunca registrar PII em eventos de UX.
- Motion apenas comunica mudança de estado, respeita `prefers-reduced-motion` e não bloqueia interação.

## Responsividade e acessibilidade

- Ordem de leitura e foco devem sobreviver a reflow e viewport estreito.
- Tabelas e kanban oferecem alternativa operável quando o espaço é insuficiente.
- Todo controle possui nome acessível, foco visível, operação por teclado e feedback além de cor.
