# Qualificação alinhada à Distribuição

## Objetivo e recorte

Refinar apenas a apresentação de `/qualificacao`: uma faixa horizontal de abas em todas as larguras, superfícies neutras, hierarquia de títulos e espaçamento compatíveis com `/distribuicao`. Preservar IDs, parâmetros `?tab=`, conteúdo, autorização, ações e escopo de dados.

## Composição

- Cabeçalho compacto existente com ações preservadas.
- Abas compartilhadas `Tabs`/`TabsList`/`TabsTrigger` com variante `underline`, rolagem horizontal e foco de teclado. A URL conserva a aba ativa e aliases antigos.
- Indicadores na primeira aba, em cards neutros com grade responsiva; os painéis usam `Card` padrão em vez da superfície `subtle` azulada. A sublegenda de SLA fixo foi retirada por não representar dado medido.
- Conteúdo em largura total depois das abas; painéis ficam em colunas apenas quando couberem. Títulos e descrições usam o nível já definido por `CardTitle` e `CardDescription`.

## Validação

Type-check, lint dirigido, build de produção e inspeção autenticada desktop/mobile. A matriz transversal UX-M1.10 continua pendente.
