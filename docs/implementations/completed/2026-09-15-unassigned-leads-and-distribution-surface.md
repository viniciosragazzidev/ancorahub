# Sem atribuição independente e superfície de distribuição — 15/09/2026

## Escopo

- Separar a consulta, total e paginação da aba `Sem atribuição` da página principal
  de `/leads`.
- Manter filtros e `pageSize` na URL como fonte única para os controles do topo e
  da paginação inferior.
- Reduzir ruído visual em `/leads/distribuicao` sem alterar regras de negócio,
  permissões ou escopo de tenant.

## Implementação

- `src/app/(dashboard)/leads/page.tsx` monta `commonWhere` uma vez e deriva a
  consulta própria de leads sem corretor, com `unassignedTotalItems` e
  `unassignedTotalPages`. A lista principal não é mais usada como fonte do badge
  ou das linhas da aba; quando a aba está ativa, a consulta principal de linhas é
  omitida para não duplicar o carregamento.
- `src/app/(dashboard)/leads/leads-workspace.tsx` recebe o dataset/paginação sem
  atribuição e usa os IDs do dataset ativo para seleção; o badge deixa de exibir
  o total da lista principal.
- `/leads/distribuicao` padroniza padding dos headers/contents de cards overview e
  troca cinco subcards decorativos por uma sequência numerada compacta.

## Validações

- `npm run type-check` — passou.
- `npx vitest run 'src/app/(dashboard)/leads/leads-view-navigation.test.ts' 'src/features/lead-distribution/routing-engine.test.ts'` — 5 testes passaram.
- `npm run build` — passou; avisos de renderização dinâmica são preexistentes e
  esperados para rotas autenticadas.

## Risco e rollback

A mudança é reversível por commit. Não altera schema, regras de distribuição,
autorização nem integrações externas. O custo adicional da aba de leads é uma
contagem escopada de sem atribuição; a lista detalhada só é consultada quando a
aba server-backed está ativa.
