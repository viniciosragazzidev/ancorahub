# DataTable

`Table` (`src/components/ui/table.tsx`) é a primitive visual: semântica HTML, container com overflow e células.

`DataTable` (`src/components/ui/data-table/`) é o pattern canônico de dados, baseado em TanStack Table e composição por subcomponentes. Responsabilidades: colunas, sorting, filtering controlado pelo consumidor, paginação, seleção, loading, empty, ações de linha e visibilidade de coluna.

Não adicionar uma coleção de boolean props para cada caso. O consumidor compõe `DataTableColumnHeader`, paginação e view options; busca/filtros ficam no FilterToolbar. Tabelas HTML locais e grids que simulam tabela têm destino `Table` ou `DataTable` na migração futura.
