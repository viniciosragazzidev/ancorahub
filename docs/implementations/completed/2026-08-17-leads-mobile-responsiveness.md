# Responsividade mobile da rota /leads

**Data:** 17/08/2026
**Estado:** concluído (recorte da rota /leads)

## Objetivo

Refinar a responsividade mobile de `/leads` (cabeçalho, abas, tabelas, filtros e
seleção em lote) para eliminar overflow horizontal e comportamentos quebrados em
telas estreitas, sem alterar regras de negócio, permissões ou dados.

## Diagnóstico

- O `DashboardHeader` de `/leads` empilhava 4 ações no `rightSlot` (Período,
  Próximo lead, Importar leads, Novo lead) dentro de um contêiner com largura
  limitada e `overflow-x-auto` — em mobile o header rolava horizontalmente e
  ficava apertado.
- A linha de abas (Qualificações / Leads Qualificados & Distribuídos / Kanban do
  Funil + botão Colunas) não cabia em 360px e competia por espaço com o menu.
- A lista mobile substituía a tabela por cards, mas não oferecia seleção em lote
  (o SelectionToolbar aparecia sem como selecionar), não exibia campanha nem data
  de entrada e a linha de badges podia estourar.
- O botão "Filtros Avançados" ocupava espaço desnecessário no mobile.

## Implementação

- **Novo componente `leads-header-actions.tsx`** (client): abaixo de `lg`, as
  ações secundárias (Período 7/14/30/90, Importar leads, Próximo lead) ficam em
  um menu "Mais ações" ao lado do botão primário "Novo lead"; em `lg+` as ações
  permanecem em linha. Os diálogos são instâncias únicas controladas por estado.
- **`bulk-lead-import-dialog.tsx` e `manual-lead-sheet.tsx`**: ganharam modo
  controlado (`open`/`onOpenChange`) com compatibilidade retroativa (uso interno
  nos estados vazios permanece).
- **`next-urgent-lead-button.tsx`**: aceita `lead` pré-buscado para evitar
  consulta dupla de lead urgente; `page.tsx` busca uma única vez.
- **`page.tsx`**: `rightSlot` do cabeçalho passa a usar `LeadsHeaderActions`.
- **`leads-workspace.tsx`**: linha de abas com rolagem horizontal
  (`min-w-0 flex-1`), rótulos curtos no mobile ("Distribuídos"/"Kanban") e botão
  Colunas fixo; lista mobile com checkbox de seleção em lote, badge de campanha,
  data de entrada e badges com `flex-wrap`; cards de qualificação com quebra
  segura.
- **`selection-toolbar.tsx`**: toolbar e ações passam a envolver conteúdo em
  telas estreitas (`flex-wrap`), sem afetar desktop.
- **`leads-filters.tsx`**: botão de filtros usa rótulo curto ("Filtros") no
  mobile.

## Arquivos afetados

- `src/app/(dashboard)/leads/_components/leads-header-actions.tsx` (novo)
- `src/app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx`
- `src/app/(dashboard)/leads/_components/manual-lead-sheet.tsx`
- `src/app/(dashboard)/leads/_components/leads-filters.tsx`
- `src/app/(dashboard)/leads/page.tsx`
- `src/app/(dashboard)/leads/leads-workspace.tsx`
- `src/components/next-urgent-lead-button.tsx`
- `src/components/ui/selection-toolbar.tsx`
- `src/features/roadmap/roadmap-data.ts` (item N80)

## Risco e rollback

Alteração de composição de interface e de contrato opcional de props (controlado)
compatível com os usos existentes. Rollback: restaurar o `rightSlot` anterior e o
bloco de cards mobile; não há migração, alteração de dados nem efeito externo.

## Validações

- `npx eslint` nos arquivos alterados — 0 erros (apenas avisos pré-existentes).
- `npm run type-check` — aprovado.
- `npm run agent:verify -- --level fast` — evidência em
  `reports/agent/verification/`; 3 falhas pré-existentes não relacionadas ao
  recorte (testes de modelo IA dependentes de env e um timeout de painel de
  WhatsApp do Super Admin).
- Build de produção: pendente de execução no ciclo completo (`agent:verify --level full`).
