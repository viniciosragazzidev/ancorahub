# Padronização visual operacional

## Escopo entregue

- Evolução dos primitives compartilhados `Card`, `StatCard` e `Table` para superfícies operacionais compactas, overview e kanban.
- Cabeçalho autenticado reduzido a contexto de rota e título compacto.
- Resumo de leads consolidado em uma superfície com divisores e kanban com colunas semânticas discretas.
- Blocos grandes de contexto de página foram comentados nas superfícies operacionais prioritárias, preservando o JSX para restauração futura.

## Arquivos e impacto

- `src/components/ui/card.tsx`, `src/components/dashboard/metric-card.tsx` e `src/components/ui/table.tsx` centralizam as variantes reutilizáveis.
- `src/app/(dashboard)/leads/leads-workspace.tsx` consome a nova composição de overview e kanban.
- Páginas de tarefas, documentos, vendas, equipe, clientes, distribuição, checklist, filiais, metas, financeiro e comissões removem o hero interno duplicado sem alterar ações, filtros ou dados.

## Validação

- `npm run type-check` passou.
- `npm run lint` passou com avisos preexistentes fora do escopo.
- `npm run agent:verify -- --level fast` passou: 46 arquivos de teste e 209 testes.

## Risco e rollback

- Não há mudança de regra de negócio, rota, permissão ou consulta de dados.
- O contexto amplo retirado das páginas permanece comentado em JSX; o rollback é a restauração do bloco respectivo.
