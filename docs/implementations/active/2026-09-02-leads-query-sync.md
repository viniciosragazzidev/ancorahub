# Sincronização de filtros e paginação em `/leads`

## Objetivo

Garantir que uma alteração de página, tamanho de página, ordenação ou filtro
reconcilie imediatamente a tabela de leads com a consulta autorizada no servidor,
sem exigir atualização manual do navegador.

## Escopo e decisão

- A URL continua sendo a fonte de verdade da visão operacional.
- As atualizações de paginação, filtros e ordenação usam navegação não superficial
  e solicitam uma reconciliação do App Router após a URL ser consolidada.
- O workspace recebe uma chave derivada da consulta. Assim, uma resposta nova do
  servidor não mantém uma cópia local de resultados pertencente à página anterior.
- O padrão de 20 itens é compartilhado entre o servidor e a tabela.
- A tabela informa “Atualizando resultados...” e bloqueia controles de paginação
  durante a transição.

## Segurança e domínio

Nenhuma regra de acesso foi alterada. A página continua calculando o escopo por
tenant, função, unidade e carteira no servidor; os parâmetros de URL apenas definem
a visualização dentro desse escopo autorizado.

## Evidência

- `npx tsc --noEmit --pretty false`;
- `npx vitest run src/components/service-worker-cache-policy.test.ts src/hooks/use-multi-select.test.ts --pool=forks --maxWorkers=1`;
- lint focado nos arquivos modificados, sem erros.

## Rollback

Reverter somente o commit desta implementação remove a reconciliação explícita e a
chave de consulta. Não há migração, mudança de esquema ou alteração de dados.
